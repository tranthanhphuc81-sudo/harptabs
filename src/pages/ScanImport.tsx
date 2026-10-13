import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_IMAGES } from '../../shared/ai';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey } from '../lib/harp';
import { Gray, OmrNote, OmrPage, keyName, notePitch, readSheet, toGray, toTranscription } from '../lib/omr';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/** Ảnh chụp rất lớn thì thu nhỏ trước cho nhanh; bước đọc tự đưa về cỡ chuẩn */
const MAX_SIDE = 2600;
const TIME_SIGS = ['2/4', '3/4', '4/4', '6/8', '3/8', '2/2'];
const DURATIONS: { beats: number; label: string }[] = [
  { beats: 0.25, label: 'Móc kép' }, { beats: 0.5, label: 'Móc đơn' }, { beats: 0.75, label: 'Móc chấm' },
  { beats: 1, label: 'Đen' }, { beats: 1.5, label: 'Đen chấm' }, { beats: 2, label: 'Trắng' },
  { beats: 3, label: 'Trắng chấm' }, { beats: 4, label: 'Tròn' },
];

async function fileToGray(file: File): Promise<Gray> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(`Không đọc được ảnh "${file.name}"`);
  const f = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * f), h = Math.round(bmp.height * f);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  return toGray(g.getImageData(0, 0, w, h).data, w, h);
}

/** Số phách đen mỗi ô nhịp theo số chỉ nhịp (6/8 → 3) */
const barBeats = (ts: string) => {
  const [n, d] = ts.split('/').map(Number);
  return n && d ? (n * 4) / d : 4;
};

const keySigLabel = (k: number) => (k === 0 ? 'Không dấu hoá' : `${Math.abs(k)} dấu ${k > 0 ? 'thăng ♯' : 'giáng ♭'}`) + ` (${keyName(k)} trưởng)`;

