import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { blankSong, db, deleteSongs } from '../lib/db';
import { HarpKey, normalizeKey, songTonality } from '../lib/harp';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar, Song } from '../lib/types';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
import { KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { Icon } from '../components/Icon';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { useAppState } from '../state';

const DRAFT_KEY = 'harptabs:draft-new';

export default function SongEdit() {
  const { id } = useParams();
  const [song, setSong] = useState<Song | null>(null);
  const { settings } = useAppState();

  useEffect(() => {
    if (id) {
      db.songs.get(id).then((s) => setSong(s ?? null));
    } else {
      let draft: Partial<Song> = {};
      try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}'); } catch { /* bỏ qua */ }
      setSong(blankSong({ harpKey: settings.defaultHarpKey, ...draft }));
    }
  }, [id, settings.defaultHarpKey]);

  if (!song) return <div className="page"><p className="muted">Đang tải…</p></div>;
  return <Editor initial={song} isNew={!id} />;
}

const KEYPAD_HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Editor({ initial, isNew }: { initial: Song; isNew: boolean }) {
  const [s, setS] = useState<Song>(initial);
  const [draw, setDraw] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nav = useNavigate();
  const { settings, toast } = useAppState();

  const parsed = useMemo(() => parseTab(s.body, s.harpKey), [s.body, s.harpKey]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const preview = usePlayer(flat, {
    bpm: s.bpm, tempoScale: 1, beatsPerBar: beatsPerBar(s.timeSig), pickupBeats: s.pickupBeats,
    style: s.style, melody: true, beat: true, click: false, countIn: false,
    songKey: s.songKey || songTonality(s.harpKey, s.position),
  });

  const set = <K extends keyof Song>(k: K, v: Song[K]) => setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!isNew) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...s, id: undefined })); } catch { /* bỏ qua */ }
  }, [s, isNew]);

  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const before = value.slice(0, a);
    const needSpace = before && !/[\s]$/.test(before) && text !== '\n' && !text.startsWith(':') && !text.startsWith("'");
    const ins = (needSpace ? ' ' : '') + text;
    const next = before + ins + value.slice(b);
    set('body', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = a + ins.length;
    });
  };

  const errors = parsed.issues.filter((i) => i.level === 'error');
  const warnings = parsed.issues.filter((i) => i.level === 'warning');

  const save = async () => {
    if (!s.title.trim()) { toast('Hãy đặt tên bài'); return; }
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean);
    const rec: Song = { ...s, title: s.title.trim(), tags, updatedAt: Date.now() };
    await db.songs.put(rec);
    if (isNew) try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
    toast(errors.length ? `Đã lưu (còn ${errors.length} lỗi ký hiệu)` : 'Đã lưu');
    nav(`/song/${rec.id}`, { replace: true });
  };

  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    await deleteSongs([s.id]);
    toast('Đã xoá bài');
    nav('/', { replace: true });
  };

  return (
    <div className="page page-edit">
      <header className="page-head">
        <div className="row gap center">
          <Link to={isNew ? '/' : `/song/${s.id}`} className="icon-btn" aria-label="Quay lại"><Icon name="back" /></Link>
          <h1>{isNew ? 'Thêm bài' : 'Sửa bài'}</h1>
        </div>
        <div className="head-actions">
          {!isNew && (
            <button type="button" className={`btn ${confirmDel ? 'btn-danger' : 'btn-ghost'}`} onClick={remove}>
              <Icon name="trash" size={18} /> {confirmDel ? 'Bấm lần nữa để xoá' : 'Xoá'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={save}><Icon name="check" size={18} /> Lưu bài</button>
        </div>
      </header>

      <div className="edit-grid">
        <div className="edit-meta">
          <label className="field wide">
            <span className="field-label">Tên bài</span>
            <input value={s.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Amazing Grace" />
          </label>
          <label className="field wide">
            <span className="field-label">Tác giả / ca sĩ</span>
            <input value={s.artist ?? ''} onChange={(e) => set('artist', e.target.value || undefined)} />
          </label>
          <KeySelect value={s.harpKey} onChange={(k) => set('harpKey', k as HarpKey)} />
          <label className="field">
            <span className="field-label">Vị trí</span>
            <select value={s.position ?? 1} onChange={(e) => set('position', Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>1 (thẳng)</option>
              <option value={2}>2 (cross harp)</option>
              <option value={3}>3 (slant)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Giọng bài</span>
            <input value={s.songKey ?? ''} onChange={(e) => set('songKey', e.target.value || undefined)} placeholder="C, Am…"
              onBlur={(e) => { const k = normalizeKey(e.target.value); if (k) set('songKey', k); }} />
          </label>
          <label className="field">
            <span className="field-label">Tempo (bpm)</span>
            <input type="number" min={30} max={260} value={s.bpm} onChange={(e) => set('bpm', Math.min(260, Math.max(30, Number(e.target.value) || 90)))} />
          </label>
          <label className="field">
            <span className="field-label">Nhịp</span>
            <select value={s.timeSig} onChange={(e) => set('timeSig', e.target.value)}>
              {['2/4', '3/4', '4/4', '6/8'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Phách lấy đà</span>
            <input type="number" min={0} max={8} step={0.5} value={s.pickupBeats} onChange={(e) => set('pickupBeats', Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="field">
            <span className="field-label">Beat mẫu</span>
            <select value={s.style} onChange={(e) => set('style', e.target.value as BeatStyle)}>
              {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Độ khó</span>
            <select value={s.difficulty} onChange={(e) => set('difficulty', Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>Dễ</option><option value={2}>Vừa</option><option value={3}>Khó</option>
            </select>
          </label>
          <label className="field wide">
            <span className="field-label">Thẻ (cách nhau bởi dấu phẩy)</span>
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="trữ tình, bolero" />
          </label>
          <label className="field wide">
            <span className="field-label">Ghi chú tập luyện</span>
            <textarea rows={2} value={s.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
          </label>
        </div>

        <div className="edit-body">
          <div className="field-label row between">
            <span>Tab và lời</span>
            <details className="syntax-help">
              <summary>Cách ghi</summary>
              <ul>
                <li><code>4</code> thổi lỗ 4, <code>-4</code> hút lỗ 4</li>
                <li><code>-3'</code> bend nửa cung, <code>-3''</code> bend 1 cung, <code>6o</code> overblow</li>
                <li><code>4:2</code> giữ 2 phách, <code>4:0.5</code> nửa phách, <code>r</code> dấu nghỉ</li>
                <li>Dòng ngay dưới dòng tab là lời. Gạch nối tách âm tiết: <code>Hap-py</code>; <code>_</code> là nốt luyến</li>
                <li><code># Điệp khúc</code> để đặt tên đoạn; dòng trống để ngắt câu</li>
              </ul>
            </details>
          </div>
          <div className="keypad" role="toolbar" aria-label="Bàn phím tab">
            <button type="button" className={`kp-mode${draw ? ' draw' : ''}`} onClick={() => setDraw(!draw)} aria-pressed={draw}>
              {draw ? 'Hút' : 'Thổi'}
            </button>
            {KEYPAD_HOLES.map((h) => (
              <button type="button" key={h} className={draw ? 'draw' : 'blow'} onClick={() => insert(`${draw ? '-' : ''}${h}`)}>{draw ? `−${h}` : h}</button>
            ))}
            <button type="button" onClick={() => insert("'")} aria-label="Thêm bend">′</button>
            <button type="button" onClick={() => insert(':2')}>:2</button>
            <button type="button" onClick={() => insert(':0.5')}>:½</button>
            <button type="button" onClick={() => insert('r')}>nghỉ</button>
            <button type="button" onClick={() => insert('\n')} aria-label="Xuống dòng">↵</button>
          </div>
          <textarea
            ref={taRef}
            className="tab-input"
            value={s.body}
            onChange={(e) => set('body', e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={14}
            placeholder={'# Đoạn 1\n4 4 -4 4 7 -7:2\nHap-py birth-day to you'}
            aria-label="Nội dung tab"
          />
          {(errors.length > 0 || warnings.length > 0) && (
            <ul className="issues">
              {[...errors, ...warnings].map((i, k) => (
                <li key={k} className={i.level}>Dòng {i.lineNo}: {i.message}</li>
              ))}
            </ul>
          )}
          <div className="row between center preview-head">
            <h2 className="h-small">Xem trước</h2>
            <MiniPlay p={preview} />
          </div>
          <TabView parsed={parsed} flat={flat} active={preview.active} showNames={settings.showNoteNames} nameStyle={settings.noteNames} size="s" />
        </div>
      </div>
    </div>
  );
}
