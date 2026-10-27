import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blankSong, db } from '../lib/db';
import { parseSheet, serializeSheet, sheetChords, sheetSlots } from '../lib/chordSheet';
import { parseChord } from '../audio/harmony';
import { SheetView } from '../components/SheetView';
import { ChordStrip } from '../components/Fretboard';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';
import type { BeatStyle } from '../audio/patterns';
import type { HarpType } from '../lib/harp';

const EXAMPLE = `Tên bài hát
[C]Dòng lời thứ nhất [G]có hợp âm
[Am]Dòng lời thứ hai [F]hát tiếp

ĐK:
[C]Điệp khúc [G]ở đây`;

/** giọng bài đoán từ hợp âm: bài thường mở và kết bằng hợp âm chủ, lại hay quay về nó — chấm điểm theo số lần + đầu / cuối bài */
function guessKey(chords: string[]): string | undefined {
  const score = new Map<string, number>();
  chords.forEach((c, i) => score.set(c, (score.get(c) ?? 0) + 1 + (i === 0 ? 2 : 0) + (i === chords.length - 1 ? 2 : 0)));
  const top = [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const c = parseChord(top ?? '');
  if (!c || c.root < 0) return undefined;
  return c.name.replace(/(maj7|m7b5|dim7|m7|7)$/, (q) => (q.startsWith('m') && q !== 'maj7' ? 'm' : ''));
}

/** Dán bài lời + hợp âm (copy từ trang hợp âm, sổ tay): không cần giai điệu, phát nền theo hợp âm để tập đệm hát */
export default function ChordPaste() {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [artist, setArtist] = useState('');
  const [timeSig, setTimeSig] = useState('4/4');
  const [perChord, setPerChord] = useState<'half' | 'bar' | 'two'>('bar');
  const [bpm, setBpm] = useState(80);

  const sheet = useMemo(() => (text.trim() ? parseSheet(text) : null), [text]);
  const chords = useMemo(() => (sheet ? sheetChords(sheet.lines) : []), [sheet]);
  const bpb = Number(timeSig.split('/')[0]) || 4;
  const beats = perChord === 'half' ? bpb / 2 : perChord === 'two' ? bpb * 2 : bpb;
  const slots = useMemo(() => (sheet ? sheetSlots(sheet.lines, beats) : []), [sheet, beats]);
  const songTitle = title ?? sheet?.title ?? '';
  const type: HarpType = settings.defaultHarpType === 'ukulele4' ? 'ukulele4' : 'guitar6';

  const pasteFromClipboard = async () => {
    try { setText(await navigator.clipboard.readText()); } catch { toast('Trình duyệt không cho đọc bộ nhớ tạm — nhấn giữ ô bên dưới rồi chọn Dán'); }
  };

  const save = async () => {
    if (!sheet || !chords.length) return;
    const style: BeatStyle = bpb === 3 ? 'waltz' : bpb === 6 ? 'slowrock' : 'ballad';
    const song = blankSong({
      title: songTitle.trim() || 'Bài hợp âm',
      artist: artist.trim() || undefined,
      harpKey: 'C',
      harpType: type,
      timeSig,
      bpm,
      style,
      songKey: guessKey(chords),
      sheet: serializeSheet(sheet.lines),
      sheetBeats: beats === bpb ? undefined : beats,
      tags: ['hợp âm'],
      source: 'import',
    });
    await db.songs.put(song);
    toast(`Đã lưu "${song.title}"`);
    nav(`/song/${song.id}`);
  };

  return (
    <div className="chord-paste">
      <p className="muted small">
        Dán bài <strong>lời + hợp âm</strong> copy từ trang hợp âm hay sổ tay. App nhận cả kiểu <code>[Am]lời [F]lời</code> và kiểu
        dòng hợp âm nằm trên dòng lời. Bài không cần giai điệu: app phát nhạc đệm theo hợp âm, có capo và sơ đồ hợp âm.
      </p>
      <div className="row gap wrap">
        <button type="button" className="btn btn-ghost" onClick={pasteFromClipboard}><Icon name="download" size={18} /> Dán từ bộ nhớ</button>
        {!text && <button type="button" className="btn btn-ghost" onClick={() => setText(EXAMPLE)}>Xem ví dụ</button>}
      </div>
      <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'Am          F\nEm ơi Hà    Nội phố\n\nhoặc\n\n[Am]Em ơi Hà [F]Nội phố'} aria-label="Bài lời + hợp âm" spellCheck={false} />

      {sheet && (
        chords.length === 0
          ? <p className="alert">Chưa thấy hợp âm nào. Viết hợp âm trong ngoặc vuông <code>[C]</code> hoặc trên một dòng riêng nằm trên dòng lời.</p>
          : <>
            <div className="row gap wrap end-align">
              <label className="field"><span className="field-label">Tên bài</span>
                <input value={songTitle} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bài hát" /></label>
              <label className="field"><span className="field-label">Tác giả</span>
                <input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
              <label className="field"><span className="field-label">Nhịp</span>
                <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
                  <option value="4/4">4/4</option><option value="3/4">3/4</option><option value="6/8">6/8</option><option value="2/4">2/4</option>
                </select></label>
              <label className="field"><span className="field-label">Mỗi hợp âm</span>
                <select value={perChord} onChange={(e) => setPerChord(e.target.value as typeof perChord)}>
                  {bpb % 2 === 0 && <option value="half">Nửa ô nhịp</option>}
                  <option value="bar">Một ô nhịp</option>
                  <option value="two">Hai ô nhịp</option>
                </select></label>
              <label className="field"><span className="field-label">Tempo</span>
                <input type="number" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 80)} /></label>
            </div>
            <p className="small muted">{chords.length} hợp âm{sheet.title ? `, tên bài nhận được: “${sheet.title}”` : ''}. Xem trước:</p>
            <ChordStrip names={chords} inst={type === 'ukulele4' ? 'ukulele' : 'guitar'} />
            <SheetView lines={sheet.lines} slots={slots} capo={0} active={null} onSeek={() => undefined} />
            <button type="button" className="btn btn-primary btn-lg" onClick={save}>Lưu bài</button>
          </>
      )}
    </div>
  );
}
