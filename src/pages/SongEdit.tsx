import { useEffect, useMemo, useRef, useState } from 'react';
import { fixGarbled, VN_ENCODINGS } from '../lib/vnEncoding';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { blankSong, db, deleteSongs } from '../lib/db';
import { HarpKey, HarpType, harpTypeOf, holeCount, isChromatic, isTremolo, midiToName, normalizeKey, parseToken, songTonality, tremoloDir } from '../lib/harp';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar, Song } from '../lib/types';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
import { suggestStyle } from '../audio/suggest';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { Icon } from '../components/Icon';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { previewNote } from '../audio/engine';
import { useAppState } from '../state';
import { clearDraft, loadDraft, saveDraft, SongDraft } from '../lib/drafts';

const DRAFT_DELAY = 400;

export default function SongEdit() {
  const { id } = useParams();
  const [song, setSong] = useState<Song | null>(null);
  const [draft, setDraft] = useState<SongDraft | null>(null);
  const { settings } = useAppState();

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await loadDraft(id).catch(() => null);
      const s = id
        ? await db.songs.get(id)
        : blankSong({ harpKey: settings.defaultHarpKey, harpType: settings.defaultHarpType === 'diatonic' ? undefined : settings.defaultHarpType });
      if (!alive) return;
      setSong(s ?? null);
      setDraft(d);
    })();
    return () => { alive = false; };
  }, [id, settings.defaultHarpKey, settings.defaultHarpType]);

  if (!song) return <div className="page"><p className="muted">Đang tải…</p></div>;
  return <Editor key={song.id} initial={song} isNew={!id} draft={draft} />;
}

