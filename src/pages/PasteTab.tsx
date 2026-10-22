import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blankSong, db } from '../lib/db';
import { HarpKey, HarpType } from '../lib/harp';
import { difficultyOf } from '../lib/converter';
import { importTabText } from '../lib/tabImport';
import { countTechniques, flatten, parseTab } from '../lib/tabText';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
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
  const [type, setType] = useState<HarpType | null>(null); // null = đoán từ ký hiệu trong bài
  const [tempo, setTempo] = useState(90);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /** mở trang tìm kiếm tab harmonica trong trình duyệt; người dùng copy / chia sẻ tab về app */
  const searchTabs = () => {
    const q = query.trim();
    if (!q) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(`${q} harmonica tab`)}`, '_blank', 'noopener');
  };

  // nội dung chia sẻ từ app khác (xem main.tsx)
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem('harptabs-shared'); sessionStorage.removeItem('harptabs-shared'); } catch { /* bỏ qua */ }
    if (!raw) return;
    const { title: t, text: body, url } = JSON.parse(raw) as { title: string; text: string; url: string };
    // trình duyệt hay gửi kèm đường dẫn trang ở cuối nội dung
    const link = url || /(https?:\/\/\S+)\s*$/.exec(body)?.[1] || '';
    const content = body.replace(/\s*https?:\/\/\S+\s*$/, '').trim();
    if (content) { setText(t && !content.includes(t) ? `${t}\n${content}` : content); setTitle(null); setKey(null); setType(null); }
    if (link) setSharedUrl(link);
  }, []);

  const imp = useMemo(() => (text.trim() ? importTabText(text, type ?? undefined) : null), [text, type]);
  const harpKey: HarpKey = key ?? imp?.harpKey ?? 'C';
  const harpType: HarpType = imp?.harpType ?? 'diatonic';
  const songTitle = title ?? imp?.title ?? '';
  const parsed = useMemo(() => (imp?.body ? parseTab(imp.body, harpKey, harpType) : null), [imp, harpKey, harpType]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: tempo, tempoScale: 1, beatsPerBar: 4, pickupBeats: 0, style: 'none', melody: true, beat: false, click: false, countIn: false,
  });
  const hasDurations = !!imp && /:\d/.test(imp.body);

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { toast('Bộ nhớ tạm đang trống — hãy copy tab trên trang web trước'); return; }
      setText(t); setTitle(null); setKey(null); setType(null);
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
      harpType: harpType === 'diatonic' ? undefined : harpType,
      bpm: tempo,
      timeSig: '4/4',
      style: hasDurations ? 'ballad' : 'none',
      body: imp.body,
      difficulty: difficultyOf(t),
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
      <form className="row gap wrap end-align" onSubmit={(e) => { e.preventDefault(); searchTabs(); }}>
        <label className="field grow">
          <span className="field-label">Tìm tab trên mạng</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên bài, ví dụ: Tie a yellow ribbon" enterKeyHint="search" />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={!query.trim()}><Icon name="search" size={18} /> Tìm</button>
      </form>
      <p className="muted small">
        Mở trang có tab, <strong>bôi đen phần tab → Chia sẻ → Harp Tab</strong>, hoặc Sao chép rồi quay lại bấm “Dán từ bộ nhớ”.
        Copy tab harmonica trên trang web (kiểu <code>4 -4 5 -5</code>, <code>4↑ 4↓</code>, <code>B4 D4</code>, <code>-3b</code>…) rồi dán vào đây.
        App tự nhận dòng tab, lời bài hát, tên bài và tông kèn nếu có ghi.
      </p>
      <div className="row gap wrap">
        <button type="button" className="btn btn-primary" onClick={pasteFromClipboard}><Icon name="download" size={18} /> Dán từ bộ nhớ</button>
        {text && <button type="button" className="btn btn-ghost" onClick={() => { setText(''); setTitle(null); setKey(null); }}>Xoá</button>}
      </div>
      {sharedUrl && !text && (
        <div className="alert" role="note">
          Bạn vừa chia sẻ <strong>đường dẫn trang</strong>, chưa có nội dung tab. Hãy mở trang, <strong>bôi đen phần tab</strong> rồi bấm Chia sẻ → Harp Tab
          (hoặc Sao chép rồi bấm “Dán từ bộ nhớ”). <a href={sharedUrl} target="_blank" rel="noreferrer">Mở lại trang</a>
        </div>
      )}
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
              <HarpTypeSelect value={harpType} onChange={setType} label="Loại kèn trong bài" />
              <KeySelect value={harpKey} onChange={(k) => k !== 'auto' && setKey(k)} label="Kèn trong bài" />
              <label className="field">
                <span className="field-label">Tốc độ (bpm)</span>
                <input type="number" inputMode="numeric" min={30} max={260} value={tempo} onChange={(e) => setTempo(Math.min(260, Math.max(30, Number(e.target.value) || 90)))} />
              </label>
            </div>
            {parsed && (
              <section className="ai-result" aria-label="Xem trước">
                {!hasDurations && <p className="small muted">Mẹo: mở bài rồi bật <strong>Chờ nốt</strong> — app chờ bạn thổi đúng mới chuyển nốt, không cần nhịp.</p>}
                <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
                <div className="row gap preview-actions">
                  <MiniPlay p={player} />
                  <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
                </div>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
