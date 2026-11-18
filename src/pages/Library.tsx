import { BRAND, IS_HARMONICA_APP } from '../appConfig';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { db, deleteSongs, fold, importBackup } from '../lib/db';
import { compareTitle } from '../lib/songSort';
import { HARP_KEYS, HARP_TYPE_LABEL, HarpType, isChromatic, isTremolo } from '../lib/harp';
import { Song } from '../lib/types';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { BackupNotice } from '../components/AppNotices';
import { KeyPlate } from '../components/KeySelect';
import { useAppState } from '../state';
import { useScrollHint } from '../components/useScrollHint';
import { PATTERNS } from '../audio/patterns';

type Sort = 'recent' | 'title' | 'title-desc' | 'practiced';
const SORTS: Sort[] = ['recent', 'title', 'title-desc', 'practiced'];
// nhớ cách sắp xếp đã chọn (chỉ là tiện lợi trên máy này)
const SORT_KEY = 'harptabs.librarySort';

function loadSort(): Sort {
  try {
    const v = localStorage.getItem(SORT_KEY) as Sort | null;
    return v && SORTS.includes(v) ? v : 'title';
  } catch { return 'title'; }
}

const DIFF = ['', 'Dễ', 'Vừa', 'Khó'];

/** bộ lọc + vị trí cuộn lúc mở một bài — đọc lại khi quay về thư viện bằng nút quay lại (chỉ trong phiên này) */
interface LibrarySnap { q: string; fav: boolean; key: string; kind: '' | 'diatonic' | 'chromatic' | 'tremolo'; diff: number; itype: HarpType | ''; y: number }
const SNAP_KEY = 'harptabs.libraryView';
function readSnap(): LibrarySnap | null {
  try { const v = sessionStorage.getItem(SNAP_KEY); return v ? (JSON.parse(v) as LibrarySnap) : null; } catch { return null; }
}
function writeSnap(v: LibrarySnap) {
  try { sessionStorage.setItem(SNAP_KEY, JSON.stringify(v)); } catch { /* chế độ riêng tư */ }
}

function styleLabel(s: Song['style']) {
  if (s === 'none') return 'Không beat';
  if (s === 'metronome') return 'Đếm nhịp';
  return PATTERNS[s]?.label ?? s;
}