/** Vẽ ảnh xám đã chuẩn hoá lên canvas */
function PageCanvas({ image }: { image: Gray }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = image.width; c.height = image.height;
    const g = c.getContext('2d')!;
    const img = g.createImageData(image.width, image.height);
    for (let i = 0, j = 0; i < image.data.length; i++, j += 4) {
      img.data[j] = img.data[j + 1] = img.data[j + 2] = image.data[i];
      img.data[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [image]);
  return <canvas ref={ref} className="scan-canvas" aria-hidden="true" />;
}

export default function ScanImport() {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [grays, setGrays] = useState<Gray[]>([]);
  const [pages, setPages] = useState<OmrPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [keySig, setKeySig] = useState(0);
  const [timeSig, setTimeSig] = useState('4/4');
  const [tempo, setTempo] = useState(90);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<HarpKey | 'auto'>('auto');
  const [allowTranspose, setAllowTranspose] = useState(true);

  const read = (list: Gray[]) => {
    setBusy(true);
    setError(null);
    // nhường một nhịp cho giao diện hiện "đang đọc" trước khi tính toán
    setTimeout(() => {
      try {
        const r = readSheet(list);
        if (!r.pages.length) {
          setPages([]);
          setError('Không tìm thấy khuông nhạc. Hãy chụp thẳng, đủ sáng, thấy rõ cả 5 dòng kẻ và lấp đầy khung hình bằng bản nhạc.');
        } else {
          setPages(r.pages);
          setKeySig(r.keySig);
          setTimeSig(r.timeSig);
          if (r.pages.length < list.length) toast(`Có ${list.length - r.pages.length} ảnh không thấy khuông nhạc, đã bỏ qua`);
        }
      } catch (e) {
        setError((e as Error).message || 'Không đọc được bản nhạc');
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - grays.length;
    if (files.length > room) toast(`Tối đa ${MAX_IMAGES} trang mỗi lần`);
    try {
      const next = [...grays, ...(await Promise.all(Array.from(files).slice(0, room).map(fileToGray)))];
      setGrays(next);
      setSelected(null);
      read(next);
    } catch (e) {
      toast((e as Error).message);
    }
    if (camRef.current) camRef.current.value = '';
    if (galRef.current) galRef.current.value = '';
  };

  const reset = () => { setGrays([]); setPages([]); setSelected(null); setError(null); };

  // ───── sửa nốt ─────
  const allNotes = useMemo(() => pages.flatMap((p) => p.notes), [pages]);
  const sel = allNotes.find((n) => n.id === selected) ?? null;
  const editNote = (id: string, change: (n: OmrNote) => Partial<OmrNote> | null) => {
    setPages((ps) => ps.map((p) => ({
      ...p,
      notes: p.notes.flatMap((n) => {
        if (n.id !== id) return [n];
        const c = change(n);
        return c === null ? [] : [{ ...n, ...c }];
      }),
    })));
  };
  const moveStep = (n: OmrNote, d: number) => {
    const sp = pageOf(pages, n).staves[n.staff].space;
    editNote(n.id, (m) => ({ step: m.step + d, y: m.y - (d * sp) / 2 }));
  };
  const insertAfter = (n: OmrNote) => {
    const page = pages.findIndex((p) => p.notes.some((m) => m.id === n.id));
    const st = pages[page]?.staves[n.staff];
    if (!st) return;
    const same = pages[page].notes.filter((m) => m.staff === n.staff && m.x > n.x).sort((a, b) => a.x - b.x);
    const x = same.length ? (n.x + same[0].x) / 2 : Math.min(n.x + 2 * st.space, st.xRight - st.space);
    const id = `add${Date.now()}`;
    setPages((ps) => ps.map((p, i) => (i !== page ? p : {
      ...p,
      notes: [...p.notes, { ...n, id, x, rest: false, accidental: null }].sort((a, b) => a.staff - b.staff || a.x - b.x),
    })));
    setSelected(id);
  };

  // ───── chuyển tab ─────
  const transcription = useMemo(
    () => (pages.length ? toTranscription(pages, { title, keySig, timeSig, tempo, pickupBeats: pickupOf(pages, timeSig) }) : null),
    [pages, title, keySig, timeSig, tempo],
  );
  const converted = useMemo(() => (transcription ? aiToTab(transcription, target, allowTranspose) : null), [transcription, target, allowTranspose]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey) : null), [converted]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: tempo, tempoScale: 1, beatsPerBar: beatsPerBar(timeSig), pickupBeats: converted?.pickupBeats ?? 0,
    style: converted?.style ?? 'ballad', melody: true, beat: true, click: false, countIn: false,
  });

  /** token kèn của từng nốt (cùng thứ tự với bản chuyển: trang → khuông → trái sang phải) */
  const tokenOf = useMemo(() => {
    const m = new Map<string, string | null>();
    if (!converted) return m;
    const order = pages.flatMap((p) => p.staves.flatMap((_, si) => p.notes.filter((n) => n.staff === si).sort((a, b) => a.x - b.x)));
    order.forEach((n, i) => m.set(n.id, converted.fit.tokens[i] ?? null));
    return m;
  }, [pages, converted]);

  /** ô nhịp lệch phách (bỏ ô đầu và ô cuối của bài) */
  const offBars = useMemo(() => {
    const want = barBeats(timeSig);
    const bad = new Set<string>();
    const measures: { key: string; sum: number }[] = [];
    pages.forEach((p, pi) => p.staves.forEach((st, si) => {
      const edges = [-Infinity, ...st.bars, Infinity];
      for (let i = 0; i < edges.length - 1; i++) {
        const ms = p.notes.filter((n) => n.staff === si && edges[i] < n.x && n.x < edges[i + 1]);
        if (ms.length) measures.push({ key: `${pi}:${si}:${i}`, sum: ms.reduce((t, n) => t + n.beats, 0) });
      }
    }));
    measures.forEach((m, i) => { if (i > 0 && i < measures.length - 1 && Math.abs(m.sum - want) > 0.01) bad.add(m.key); });
    return bad;
  }, [pages, timeSig]);

  const save = async () => {
    if (!converted) return;
    const song = blankSong({
      title: title.trim() || 'Bài quét',
      harpKey: converted.harpKey,
      songKey: converted.fit.shift % 12 === 0 ? keyName(keySig) : undefined,
      bpm: tempo,
      timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: converted.fit.stats.bends > 3 || converted.fit.stats.overblows ? 3 : converted.fit.stats.bends ? 2 : 1,
      source: 'scan',
      tags: ['Quét'],
      notes: 'Quét từ ảnh khuông nhạc — nghe lại và sửa nếu có chỗ sai.',
    });
    await db.songs.put(song);
    toast('Đã lưu vào thư viện — kiểm tra lại rồi bấm Lưu bài');
    nav(`/song/${song.id}/edit`);
  };

  const noteCount = allNotes.filter((n) => !n.rest).length;

  return (
    <div className="ai-form">
      <div className="shots">
        {pages.length === 0 && grays.length < MAX_IMAGES && (
          <div className="shot-add">
            <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()} disabled={busy}><Icon name="camera" size={18} /> Chụp bản nhạc</button>
            <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()} disabled={busy}><Icon name="image" size={18} /> Chọn ảnh có sẵn</button>
            <p className="muted small">
              Máy tự đọc nốt ngay trên điện thoại — <strong>không cần mạng, không tốn tiền</strong>. Hợp với bản nhạc in khoá Sol, một bè giai điệu.
              Chụp thẳng, đủ sáng, cho bản nhạc lấp đầy khung hình.
            </p>
          </div>
        )}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      {busy && <><p className="muted small">Đang đọc nốt nhạc…</p><div className="progress" aria-hidden="true"><span /></div></>}
      {error && <div className="alert error" role="alert">{error} <button type="button" className="link-btn" onClick={reset}>Chọn ảnh khác</button></div>}

      {pages.length > 0 && (
        <>
          <div className="row between center wrap gap">
            <p className="small">
              Đọc được <strong>{noteCount} nốt</strong> trên {pages.reduce((t, p) => t + p.staves.length, 0)} khuông.
              {' '}Chạm vào nốt để sửa. Số trên nốt là lỗ kèn: <span className="tok-blow">cam = thổi</span>, <span className="tok-draw">xanh = hút</span>.
            </p>
            <div className="row gap">
              {grays.length < MAX_IMAGES && <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()}><Icon name="plus" size={18} /> Thêm trang</button>}
              <button type="button" className="btn btn-ghost" onClick={reset}>Làm lại</button>
            </div>
          </div>
          {offBars.size > 0 && (
            <div className="alert" role="note">
              Có {offBars.size} ô nhịp không đủ/thừa phách (vạch nhịp màu đỏ). Thường do máy đọc nhầm trường độ hoặc sót nốt — chạm vào nốt trong ô đó để sửa.
            </div>
          )}

          {pages.map((p, pi) => (
            <figure key={pi} className="scan-page">
              <div className="scan-stage">
                <PageCanvas image={p.image} />
                <svg viewBox={`0 0 ${p.image.width} ${p.image.height}`} className="scan-overlay" role="group" aria-label={`Trang ${pi + 1}`}>
                  {p.staves.map((st, si) => st.bars.map((bx, bi) => (
                    <line key={`b${si}-${bi}`} x1={bx} x2={bx} y1={st.top - st.space} y2={st.bottom + st.space}
                      className={offBars.has(`${pi}:${si}:${bi}`) || offBars.has(`${pi}:${si}:${bi + 1}`) ? 'bar bad' : 'bar'} />
                  )))}
                  {p.notes.map((n) => {
                    const st = p.staves[n.staff];
                    const tok = tokenOf.get(n.id);
                    const isDraw = !!tok && tok.startsWith('-');
                    return (
                      <g key={n.id} className={`onote${n.id === selected ? ' sel' : ''}${n.rest ? ' rest' : ''}`}
                        onClick={() => setSelected(n.id === selected ? null : n.id)}>
                        <circle cx={n.x} cy={n.y} r={st.space * 1.7} className="hit" />
                        <ellipse cx={n.x} cy={n.y} rx={st.space * 0.85} ry={st.space * 0.65} className="mark" />
                        <text x={n.x} y={st.top - st.space * 1.3} fontSize={st.space * 2.1} textAnchor="middle" className={n.rest ? 'tok-rest' : isDraw ? 'tok-draw' : 'tok-blow'}>
                          {n.rest ? '—' : tok ?? '×'}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              {pages.length > 1 && <figcaption>Trang {pi + 1}</figcaption>}
            </figure>
          ))}

          {sel && (
            <div className="scan-tools" role="toolbar" aria-label="Sửa nốt">
              <div className="row center gap">
                <strong className="grow">{sel.rest ? 'Dấu lặng' : notePitch(sel, keySig)}</strong>
                {!sel.rest && <>
                  <button type="button" className="chip" aria-label="Cao lên một bậc" onClick={() => moveStep(sel, 1)}>▲</button>
                  <button type="button" className="chip" aria-label="Thấp xuống một bậc" onClick={() => moveStep(sel, -1)}>▼</button>
                </>}
                <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Đóng"><Icon name="close" size={18} /></button>
              </div>
              <div className="row gap wrap center">
                {!sel.rest && ([[1, '♯'], [-1, '♭'], [0, '♮'], [null, 'Tự']] as const).map(([a, l]) => (
                  <button key={l} type="button" className={`chip${sel.accidental === a ? ' on' : ''}`} title={a === null ? 'Theo hoá biểu' : undefined}
                    onClick={() => editNote(sel.id, () => ({ accidental: a }))}>{l}</button>
                ))}
                <select className="chip-select" aria-label="Trường độ" value={sel.beats} onChange={(e) => editNote(sel.id, () => ({ beats: Number(e.target.value) }))}>
                  {(DURATIONS.some((d) => d.beats === sel.beats) ? DURATIONS : [...DURATIONS, { beats: sel.beats, label: `${sel.beats} phách` }])
                    .map((d) => <option key={d.beats} value={d.beats}>{d.label}</option>)}
                </select>
              </div>
              <div className="row gap wrap">
                <button type="button" className="chip" onClick={() => editNote(sel.id, (n) => ({ rest: !n.rest }))}>{sel.rest ? 'Thành nốt' : 'Thành lặng'}</button>
                <button type="button" className="chip" onClick={() => insertAfter(sel)}><Icon name="plus" size={16} /> Thêm sau</button>
                <button type="button" className="chip" onClick={() => { editNote(sel.id, () => null); setSelected(null); }}><Icon name="trash" size={16} /> Xoá</button>
              </div>
            </div>
          )}

          <div className="row gap wrap end-align">
            <label className="field grow">
              <span className="field-label">Tên bài</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Làng tôi" />
            </label>
            <label className="field">
              <span className="field-label">Hoá biểu</span>
              <select value={keySig} onChange={(e) => setKeySig(Number(e.target.value))}>
                {Array.from({ length: 15 }, (_, i) => i - 7).map((k) => <option key={k} value={k}>{keySigLabel(k)}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Nhịp</span>
              <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
                {(TIME_SIGS.includes(timeSig) ? TIME_SIGS : [timeSig, ...TIME_SIGS]).map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Tốc độ (bpm)</span>
              <input type="number" inputMode="numeric" min={30} max={260} value={tempo} onChange={(e) => setTempo(Math.min(260, Math.max(30, Number(e.target.value) || 90)))} />
            </label>
          </div>
          <div className="row gap wrap end-align">
            <KeySelect value={target} onChange={setTarget} allowAuto label="Chơi trên kèn" />
            {target !== 'auto' && (
              <label className="check">
                <input type="checkbox" checked={allowTranspose} onChange={(e) => setAllowTranspose(e.target.checked)} />
                Cho phép dịch giọng để dễ thổi
              </label>
            )}
          </div>

          {converted && parsed && (
            <section className="ai-result" aria-label="Tab">
              <div>
                <h2>{title.trim() || 'Bài quét'}</h2>
                <p className="muted">
                  Kèn {converted.harpKey}
                  {converted.fit.shift % 12 !== 0 && `, đã dịch giọng ${converted.fit.shift > 0 ? '+' : ''}${converted.fit.shift} nửa cung`}
                  {`, ${timeSig}, ${tempo} bpm`}
                </p>
              </div>
              <p className="small">
                {converted.fit.stats.natural} nốt thường, {converted.fit.stats.bends} nốt bend
                {converted.fit.stats.unplayable > 0 && `, ${converted.fit.stats.unplayable} nốt ngoài tầm kèn (×, đã thành dấu nghỉ)`}.
              </p>
              <div className="row gap">
                <MiniPlay p={player} />
                <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
              </div>
              <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function pageOf(pages: OmrPage[], n: OmrNote) {
  return pages.find((p) => p.notes.some((m) => m.id === n.id)) ?? pages[0];
}

/** Nhịp lấy đà: ô đầu tiên của bài ngắn hơn một ô nhịp */
function pickupOf(pages: OmrPage[], timeSig: string) {
  const p = pages[0];
  const st = p?.staves[0];
  if (!st) return 0;
  const end = st.bars.length ? st.bars[0] : Infinity;
  const first = p.notes.filter((n) => n.staff === 0 && n.x < end).reduce((t, n) => t + n.beats, 0);
  const want = barBeats(timeSig);
  return st.bars.length && first > 0 && first < want - 0.01 ? first : 0;
}
