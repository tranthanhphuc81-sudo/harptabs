import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_IMAGES } from '../../shared/ai';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey, HarpType, harpName } from '../lib/harp';
import { Gray, OmrNote, OmrPage, findHeaderBoxes, keyName, midiToStep, notePitch, readSheet, toGray, toTranscription } from '../lib/omr';
import { MIN_CONFIDENCE, cleanArtist, cleanTitle, cropToCanvas, hasDiacritics, looksLikeTitle, readLine, readWords, titleFromFilename } from '../lib/titleOcr';
import { assignSyllables, looksLikeLyrics, lyricBands, lyricSlots, relyric, staffLyrics, toSyllables } from '../lib/lyricOcr';
import { loadScanPages, saveScan, SongScan } from '../lib/scanStore';
import { scanDraftId } from '../lib/drafts';
import { isPdf, pdfToImages } from '../lib/pdf';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { difficultyOf } from '../lib/converter';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { ScanPageView } from '../components/ScanPageView';
import { RecordingCheck } from '../components/RecordingCheck';
import type { ScoreNote, Suggestion } from '../lib/audioAlign';
import { nameToMidi } from '../lib/harp';
import { useAppState } from '../state';

/** Ảnh chụp rất lớn thì thu nhỏ trước cho nhanh; bước đọc tự đưa về cỡ chuẩn */
const MAX_SIDE = 2600;
const TIME_SIGS = ['2/4', '3/4', '4/4', '6/8', '3/8', '2/2'];
const DURATIONS: { beats: number; label: string }[] = [
  { beats: 0.25, label: 'Móc kép' }, { beats: 1 / 3, label: 'Móc đơn liên ba' }, { beats: 0.5, label: 'Móc đơn' }, { beats: 2 / 3, label: 'Đen liên ba' },
  { beats: 0.75, label: 'Móc chấm' }, { beats: 1, label: 'Đen' }, { beats: 1.5, label: 'Đen chấm' }, { beats: 2, label: 'Trắng' },
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

/** Ảnh vùng chữ cắt từ bản nhạc + kết quả máy đọc */
type Shot = { url: string; status: 'reading' | 'ok' | 'unclear' | 'fail'; text?: string };

function ShotHint({ shot, what, value, onUse }: { shot: Shot; what: string; value: string; onUse: (t: string) => void }) {
  return (
    <span className="title-shot">
      <img src={shot.url} alt={`Vùng ${what} trên ảnh`} />
      <span className="muted small">
        {shot.status === 'reading' ? `Đang đọc ${what}…`
          : shot.status === 'ok' ? <>Máy đọc: <strong>{shot.text}</strong>{value !== shot.text && <> · <button type="button" className="link-btn" onClick={() => onUse(shot.text!)}>Dùng</button></>}</>
          : shot.status === 'unclear' ? 'Kiểu chữ này máy chưa đọc được — gõ theo ảnh trên'
          : 'Chưa đọc được chữ (lần đầu cần mạng để tải bộ đọc) — gõ theo ảnh trên'}
      </span>
    </span>
  );
}

const durIndex = (b: number) => DURATIONS.findIndex((d) => Math.abs(d.beats - b) < 0.01);

const keySigLabel = (k: number) => (k === 0 ? 'Không dấu hoá' : `${Math.abs(k)} dấu ${k > 0 ? 'thăng ♯' : 'giáng ♭'}`) + ` (${keyName(k)} trưởng)`;

/** editSongId: mở lại ảnh đã quét của một bài để sửa tiếp (lưu sẽ cập nhật bài đó) */
/** `initialFiles`: ảnh đã chọn ở chỗ khác (ô "File nhạc") — mở trang là quét luôn */
export default function ScanImport({ editSongId, initialFiles }: { editSongId?: string; initialFiles?: File[] }) {
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
  const [harpType, setHarpType] = useState<HarpType>(settings.defaultHarpType);
  const [allowTranspose, setAllowTranspose] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fromStore, setFromStore] = useState(false);
  /** tên bài tự điền (từ tên file / máy đọc chữ): người dùng sửa ô tên bài thì thôi không ghi đè */
  const autoTitle = useRef('');
  const fileTitle = useRef('');
  const [titleShot, setTitleShot] = useState<Shot | null>(null);
  const [artist, setArtist] = useState('');
  const autoArtist = useRef('');
  const [artistShot, setArtistShot] = useState<Shot | null>(null);

  // ───── bản quét dở: tự lưu để tắt app / tải lại trang không mất công sửa nốt ─────
  const draftKey = scanDraftId(editSongId);
  const [scanDraft, setScanDraft] = useState<SongScan | null>(null);
  /** trạng thái lúc vừa mở (trang trống / ảnh đã lưu / nháp vừa mở lại): khác đi mới là có sửa */
  const baseline = useRef<{ pages: OmrPage[]; meta: string }>({ pages: [], meta: '' });
  const meta = JSON.stringify({ keySig, timeSig, tempo, target, harpType, allowTranspose, title, artist });
  const dirty = pages.length > 0 && (pages !== baseline.current.pages || (baseline.current.meta !== '' && meta !== baseline.current.meta));
  const markBaseline = (ps: OmrPage[], m = '') => { baseline.current = { pages: ps, meta: m }; };

  useEffect(() => {
    if (initialFiles?.length) return;
    let alive = true;
    db.scans.get(draftKey).then((d) => { if (alive && d?.pages.length) setScanDraft(d); }).catch(() => {});
    return () => { alive = false; };
  }, [draftKey, initialFiles]);

  useEffect(() => {
    if (!dirty || busy) return;
    const t = window.setTimeout(() => {
      void saveScan(draftKey, pages, { keySig, timeSig, tempo, target, harpType, allowTranspose, tokens: {}, title, artist }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, [dirty, busy, draftKey, pages, keySig, timeSig, tempo, target, harpType, allowTranspose, title, artist]);

  const restoreScanDraft = async () => {
    const d = scanDraft;
    if (!d) return;
    setBusy(true);
    try {
      const ps = await loadScanPages(d);
      setPages(ps);
      setFromStore(true);
      setGrays([]);
      setSelected(null);
      setError(null);
      setKeySig(d.keySig); setTimeSig(d.timeSig); setTempo(d.tempo); setTarget(d.target);
      setHarpType(d.harpType ?? 'diatonic'); setAllowTranspose(d.allowTranspose);
      const t = d.title ?? title, a = d.artist ?? artist;
      setTitle(t); setArtist(a);
      markBaseline(ps, JSON.stringify({
        keySig: d.keySig, timeSig: d.timeSig, tempo: d.tempo, target: d.target,
        harpType: d.harpType ?? 'diatonic', allowTranspose: d.allowTranspose, title: t, artist: a,
      }));
      setScanDraft(null);
    } catch (e) {
      toast((e as Error).message || 'Không mở được bản quét dở');
    } finally {
      setBusy(false);
    }
  };
  const discardScanDraft = () => {
    setScanDraft(null);
    void db.scans.delete(draftKey).catch(() => {});
  };

  // mở lại bài đã quét
  useEffect(() => {
    if (!editSongId) return;
    let alive = true;
    (async () => {
      const [song, scan] = await Promise.all([db.songs.get(editSongId), db.scans.get(editSongId)]);
      if (!alive) return;
      if (!song || !scan) { setError('Bài này chưa có ảnh quét được lưu.'); return; }
      setBusy(true);
      try {
        const ps = await loadScanPages(scan);
        if (!alive) return;
        setPages(ps);
        markBaseline(ps, JSON.stringify({
          keySig: scan.keySig, timeSig: scan.timeSig, tempo: scan.tempo, target: scan.target,
          harpType: scan.harpType ?? song.harpType ?? 'diatonic', allowTranspose: scan.allowTranspose, title: song.title, artist: song.artist ?? '',
        }));
        setFromStore(true);
        setTitle(song.title);
        setArtist(song.artist ?? '');
        setKeySig(scan.keySig);
        setTimeSig(scan.timeSig);
        setTempo(scan.tempo);
        setTarget(scan.target);
        setHarpType(scan.harpType ?? song.harpType ?? 'diatonic');
        setAllowTranspose(scan.allowTranspose);
      } catch (e) {
        setError((e as Error).message || 'Không mở được ảnh đã lưu');
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [editSongId]);

  // ───── lời bài hát in dưới khuông: máy đọc chữ ngay trên máy, gắn từng âm tiết vào nốt ─────
  const [lyricProgress, setLyricProgress] = useState<{ done: number; total: number } | null>(null);
  const [lyricMsg, setLyricMsg] = useState<string | null>(null);
  const lyricRun = useRef(0);
  const setLyrics = (lyrics: Map<string, string>) => setPages((ps) => ps.map((p) => (
    p.notes.some((n) => lyrics.has(n.id))
      ? { ...p, notes: p.notes.map((n) => (lyrics.has(n.id) ? { ...n, lyric: lyrics.get(n.id) || undefined } : n)) }
      : p
  )));
  const readLyrics = async (ps: OmrPage[]) => {
    const run = ++lyricRun.current;
    const jobs = ps.flatMap((p) => p.staves.map((_, si) => ({ p, si })));
    setLyricMsg(null);
    setLyricProgress({ done: 0, total: jobs.length });
    let found = 0;
    for (let k = 0; k < jobs.length; k++) {
      const { p, si } = jobs[k];
      for (const band of lyricBands(p, si)) {
        const words = await readWords(cropToCanvas(p.image, band, 2), 2);
        if (run !== lyricRun.current) return;
        if (!words) { setLyricProgress(null); setLyricMsg('Chưa tải được bộ đọc chữ (cần mạng lần đầu) — thử lại sau, hoặc gõ lời vào ô bên dưới.'); return; }
        const syls = toSyllables(words.map((w) => ({ ...w, x0: w.x0 + band.x0, x1: w.x1 + band.x0 })));
        if (!looksLikeLyrics(syls)) continue;
        const lyrics = assignSyllables(lyricSlots(p.notes, si), syls);
        // khuông này: nốt không nhận âm tiết nào thì xoá lời cũ
        for (const n of lyricSlots(p.notes, si)) if (!lyrics.has(n.id)) lyrics.set(n.id, '');
        setLyrics(lyrics);
        found++;
        break;
      }
      setLyricProgress({ done: k + 1, total: jobs.length });
    }
    if (run !== lyricRun.current) return;
    setLyricProgress(null);
    setLyricMsg(found ? null : 'Không thấy lời in dưới khuông — gõ lời vào ô bên dưới nếu cần.');
  };

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
          void readLyrics(r.pages);
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

  const setAutoTitle = (t: string) => { autoTitle.current = t; setTitle(t); };

  const addFiles = async (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    if (!grays.length && !editSongId) {
      // tên file đặt có nghĩa (vd "nang-thuy-tinh.jpg") → điền ngay, máy đọc chữ có thể thay sau
      fileTitle.current = titleFromFilename(files[0].name);
      if (fileTitle.current && (!title || title === autoTitle.current)) setAutoTitle(fileTitle.current);
    }
    const room = MAX_IMAGES - grays.length;
    try {
      // file PDF: vẽ từng trang thành ảnh rồi quét như ảnh chụp
      const list: File[] = [];
      let skipped = 0;
      for (const f of Array.from(files)) {
        if (!isPdf(f)) { list.push(f); continue; }
        setBusy(true);
        try {
          const { images, total } = await pdfToImages(f, Math.max(0, room - list.length));
          list.push(...images);
          skipped += total - images.length;
        } finally { setBusy(false); }
      }
      if (list.length > room || skipped > 0) toast(`Tối đa ${MAX_IMAGES} trang mỗi lần — đã lấy ${Math.min(room, list.length)} trang đầu`);
      if (list.length) {
        const next = [...grays, ...(await Promise.all(list.slice(0, room).map(fileToGray)))];
        setGrays(next);
        setSelected(null);
        read(next);
      }
    } catch (e) {
      toast((e as Error).message);
    }
    if (camRef.current) camRef.current.value = '';
    if (galRef.current) galRef.current.value = '';
  };

  // ảnh chuyển sang từ ô "File nhạc": nạp một lần khi mở trang
  const took = useRef(false);
  useEffect(() => {
    if (took.current || !initialFiles?.length) return;
    took.current = true;
    void addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ nạp một lần khi mở trang
  }, [initialFiles]);

  const reset = () => {
    void db.scans.delete(draftKey).catch(() => {});
    lyricRun.current++;
    setLyricProgress(null); setLyricMsg(null);
    markBaseline([]);
    setGrays([]); setPages([]); setSelected(null); setError(null); setFromStore(false); setTitleShot(null); setArtistShot(null);
    if (title === autoTitle.current) setTitle('');
    if (artist === autoArtist.current) setArtist('');
    autoTitle.current = ''; fileTitle.current = ''; autoArtist.current = '';
  };

  // tên bài, tác giả: cắt vùng chữ phía trên khuông đầu, đọc chữ ngay trên máy
  const firstPage = pages[0];
  useEffect(() => {
    setTitleShot(null); setArtistShot(null);
    if (!firstPage || fromStore) return;
    const boxes = findHeaderBoxes(firstPage);
    let alive = true;
    const run = async (box: typeof boxes.title, setShot: (f: (s: Shot | null) => Shot | null) => void, clean: (t: string) => string, apply: (t: string) => void) => {
      if (!box) return;
      const canvas = cropToCanvas(firstPage.image, box);
      setShot(() => ({ url: canvas.toDataURL('image/png'), status: 'reading' }));
      const r = await readLine(canvas);
      if (!alive) return;
      if (!r) { setShot((t) => t && { ...t, status: 'fail' }); return; }
      const text = clean(r.text);
      const good = r.confidence >= MIN_CONFIDENCE && looksLikeTitle(text);
      setShot((t) => t && { ...t, status: good ? 'ok' : 'unclear', text });
      if (good) apply(text);
    };
    (async () => {
      // không ghi đè chữ người dùng gõ, hay tên file có dấu (người đặt tên đàng hoàng)
      await run(boxes.title, setTitleShot, cleanTitle, (text) => setTitle((cur) => {
        if (cur && cur !== autoTitle.current) return cur;
        if (cur && cur === fileTitle.current && hasDiacritics(cur)) return cur;
        autoTitle.current = text;
        return text;
      }));
      await run(boxes.artist, setArtistShot, cleanArtist, (text) => setArtist((cur) => {
        if (cur && cur !== autoArtist.current) return cur;
        autoArtist.current = text;
        return text;
      }));
    })();
    return () => { alive = false; };
  }, [firstPage, fromStore]);

  // ───── sửa nốt ─────
  const allNotes = useMemo(() => pages.flatMap((p) => p.notes), [pages]);
  const sel = allNotes.find((n) => n.id === selected) ?? null;
  const editNote = (id: string, change: (n: OmrNote) => Partial<OmrNote> | null) => {
    setPages((ps) => ps.map((p) => ({
      ...p,
      notes: p.notes.flatMap((n) => {
        if (n.id !== id) return [n];
        const c = change(n);
        return c === null ? [] : [{ ...n, ...c, guess: false }];
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
  const converted = useMemo(() => (transcription ? aiToTab(transcription, target, allowTranspose, harpType) : null), [transcription, target, allowTranspose, harpType]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey, converted.harpType) : null), [converted]);
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
    let i = 0;
    let last: OmrNote | null = null;
    for (const n of order) {
      // giống toTranscription: nốt nối cùng cao độ được gộp vào nốt trước
      if (n.tied && !n.rest && last && notePitch(last, keySig) === notePitch(n, keySig)) { m.set(n.id, '⌒'); continue; }
      m.set(n.id, converted.fit.tokens[i++] ?? null);
      last = n.rest ? null : n;
    }
    return m;
  }, [pages, converted, keySig]);

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

  /** ô nhịp có dấu lặng máy tự chèn (key trang:khuông:ô) */
  const guessBars = useMemo(() => {
    const out = new Set<string>();
    pages.forEach((p, pi) => p.staves.forEach((st, si) => {
      const edges = [-Infinity, ...st.bars, Infinity];
      p.notes.filter((n) => n.staff === si && n.guess).forEach((n) => {
        const i = edges.findIndex((e, k) => k < edges.length - 1 && e < n.x && n.x < edges[k + 1]);
        if (i >= 0) out.add(`${pi}:${si}:${i}`);
      });
    }));
    return out;
  }, [pages]);
  const guessCount = allNotes.filter((n) => n.guess).length;

  // ───── đối chiếu với bản thu ─────
  /** nốt theo thứ tự chơi (gộp nốt nối), vị trí để hiện ("Khuông 2, nốt 5") */
  const checkData = useMemo(() => {
    const score: ScoreNote[] = [];
    const where = new Map<string, string>();
    let staffNo = 0;
    pages.forEach((p, pi) => p.staves.forEach((st, si) => {
      staffNo++;
      const edges = [-Infinity, ...st.bars, Infinity];
      p.notes.filter((n) => n.staff === si).sort((a, b) => a.x - b.x).forEach((n, k) => {
        where.set(n.id, `Khuông ${staffNo}, nốt ${k + 1}`);
        const midi = n.rest ? null : nameToMidi(notePitch(n, keySig));
        const prev = score[score.length - 1];
        if (n.tied && midi !== null && prev && prev.midi === midi) { prev.beats += n.beats; return; }
        const bar = edges.findIndex((e, i) => i < edges.length - 1 && e < n.x && n.x < edges[i + 1]);
        score.push({ id: n.id, midi, beats: n.beats, guess: n.guess, bar: `${pi}:${si}:${bar}` });
      });
    }));
    return { score, where };
  }, [pages, keySig]);

  /** áp dụng gợi ý từ bản thu: sửa cao độ, biến dấu lặng thành nốt, thêm nốt sót, bỏ nốt thừa, sửa trường độ */
  const applySuggestions = (list: Suggestion[]) => {
    setPages((ps) => {
      const next = ps.map((p) => ({ ...p, notes: [...p.notes] }));
      const find = (id: string) => {
        for (const p of next) { const i = p.notes.findIndex((n) => n.id === id); if (i >= 0) return { p, i, n: p.notes[i] }; }
        return null;
      };
      const pitchFields = (p: OmrPage, n: OmrNote, midi: number) => {
        const st = p.staves[n.staff];
        const { step, accidental } = midiToStep(midi, keySig);
        return { step, accidental, y: st.bottom - (step * st.space) / 2, rest: false, guess: false };
      };
      for (const s of list) {
        if (s.kind === 'missing') {
          const f = find(s.afterId);
          if (!f) continue;
          const st = f.p.staves[f.n.staff];
          const after = f.p.notes.filter((m) => m.staff === f.n.staff && m.x > f.n.x).sort((a, b) => a.x - b.x)[0];
          let x = after ? (f.n.x + after.x) / 2 : Math.min(f.n.x + 2 * st.space, st.xRight - st.space);
          // máy sót cả ô nhịp (ô trống giữa hai nốt): đặt nốt vào giữa ô trống đó
          const edges = [...st.bars, st.xRight];
          for (let b = 0; b + 1 < edges.length; b++) {
            const [a0, a1] = [edges[b], edges[b + 1]];
            if (a0 > f.n.x && a1 <= (after ? after.x : st.xRight + 1) && !f.p.notes.some((m) => m.staff === f.n.staff && m.x > a0 && m.x < a1)) { x = (a0 + a1) / 2; break; }
          }
          f.p.notes.push({ ...f.n, id: `rec${Date.now()}${Math.round(s.at * 1000)}`, x, tied: false, beats: s.beats, hollow: s.beats >= 2, dot: [0.75, 1.5, 3].includes(s.beats), ...pitchFields(f.p, f.n, s.to) });
          continue;
        }
        const f = find(s.noteId);
        if (!f) continue;
        if (s.kind === 'extra') { f.p.notes.splice(f.i, 1); continue; }
        if (s.kind === 'duration') { f.p.notes[f.i] = { ...f.n, beats: s.to, dot: [0.75, 1.5, 3].includes(s.to), hollow: s.to >= 2, guess: false }; continue; }
        f.p.notes[f.i] = { ...f.n, ...pitchFields(f.p, f.n, s.to) };
      }
      for (const p of next) p.notes.sort((a, b) => a.staff - b.staff || a.x - b.x);
      return next;
    });
    toast(`Đã sửa ${list.length} chỗ theo bản thu — nghe thử lại để kiểm tra`);
  };

  const save = async () => {
    if (!converted) return;
    const fields = {
      title: title.trim() || 'Bài quét',
      artist: artist.trim() || undefined,
      harpKey: converted.harpKey,
      harpType: converted.harpType === 'diatonic' ? undefined : converted.harpType,
      songKey: converted.fit.shift % 12 === 0 ? keyName(keySig) : undefined,
      bpm: tempo,
      timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: difficultyOf(converted.fit.stats),
    };
    const existing = editSongId ? await db.songs.get(editSongId) : undefined;
    const song = existing
      ? { ...existing, ...fields, updatedAt: Date.now() }
      : blankSong({ ...fields, source: 'scan', tags: ['Quét'], notes: 'Quét từ ảnh khuông nhạc — nghe lại và sửa nếu có chỗ sai.' });
    try {
      // ảnh + vị trí nốt + số lỗ kèn được lưu kèm bài để mở lại xem / sửa trên ảnh
      const tokens: Record<string, string | null> = {};
      tokenOf.forEach((v, k) => { tokens[k] = v; });
      await saveScan(song.id, pages, { keySig, timeSig, tempo, target, harpType, allowTranspose, tokens });
    } catch {
      toast('Không lưu được ảnh quét (bộ nhớ đầy?) — tab vẫn được lưu');
    }
    await db.songs.put(song);
    markBaseline(pages, meta);
    await db.scans.delete(draftKey).catch(() => {});
    if (existing) {
      toast('Đã cập nhật bài');
      nav(`/song/${song.id}`, { replace: true });
    } else {
      toast('Đã lưu vào thư viện kèm ảnh quét — kiểm tra lại rồi bấm Lưu bài');
      nav(`/song/${song.id}/edit`);
    }
  };

  const noteCount = allNotes.filter((n) => !n.rest).length;

  return (
    <div className="ai-form">
      <div className="shots">
        {pages.length === 0 && !busy && grays.length < MAX_IMAGES && (
          <div className="shot-add">
            <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()} disabled={busy}><Icon name="camera" size={18} /> Chụp bản nhạc</button>
            <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()} disabled={busy}><Icon name="image" size={18} /> Chọn ảnh / PDF có sẵn</button>
            <p className="muted small">
              Máy tự đọc nốt ngay trên điện thoại — <strong>không cần mạng, không tốn tiền</strong>. Hợp với bản nhạc in khoá Sol, một bè giai điệu.
              Chụp thẳng, đủ sáng, cho bản nhạc lấp đầy khung hình.
            </p>
          </div>
        )}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      {scanDraft && !dirty && !busy && (
        <div className="notice" role="status">
          <span>
            Có bản quét dở chưa lưu ({scanDraft.pages.length} trang{scanDraft.title ? <>, <strong>{scanDraft.title}</strong></> : ''}) lúc {new Date(scanDraft.savedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}.
            {' '}Quét ảnh mới sẽ thay bản này.
          </span>
          <span className="row gap">
            <button type="button" className="btn btn-primary btn-sm" onClick={restoreScanDraft}>Mở lại</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={discardScanDraft}>Bỏ</button>
          </span>
        </div>
      )}
      {busy && <><p className="muted small">Đang đọc nốt nhạc…</p><div className="progress" aria-hidden="true"><span /></div></>}
      {error && <div className="alert error" role="alert">{error} <button type="button" className="link-btn" onClick={reset}>Chọn ảnh khác</button></div>}

      {pages.length > 0 && (
        <>
          <div className="row between center wrap gap">
            <p className="small">
              Đọc được <strong>{noteCount} nốt</strong> trên {pages.reduce((t, p) => t + p.staves.length, 0)} khuông.
              {' '}Chạm vào nốt để sửa. Số trên nốt là lỗ kèn: <span className="tok-blow">cam = thổi</span>, <span className="tok-draw">xanh = hút</span>.
            </p>
            <div className="row gap wrap">
              <div className="segmented" role="group" aria-label="Phóng to ảnh">
                {[1, 2, 3].map((z) => <button key={z} type="button" className={zoom === z ? 'on' : ''} aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z}×</button>)}
              </div>
              {!fromStore && grays.length < MAX_IMAGES && <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()}><Icon name="plus" size={18} /> Thêm trang</button>}
              <button type="button" className="btn btn-ghost" onClick={reset}>{fromStore ? 'Quét ảnh khác' : 'Làm lại'}</button>
            </div>
          </div>
          {guessCount > 0 && (
            <div className="alert" role="note">
              Máy tự chèn {guessCount} dấu lặng (dấu <strong>?</strong> màu cam) vào ô thiếu phách. Có thể đó là chỗ máy <strong>sót nốt</strong> — hãy so với bản nhạc, nếu đúng là nốt thì chạm vào, bấm “Thành nốt” và chỉnh cao độ.
            </div>
          )}
          {offBars.size > 0 && (
            <div className="alert" role="note">
              Có {offBars.size} ô nhịp không đủ/thừa phách (vạch nhịp màu đỏ). Thường do máy đọc nhầm trường độ hoặc sót nốt — chạm vào nốt trong ô đó để sửa.
            </div>
          )}

          <RecordingCheck score={checkData.score} meter={barBeats(timeSig)} label={(id) => checkData.where.get(id) ?? 'Nốt'} onApply={applySuggestions} onFocus={setSelected} />

          {pages.map((p, pi) => (
            <figure key={pi} className="scan-page">
              <ScanPageView image={p.image} staves={p.staves} notes={p.notes} tokenOf={(id) => tokenOf.get(id)} zoom={zoom}
                label={`Trang ${pi + 1}`} selected={selected} onSelect={setSelected} offBars={offBars} guessBars={guessBars} page={pi} />
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
                <select className="chip-select" aria-label="Trường độ" value={durIndex(sel.beats)} onChange={(e) => editNote(sel.id, () => ({ beats: DURATIONS[Number(e.target.value)]?.beats ?? sel.beats }))}>
                  {DURATIONS.map((d, i) => <option key={d.label} value={i}>{d.label}</option>)}
                  {durIndex(sel.beats) === -1 && <option value={-1}>{`${+sel.beats.toFixed(2)} phách`}</option>}
                </select>
              </div>
              <div className="row gap wrap">
                <button type="button" className="chip" onClick={() => editNote(sel.id, (n) => ({ rest: !n.rest }))}>{sel.rest ? 'Thành nốt' : 'Thành lặng'}</button>
                {!sel.rest && <button type="button" className={`chip${sel.tied ? ' on' : ''}`} title="Dấu nối: cộng trường độ vào nốt trước cùng cao độ" onClick={() => editNote(sel.id, (n) => ({ tied: !n.tied }))}>⌒ Nối nốt trước</button>}
                <button type="button" className="chip" onClick={() => insertAfter(sel)}><Icon name="plus" size={16} /> Thêm sau</button>
                <button type="button" className="chip" onClick={() => { editNote(sel.id, () => null); setSelected(null); }}><Icon name="trash" size={16} /> Xoá</button>
              </div>
            </div>
          )}

          <section className="scan-lyrics" aria-label="Lời bài hát">
            <div className="row between center wrap gap">
              <strong>Lời bài hát</strong>
              {lyricProgress
                ? <span className="muted small" role="status">Đang đọc lời… {lyricProgress.done}/{lyricProgress.total} khuông</span>
                : <button type="button" className="btn btn-ghost btn-sm" onClick={() => void readLyrics(pages)}>Đọc lời trên ảnh</button>}
            </div>
            <p className="muted small">
              {lyricMsg ?? 'Mỗi ô là lời dưới một khuông, các chữ cách nhau bằng dấu cách — chữ thứ mấy vào nốt có lời thứ mấy. Máy đọc có thể sai dấu: sửa lại cho đúng rồi nghe thử.'}
            </p>
            {pages.map((p, pi) => p.staves.map((_, si) => {
              const no = pages.slice(0, pi).reduce((t, q) => t + q.staves.length, 0) + si + 1;
              return (
                <LyricRow key={`${pi}:${si}`} label={`Khuông ${no}`} value={staffLyrics(p.notes, si)}
                  onCommit={(text) => setLyrics(relyric(lyricSlots(p.notes, si), text))} />
              );
            }))}
          </section>

          <div className="row gap wrap end-align">
            <label className="field grow">
              <span className="field-label">Tên bài</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Làng tôi" />
              {titleShot && <ShotHint shot={titleShot} what="tên bài" value={title} onUse={setAutoTitle} />}
            </label>
            <label className="field grow">
              <span className="field-label">Tác giả</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ví dụ: Trịnh Công Sơn" />
              {artistShot && <ShotHint shot={artistShot} what="tên tác giả" value={artist} onUse={(t) => { autoArtist.current = t; setArtist(t); }} />}
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
            <HarpTypeSelect value={harpType} onChange={setHarpType} />
            <KeySelect value={target} onChange={setTarget} allowAuto label="Chơi trên kèn" harpType={harpType} />
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
                  {harpName(converted.harpKey, converted.harpType)}
                  {converted.fit.shift % 12 !== 0 && `, đã dịch giọng ${converted.fit.shift > 0 ? '+' : ''}${converted.fit.shift} nửa cung`}
                  {`, ${timeSig}, ${tempo} bpm`}
                </p>
              </div>
              <p className="small">
                {converted.fit.stats.natural} nốt thường, {converted.fit.stats.bends} nốt bend
                {converted.fit.stats.unplayable > 0 && `, ${converted.fit.stats.unplayable} nốt ngoài tầm kèn (×, đã thành dấu nghỉ)`}.
              </p>
              <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={converted.harpType} />
              <div className="row gap preview-actions">
                <MiniPlay p={player} />
                <button type="button" className="btn btn-primary" onClick={save}>{editSongId ? 'Lưu thay đổi' : 'Lưu vào thư viện'}</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Lời một khuông: gõ thoải mái, rời ô (hoặc Enter) mới chia lại vào các nốt */
function LyricRow({ label, value, onCommit }: { label: string; value: string; onCommit: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const commit = () => { editing.current = false; if (draft.trim() !== value) onCommit(draft); };
  return (
    <label className="field lyric-row">
      <span className="field-label">{label}</span>
      <input value={draft} placeholder="(không có lời)" lang="vi"
        onFocus={() => { editing.current = true; }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
    </label>
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