export default function Library() {
  const songs = useLiveQuery(() => db.songs.toArray(), []);
  // quay lại từ trang bài (nút quay lại của điện thoại / mũi tên trong app): giữ nguyên bộ lọc và chỗ đang cuộn tới
  const navType = useNavigationType();
  const location = useLocation();
  const backFromSong = navType === 'POP' || !!(location.state as { restore?: boolean } | null)?.restore;
  const [snap] = useState<LibrarySnap | null>(() => (backFromSong ? readSnap() : null));
  const [q, setQ] = useState(snap?.q ?? '');
  const [fav, setFav] = useState(snap?.fav ?? false);
  const [key, setKey] = useState<string>(snap?.key ?? '');
  const [kind, setKind] = useState<'' | 'diatonic' | 'chromatic' | 'tremolo'>(snap?.kind ?? '');
  const [diff, setDiff] = useState<number>(snap?.diff ?? 0);
  // app nhiều loại nhạc cụ (guitar / ukulele, tranh / bầu, organ / piano…): lọc theo loại có trong thư viện
  const [itype, setItype] = useState<HarpType | ''>(snap?.itype ?? '');
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!snap || restored.current || !songs) return;
    restored.current = true;
    // danh sách đọc từ kho trên máy xong mới đủ dài để cuộn tới chỗ cũ
    window.scrollTo(0, snap.y);
    requestAnimationFrame(() => window.scrollTo(0, snap.y));
  }, [snap, songs]);
  const rememberView = () => writeSnap({ q, fav, key, kind, diff, itype, y: window.scrollY });
  // rời thư viện bằng bất kỳ đường nào (mở bài, sang trang khác): ghi lại bộ lọc + chỗ cuộn cuối cùng
  const latest = useRef({ q, fav, key, kind, diff, itype });
  latest.current = { q, fav, key, kind, diff, itype };
  // useLayoutEffect: phần dọn dẹp chạy ngay lúc rời trang, khi danh sách vẫn còn trên trang (chưa bị trang mới thay, chưa bị cuộn lên đầu)
  // nên đọc thẳng window.scrollY được — không dựa vào sự kiện cuộn (máy có thể không phát khi app chạy nền)
  useLayoutEffect(() => () => writeSnap({ ...latest.current, y: window.scrollY }), []);
  const types = useMemo(() => {
    if (IS_HARMONICA_APP || !songs) return [];
    const seen = new Map<HarpType, number>();
    for (const s of songs) { const t = s.harpType ?? 'diatonic'; seen.set(t, (seen.get(t) ?? 0) + 1); }
    return seen.size > 1 ? [...seen.entries()].sort((a, b) => b[1] - a[1]) : [];
  }, [songs]);
  const filtering = !!(q.trim() || fav || key || kind || diff || itype);
  const clearFilters = () => { setQ(''); setFav(false); setKey(''); setKind(''); setDiff(0); setItype(''); };
  const [sort, setSortState] = useState<Sort>(loadSort);
  const setSort = (v: Sort) => {
    setSortState(v);
    try { localStorage.setItem(SORT_KEY, v); } catch { /* bỏ qua */ }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const filterRef = useScrollHint<HTMLDivElement>();
  const nav = useNavigate();
  const { toast } = useAppState();
  // chọn nhiều bài để xoá
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const togglePick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); setConfirmDel(false); };
  const removePicked = async () => {
    if (!picked.size) return;
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    const n = picked.size;
    await deleteSongs([...picked]);
    toast(`Đã xoá ${n} bài`);
    stopSelecting();
  };

  const list = useMemo(() => {
    if (!songs) return [];
    const fq = fold(q.trim());
    return songs
      .filter((s) => !fav || s.favorite)
      .filter((s) => !key || s.harpKey === key)
      .filter((s) => !kind || (kind === 'chromatic' ? isChromatic(s.harpType) : kind === 'tremolo' ? isTremolo(s.harpType) : !isChromatic(s.harpType) && !isTremolo(s.harpType)))
      .filter((s) => !itype || (s.harpType ?? 'diatonic') === itype)
      .filter((s) => !diff || s.difficulty === diff)
      .filter((s) => !fq || fold(`${s.title} ${s.artist ?? ''} ${s.tags.join(' ')}`).includes(fq))
      .sort((a, b) => {
        if (sort === 'title') return compareTitle(a, b);
        if (sort === 'title-desc') return compareTitle(a, b, -1);
        if (sort === 'practiced') return (b.lastPracticedAt ?? 0) - (a.lastPracticedAt ?? 0);
        return b.updatedAt - a.updatedAt;
      });
  }, [songs, q, fav, key, kind, diff, itype, sort]);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await importBackup(JSON.parse(await f.text()));
      toast(`Đã nhập ${r.added} bài mới, cập nhật ${r.updated} bài${r.practice ? '; đã khôi phục nhật ký luyện tập' : ''}`);
    } catch (e) {
      toast((e as Error).message || 'File không hợp lệ');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Bài hát</h1>
          <p className="muted">{!songs ? 'Đang tải…' : filtering ? `${list.length} / ${songs.length} bài khớp bộ lọc` : `${songs.length} bài trong máy`}</p>
        </div>
        <div className="head-actions">
          <ThemeToggle className="btn btn-ghost theme-btn" />
          {!!songs?.length && (
            <button type="button" className={`btn btn-ghost${selecting ? ' on' : ''}`} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
              <Icon name="check" size={18} /> <span className="btn-label">{selecting ? 'Xong' : 'Chọn'}</span>
            </button>
          )}
          <button type="button" className="btn btn-ghost" title="Nhập file sao lưu (.json)" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> <span className="btn-label">Nhập file</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => nav('/new')}>
            <Icon name="plus" size={18} /> Thêm bài
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </header>

      <BackupNotice />

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr-only">Tìm bài</span>
          <input type="search" placeholder="Tìm theo tên, tác giả, thẻ" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="filter-row scroll-row" ref={filterRef}>
          <button type="button" className={`chip${fav ? ' on' : ''}`} aria-pressed={fav} onClick={() => setFav(!fav)}>
            <Icon name="star" size={15} filled={fav} /> Yêu thích
          </button>
          {IS_HARMONICA_APP && <>
          <select aria-label="Lọc theo loại kèn" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="chip-select">
            <option value="">Mọi loại kèn</option>
            <option value="diatonic">Diatonic</option>
            <option value="chromatic">Chromatic</option>
            <option value="tremolo">Tremolo</option>
          </select>
          <select aria-label="Lọc theo kèn" value={key} onChange={(e) => setKey(e.target.value)} className="chip-select">
            <option value="">Mọi kèn</option>
            {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {k}</option>)}
          </select>
          </>}
          {types.length > 0 && (
            <select aria-label={`Lọc theo loại ${BRAND.noun}`} value={itype} onChange={(e) => setItype(e.target.value as HarpType | '')} className={`chip-select${itype ? ' on' : ''}`}>
              <option value="">Mọi loại {BRAND.noun}</option>
              {types.map(([t, n]) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]} ({n})</option>)}
            </select>
          )}
          <select aria-label="Lọc theo độ khó" value={diff} onChange={(e) => setDiff(Number(e.target.value))} className="chip-select">
            <option value={0}>Mọi độ khó</option>
            <option value={1}>Dễ</option>
            <option value={2}>Vừa</option>
            <option value={3}>Khó</option>
          </select>
          <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="chip-select">
            <option value="recent">Mới sửa</option>
            <option value="practiced">Mới tập</option>
            <option value="title">Tên A–Z</option>
            <option value="title-desc">Tên Z–A</option>
          </select>
          {filtering && (
            <button type="button" className="chip chip-clear" onClick={clearFilters}>
              <Icon name="close" size={14} /> Bỏ lọc
            </button>
          )}
        </div>
      </div>

      {songs && list.length === 0 && (
        <div className="empty">
          {songs.length === 0 ? (
            <>
              <p>Thư viện đang trống. Thêm bài đầu tiên bằng tay, hoặc mở file nhạc / chụp khuông nhạc để app chuyển thành tab.</p>
              <div className="row gap">
                <Link to="/new" className="btn btn-primary">Thêm bài</Link>
                <Link to="/ai" className="btn btn-ghost">Nhập bài</Link>
              </div>
            </>
          ) : (
            <div className="row gap wrap">
              <p>Không có bài nào khớp bộ lọc.</p>
              <button type="button" className="btn btn-ghost" onClick={clearFilters}>Bỏ lọc</button>
            </div>
          )}
        </div>
      )}

      <ul className="song-list">
        {list.map((s) => (
          <li key={s.id}>
            <Link to={`/song/${s.id}`} className={`song-row${selecting ? ' picking' : ''}${picked.has(s.id) ? ' picked' : ''}`}
              aria-pressed={selecting ? picked.has(s.id) : undefined}
              onClick={selecting ? (e) => { e.preventDefault(); togglePick(s.id); } : rememberView}>
              {selecting && <span className="pick-box" aria-hidden="true">{picked.has(s.id) && <Icon name="check" size={16} />}</span>}
              <KeyPlate k={s.harpKey} type={s.harpType} />
              <span className="sr-body">
                <span className="sr-title">
                  {s.title || 'Chưa đặt tên'}
                  {s.favorite && <Icon name="star" size={14} filled label="Yêu thích" />}
                </span>
                {s.artist && <span className="sr-artist">{s.artist}</span>}
                <span className="sr-meta">
                  <span className={`diff d${s.difficulty}`}>{DIFF[s.difficulty]}</span>
                  <span>{s.timeSig}</span>
                  <span>{s.bpm} bpm</span>
                  <span>{styleLabel(s.style)}</span>
                  {isChromatic(s.harpType) && <span>Chromatic</span>}
                  {isTremolo(s.harpType) && <span>Tremolo</span>}
                  {!isChromatic(s.harpType) && !isTremolo(s.harpType) && s.position && s.position > 1 && <span>Vị trí {s.position}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {selecting && (
        <div className="select-bar" role="toolbar" aria-label="Xoá bài đã chọn">
          <span className="grow">Đã chọn <strong>{picked.size}</strong> bài</span>
          <button type="button" className="btn btn-ghost" onClick={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((s) => s.id)))}>
            {picked.size === list.length && list.length ? 'Bỏ chọn' : 'Chọn tất cả'}
          </button>
          <button type="button" className="btn btn-danger" disabled={!picked.size} onClick={removePicked}>
            <Icon name="trash" size={18} /> {confirmDel ? `Bấm lần nữa để xoá ${picked.size} bài` : `Xoá ${picked.size || ''} bài`}
          </button>
        </div>
      )}
    </div>
  );
}
