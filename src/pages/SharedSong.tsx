import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import { harpName, harpTypeOf, songTonality } from '../lib/harp';
import { decodeSong } from '../lib/share';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar, Song } from '../lib/types';
import { KeyPlate } from '../components/KeySelect';
import { MiniPlay } from '../components/PlayerBar';
import { TabView } from '../components/TabView';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/** Mở link bài được chia sẻ: xem trước, nghe thử, rồi thêm vào thư viện */
export default function SharedSong() {
  const [params] = useSearchParams();
  const d = params.get('d');
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!d) setSong(null);
    else void decodeSong(d).then((s) => { if (alive) setSong(s); });
    return () => { alive = false; };
  }, [d]);

  if (song === undefined) return <div className="page"><p className="muted">Đang mở bài được chia sẻ…</p></div>;
  if (!song) {
    return (
      <div className="page">
        <div className="alert error" role="alert">Link chia sẻ bị hỏng hoặc thiếu (có thể app nhắn tin đã cắt bớt). Nhờ người gửi chia sẻ lại.</div>
        <Link to="/" className="btn btn-ghost">Về thư viện</Link>
      </div>
    );
  }
  return <Preview song={song} />;
}

function Preview({ song }: { song: Song }) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const type = harpTypeOf(song);
  const parsed = useMemo(() => parseTab(song.body, song.harpKey, type), [song.body, song.harpKey, type]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const player = usePlayer(flat, {
    bpm: song.bpm, tempoScale: 1, beatsPerBar: beatsPerBar(song.timeSig), pickupBeats: song.pickupBeats,
    style: song.style, melody: true, beat: song.style !== 'none', click: false, countIn: false,
    songKey: song.songKey || songTonality(song.harpKey, song.position, type), chordOverrides: song.chords,
  });
  const notes = flat.filter((f) => f.midi !== null).length;

  // đã có đúng bài này (cùng tên, cùng tab) thì mở bài đó, không thêm bản trùng
  const [existing, setExisting] = useState<string | null>(null);
  useEffect(() => {
    void db.songs.filter((s) => s.title === song.title && s.body === song.body).first().then((s) => setExisting(s?.id ?? null));
  }, [song]);

  const add = async () => {
    if (existing) { nav(`/song/${existing}`, { replace: true }); return; }
    const now = Date.now();
    await db.songs.put({ ...song, tags: [...new Set([...song.tags, 'Được chia sẻ'])], createdAt: now, updatedAt: now });
    toast('Đã thêm vào thư viện');
    nav(`/song/${song.id}`, { replace: true });
  };

  return (
    <div className="page">
      <header className="song-head">
        <Link to="/" className="icon-btn back" aria-label="Về thư viện"><Icon name="back" /></Link>
        <KeyPlate k={song.harpKey} type={type} size="l" />
        <div className="sh-text">
          <p className="muted small">Bài được chia sẻ với bạn</p>
          <h1>{song.title || 'Chưa đặt tên'}</h1>
          {song.artist && <p className="muted">{song.artist}</p>}
          <p className="sh-meta">
            <span>{harpName(song.harpKey, type)}</span>
            <span>{song.timeSig}</span>
            <span>{song.bpm} bpm</span>
            <span>{notes} nốt</span>
          </p>
        </div>
      </header>
      <TabView parsed={parsed} flat={flat} active={player.active} showNames={settings.showNoteNames} nameStyle={settings.noteNames} size={settings.tabSize} harpType={type} harpKey={song.harpKey} />
      <div className="row gap wrap preview-actions">
        <button type="button" className="btn btn-primary" onClick={add}>
          <Icon name={existing ? 'library' : 'plus'} size={18} /> {existing ? 'Đã có trong thư viện — mở bài' : 'Thêm vào thư viện'}
        </button>
        <MiniPlay p={player} />
      </div>
    </div>
  );
}