function Editor({ initial, isNew, draft }: { initial: Song; isNew: boolean; draft: SongDraft | null }) {
  const [s, setS] = useState<Song>(initial);
  const [draw, setDraw] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  /** bản nháp lần trước chưa lưu: hỏi người dùng có mở lại không */
  const [pendingDraft, setPendingDraft] = useState<SongDraft | null>(draft);
  const draftId = isNew ? undefined : initial.id;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nav = useNavigate();
  const { settings, toast } = useAppState();

  const harpType = harpTypeOf(s);
  const chrom = isChromatic(harpType);
  const trem = isTremolo(harpType);
  const holes = Array.from({ length: holeCount(harpType) }, (_, i) => i + 1);
  const parsed = useMemo(() => parseTab(s.body, s.harpKey, harpType), [s.body, s.harpKey, harpType]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const preview = usePlayer(flat, {
    bpm: s.bpm, tempoScale: 1, beatsPerBar: beatsPerBar(s.timeSig), pickupBeats: s.pickupBeats,
    style: s.style, melody: true, beat: true, click: false, countIn: false,
    songKey: s.songKey || songTonality(s.harpKey, s.position, harpType),
  });

  const set = <K extends keyof Song>(k: K, v: Song[K]) => setS((prev) => ({ ...prev, [k]: v }));

  // tự lưu nháp mỗi khi sửa: tắt app, tải lại trang hay cập nhật bản mới đều không mất
  const initialSnap = useRef(JSON.stringify({ s: initial, tagText: initial.tags.join(', ') }));
  const latest = useRef<SongDraft | null>(null);
  useEffect(() => {
    const dirty = JSON.stringify({ s, tagText }) !== initialSnap.current;
    latest.current = dirty ? { song: s, tagText, savedAt: Date.now(), baseUpdatedAt: isNew ? undefined : initial.updatedAt } : null;
    const t = window.setTimeout(() => {
      if (latest.current) void saveDraft(draftId, latest.current).catch(() => {});
      else if (!pendingDraft) void clearDraft(draftId).catch(() => {});
    }, DRAFT_DELAY);
    return () => window.clearTimeout(t);
  }, [s, tagText, isNew, initial.updatedAt, draftId, pendingDraft]);
  useEffect(() => {
    const flush = () => { if (latest.current) void saveDraft(draftId, latest.current).catch(() => {}); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [draftId]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setS({ ...pendingDraft.song, id: initial.id });
    setTagText(pendingDraft.tagText);
    setPendingDraft(null);
  };
  const discardDraft = () => {
    setPendingDraft(null);
    if (!latest.current) void clearDraft(draftId);
  };

  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const before = value.slice(0, a);
    const needSpace = before && !/[\s]$/.test(before) && text !== '\n' && !text.startsWith(':') && !text.startsWith("'") && !text.startsWith('<');
    const ins = (needSpace ? ' ' : '') + text;
    const next = before + ins + value.slice(b);
    set('body', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = a + ins.length;
    });
  };

  // nghe thử nốt trước khi thêm vào tab: chạm lỗ chỉ chọn + phát tiếng, bấm "Thêm" mới ghi vào
  const [hearFirst, setHearFirst] = useState(() => { try { return localStorage.getItem('harptabs.hearFirst') !== '0'; } catch { return true; } });
  const toggleHearFirst = () => {
    setHearFirst(!hearFirst);
    setPend(null);
    try { localStorage.setItem('harptabs.hearFirst', hearFirst ? '0' : '1'); } catch { /* không lưu được thì thôi */ }
  };
  const [pend, setPend] = useState<{ token: string; dur: string } | null>(null);
  const pendNote = pend ? parseToken(pend.token, s.harpKey, harpType) : null;
  const hear = (token: string) => { const n = parseToken(token, s.harpKey, harpType); if (n) previewNote(n.midi, 0.6); };
  const stage = (token: string, dur = pend?.dur ?? '') => { setPend({ token, dur }); hear(token); };
  const pickHole = (token: string) => (hearFirst ? stage(token, '') : (hear(token), insert(token)));
  const addPending = () => {
    if (!pend || !pendNote) return;
    insert(pend.token + pend.dur);
    setPend(null);
  };
  /** bend ′ / nút gạt: đổi nốt đang chọn khi nghe trước, không thì chèn ngay */
  const pickMod = (mod: string) => {
    if (!hearFirst || !pend) return insert(mod);
    if (mod === "'") {
      const m = /^(.*?)('*)$/.exec(pend.token)!;
      stage(m[2].length >= 2 ? m[1] : pend.token + "'");
    } else stage(pend.token.endsWith(mod) ? pend.token.slice(0, -mod.length) : pend.token + mod);
  };
  const pickDur = (d: string) => {
    if (!hearFirst || !pend) return insert(d);
    setPend({ ...pend, dur: pend.dur === d ? '' : d });
  };

  // lời / tên bị vỡ dấu (bài MIDI nhập trước khi app đọc được VNI / TCVN3): gợi ý sửa một lần bấm
  const garbled = useMemo(() => fixGarbled(s.body, s.title, s.artist ?? ''), [s.body, s.title, s.artist]);
  const garbledSample = useMemo(() => {
    if (!garbled) return null;
    const w = `${s.title} ${s.body}`.split(/\s+/).find((x) => /[\u0080-\u00ff]/.test(x) && garbled.fix(x) !== x);
    return w ? { from: w, to: garbled.fix(w) } : null;
  }, [garbled, s.title, s.body]);
  const fixFont = () => {
    if (!garbled) return;
    setS((prev) => ({ ...prev, body: garbled.fix(prev.body), title: garbled.fix(prev.title), artist: prev.artist && garbled.fix(prev.artist) }));
    toast('Đã sửa lỗi font — xem lại rồi bấm Lưu bài');
  };

  const errors = parsed.issues.filter((i) => i.level === 'error');
  const warnings = parsed.issues.filter((i) => i.level === 'warning');

  const save = async () => {
    if (!s.title.trim()) { toast('Hãy đặt tên bài'); return; }
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean);
    const rec: Song = { ...s, title: s.title.trim(), tags, updatedAt: Date.now() };
    await db.songs.put(rec);
    latest.current = null;
    await clearDraft(draftId).catch(() => {});
    toast(errors.length ? `Đã lưu (còn ${errors.length} lỗi ký hiệu)` : 'Đã lưu');
    nav(`/song/${rec.id}`, { replace: true });
  };

  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    latest.current = null;
    await deleteSongs([s.id]);
    await clearDraft(draftId).catch(() => {});
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

      {pendingDraft && (
        <div className="notice" role="status">
          <span>
            Có bản {isNew ? 'soạn' : 'sửa'} dở chưa lưu{pendingDraft.song.title ? <> của <strong>{pendingDraft.song.title}</strong></> : ''} lúc {new Date(pendingDraft.savedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}.
            {!isNew && pendingDraft.baseUpdatedAt !== initial.updatedAt && ' Bài đã được lưu lại sau đó, mở bản nháp sẽ thay nội dung hiện tại.'}
          </span>
          <span className="row gap">
            <button type="button" className="btn btn-primary btn-sm" onClick={restoreDraft}>Mở lại</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>Bỏ</button>
          </span>
        </div>
      )}

      {garbled && (
        <div className="notice" role="status">
          <span>
            Lời / tên bài có vẻ bị lỗi font chữ Việt (bảng mã {VN_ENCODINGS.find((e) => e.value === garbled.enc)?.label ?? garbled.enc})
            {garbledSample && <>, ví dụ “{garbledSample.from}” → “<strong>{garbledSample.to}</strong>”</>}.
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={fixFont}>Sửa lỗi font</button>
        </div>
      )}

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
          <HarpTypeSelect value={harpType} onChange={(t: HarpType) => setS((prev) => ({ ...prev, harpType: t === 'diatonic' ? undefined : t, position: t === 'diatonic' ? prev.position : 1 }))} />
          <KeySelect value={s.harpKey} onChange={(k) => set('harpKey', k as HarpKey)} harpType={harpType} />
          {!chrom && !trem && (
            <label className="field">
              <span className="field-label">Vị trí</span>
              <select value={s.position ?? 1} onChange={(e) => set('position', Number(e.target.value) as 1 | 2 | 3)}>
                <option value={1}>1 (thẳng)</option>
                <option value={2}>2 (cross harp)</option>
                <option value={3}>3 (slant)</option>
              </select>
            </label>
          )}
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
          <div className="field">
            <label className="field-label" htmlFor="song-style">Beat mẫu</label>
            <div className="row gap">
              <select id="song-style" value={s.style} onChange={(e) => set('style', e.target.value as BeatStyle)}>
                {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" title="Chọn kiểu nhịp hợp với bài" onClick={() => {
                const g = suggestStyle({ ...s, tags: tagText.split(',').map((t) => t.trim()).filter(Boolean) }, flat);
                set('style', g.style);
                toast(`Tự chọn: ${STYLE_OPTIONS.find((o) => o.value === g.style)?.label} — ${g.reason}`);
              }}>✨ Tự chọn</button>
            </div>
          </div>
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
                {trem
                  ? <li>Kèn tremolo: lỗ lẻ là thổi, lỗ chẵn là hút. Gõ <code>3</code> hay <code>4</code> là đủ — app tự ghi lỗ hút thành <code>-4</code>. Kèn này không bend.</li>
                  : <li><code>4</code> thổi lỗ 4, <code>-4</code> hút lỗ 4</li>}
                {trem ? null : chrom
                  ? <li><code>4&lt;</code> thổi lỗ 4 bấm nút gạt, <code>-4&lt;</code> hút bấm nút gạt (cao lên nửa cung)</li>
                  : <li><code>-3'</code> bend nửa cung, <code>-3''</code> bend 1 cung, <code>6o</code> overblow</li>}
                <li><code>4:2</code> giữ 2 phách, <code>4:0.5</code> nửa phách, <code>r</code> dấu nghỉ</li>
                <li>Dòng ngay dưới dòng tab là lời. Gạch nối tách âm tiết: <code>Hap-py</code>; <code>_</code> là nốt luyến</li>
                <li><code># Điệp khúc</code> để đặt tên đoạn; dòng trống để ngắt câu</li>
              </ul>
            </details>
          </div>
          <div className={`keypad${trem ? ' tremolo' : ''}`} role="toolbar" aria-label="Bàn phím tab">
            {trem ? holes.map((h) => {
              const d = tremoloDir(h) === 'draw';
              return <button type="button" key={h} className={d ? 'draw' : 'blow'} onClick={() => pickHole(`${d ? '-' : ''}${h}`)} aria-label={`Lỗ ${h} ${d ? 'hút' : 'thổi'}`}>{d ? `−${h}` : h}</button>;
            }) : <>
              <button type="button" className={`kp-mode${draw ? ' draw' : ''}`} onClick={() => setDraw(!draw)} aria-pressed={draw}>
                {draw ? 'Hút' : 'Thổi'}
              </button>
              {holes.map((h) => (
                <button type="button" key={h} className={draw ? 'draw' : 'blow'} onClick={() => pickHole(`${draw ? '-' : ''}${h}`)}>{draw ? `−${h}` : h}</button>
              ))}
            </>}
            {trem ? null : chrom
              ? <button type="button" onClick={() => pickMod('<')} aria-label="Bấm nút gạt">&lt;</button>
              : <button type="button" onClick={() => pickMod("'")} aria-label="Thêm bend">′</button>}
            <button type="button" onClick={() => pickDur(':2')}>:2</button>
            <button type="button" onClick={() => pickDur(':0.5')}>:½</button>
            <button type="button" onClick={() => insert('r')}>nghỉ</button>
            <button type="button" onClick={() => insert('\n')} aria-label="Xuống dòng">↵</button>
          </div>
          <div className="hear-row row gap wrap center">
            <button type="button" className={`chip${hearFirst ? ' on' : ''}`} aria-pressed={hearFirst} onClick={toggleHearFirst}>Nghe trước khi thêm</button>
            {hearFirst && (pend ? (
              <>
                <span className="hear-cur">{pend.token}{pend.dur}{pendNote ? <span className="muted"> ({midiToName(pendNote.midi, settings.noteNames)})</span> : <span className="danger"> — kèn này không có nốt đó</span>}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => hear(pend.token)} disabled={!pendNote}>Nghe lại</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={addPending} disabled={!pendNote}>Thêm vào tab</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPend(null)}>Bỏ</button>
              </>
            ) : <span className="muted small">Chạm lỗ để nghe, rồi bấm “Thêm vào tab”.</span>)}
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
