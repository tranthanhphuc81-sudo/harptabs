import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blankSong, db } from '../lib/db';
import { HarpKey } from '../lib/harp';
import { importTabText } from '../lib/tabImport';
import { countTechniques, flatten, parseTab } from '../lib/tabText';
import { KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/** Dán tab harmonica copy từ trang web / tin nhắn → chuyển sang định dạng của app */
export default function PasteTab() {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [title, setTitle] = useState<string | null>(null); // null = dùng tên tự nhận
  const [key, setKey] = useState<HarpKey | null>(null); // null = dùng tông tự nhận (hoặc C)
  const [tempo, setTempo] = useState(90);

  const imp = useMemo(() => (text.trim() ? importTabText(text) : null), [text]);
  const harpKey: HarpKey = key ?? imp?.harpKey ?? 'C';
  const songTitle = title ?? imp?.title ?? '';
  const parsed = useMemo(() => (imp?.body ? parseTab(imp.body, harpKey) : null), [imp, harpKey]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: tempo, tempoScale: 1, beatsPerBar: 4, pickupBeats: 0, style: 'none', melody: true, beat: false, click: false, countIn: false,
  });
  const hasDurations = !!imp && /:\d/.test(imp.body);

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { toast('Bộ nhớ tạm đang trống — hãy copy tab trên trang web trước'); return; }
      setText(t); setTitle(null); setKey(null);
    } catch {
      toast('Không đọc được bộ nhớ tạm — nhấn giữ vào ô bên dưới rồi chọn Dán');
    }
  };

  const save = async () => {
    if (!imp || !parsed || !imp.notes) return;
    const t = countTechniques(parsed);
    const song = blankSong({
      title: songTitle.trim() || 'Bài dán',
      harpKey,
      bpm: tempo,
      timeSig: '4/4',
      style: hasDurations ? 'ballad' : 'none',
      body: imp.body,
      difficulty: t.bends > 3 || t.overblows ? 3 : t.bends ? 2 : 1,
      source: 'import',
      tags: ['Dán tab'],
      notes: hasDurations ? undefined : 'Tab dán từ mạng không ghi trường độ (mỗi nốt 1 phách) — tập bằng "Chờ nốt" hoặc chỉnh độ dài trong Sửa bài.',
    });
    await db.songs.put(song);
    toast('Đã lưu vào thư viện');
    nav(`/song/${song.id}`);
  };

  return (
    <div className="ai-form">
      <p className="muted small">
        Copy tab harmonica trên trang web (kiểu <code>4 -4 5 -5</code>, <code>4↑ 4↓</code>, <code>B4 D4</code>, <code>-3b</code>…) rồi dán vào đây.
        App tự nhận dòng tab, lời bài hát, tên bài và tông kèn nếu có ghi.
      </p>
      <div className="row gap wrap">
        <button type="button" className="btn btn-primary" onClick={pasteFromClipboard}><Icon name="download" size={18} /> Dán từ bộ nhớ</button>
        {text && <button type="button" className="btn btn-ghost" onClick={() => { setText(''); setTitle(null); setKey(null); }}>Xoá</button>}
      </div>
      <label className="field">
        <span className="field-label">Nội dung tab</span>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
          placeholder={'Ví dụ:\nTwinkle Twinkle Little Star\nKey: C\n4 4 6 6 -6 -6 6\nTwin-kle twin-kle lit-tle star'} />
      </label>

      {imp && (
        imp.notes === 0 ? (
          <div className="alert error" role="alert">Không thấy dòng tab nào. Tab cần có số lỗ kèn 1–10, ví dụ <code>4 -4 5 -5 6</code>.</div>
        ) : (
          <>
            <p className="small">
              Nhận được <strong>{imp.tabLines} dòng tab, {imp.notes} nốt</strong>
              {imp.harpKey && <> · tông kèn ghi trong bài: <strong>{imp.harpKey}</strong></>}
              {!hasDurations && ' · không có trường độ, mỗi nốt tính 1 phách'}.
            </p>
            {imp.unknown.length > 0 && (
              <div className="alert" role="note">
                Bỏ qua các ký hiệu không hiểu: {imp.unknown.map((u) => <code key={u}>{u}</code>).reduce<React.ReactNode[]>((a, c, i) => (i ? [...a, ' ', c] : [c]), [])}.
                Nếu là nốt, hãy sửa trong ô trên hoặc sau khi lưu.
              </div>
            )}
            <div className="row gap wrap end-align">
              <label className="field grow">
                <span className="field-label">Tên bài</span>
                <input value={songTitle} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bài hát" />
              </label>
              <KeySelect value={harpKey} onChange={(k) => k !== 'auto' && setKey(k)} label="Kèn trong bài" />
              <label className="field">
                <span className="field-label">Tốc độ (bpm)</span>
                <input type="number" inputMode="numeric" min={30} max={260} value={tempo} onChange={(e) => setTempo(Math.min(260, Math.max(30, Number(e.target.value) || 90)))} />
              </label>
            </div>
            {parsed && (
              <section className="ai-result" aria-label="Xem trước">
                <div className="row gap">
                  <MiniPlay p={player} />
                  <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
                </div>
                {!hasDurations && <p className="small muted">Mẹo: mở bài rồi bật <strong>Chờ nốt</strong> — app chờ bạn thổi đúng mới chuyển nốt, không cần nhịp.</p>}
                <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
