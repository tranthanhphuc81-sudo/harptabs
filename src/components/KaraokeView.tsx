import { useEffect, useMemo, useRef, useState } from 'react';
import { harpName, harpTypeOf, shiftKey } from '../lib/harp';
import { buildKaraoke, countdownAt, holesFor, KLine, locate } from '../lib/karaoke';
import { DEFAULT_KARAOKE, KaraokeHoles, KaraokePrefs, loadKaraokePrefs, MAX_TRANSPOSE, saveKaraokePrefs } from '../lib/karaokePrefs';
import { FlatEvent, flatten, parseTab } from '../lib/tabText';
import type { Song } from '../lib/types';
import { viewSong } from '../lib/viewAs';
import { ChordSegment, transposeSpans } from '../audio/harmony';
import { Icon } from './Icon';
import { TokenText } from './TabView';
import type { PlayerState } from './usePlayer';
import { useFullscreen } from './useFullscreen';
import { useWakeLock } from './useWakeLock';

const HOLES_LABEL: Record<KaraokeHoles, string> = { same: 'Giữ số lỗ', myHarp: 'Xếp lại cho kèn đang xem', hide: 'Ẩn số lỗ' };

/** tên hợp âm gắn vào âm tiết: khúc hợp âm bắt đầu trong âm tiết nào thì hiện trên âm tiết đó */
function chordsByLine(lines: KLine[], segs: ChordSegment[]): Map<string, string> {
  const out = new Map<string, string>();
  let prev = '';
  for (const seg of segs) {
    // khúc liền sau cùng hợp âm (nửa ô nhịp nối tiếp): không hiện lại
    if (seg.chord.name === prev) continue;
    prev = seg.chord.name;
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (seg.start < l.start - 1e-6 || seg.start >= l.end - 1e-6) continue;
      let si = l.syls.findIndex((s) => seg.start >= s.start - 1e-6 && seg.start < s.end - 1e-6);
      if (si < 0) si = l.syls.findIndex((s) => s.start >= seg.start);
      if (si >= 0 && !out.has(`${li}.${si}`)) out.set(`${li}.${si}`, seg.chord.name);
      break;
    }
  }
  return out;
}

/**
 * Màn hình karaoke: lời to toàn màn hình, chữ đổi màu chạy theo tiếng hát, đếm ngược vào câu,
 * đổi tông cho hợp giọng. Dùng chung bộ phát của trang bài (đang bật Đệm hát).
 */
export default function KaraokeView({ song, original, flat, p, chordSegs, onClose }: {
  /** bài đang xem (có thể đã xếp lại cho kèn khác) — cùng số nốt, cùng phách với bài gốc */
  song: Song;
  original: Song;
  flat: FlatEvent[];
  p: PlayerState;
  chordSegs: ChordSegment[] | null;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(rootRef);
  useWakeLock(true);

  const [prefs, setPrefs] = useState<KaraokePrefs>(DEFAULT_KARAOKE);
  // người dùng đã chỉnh trước khi đọc xong cài đặt cũ: giữ cái vừa chỉnh, không ghi đè
  const touched = useRef(false);
  useEffect(() => {
    void loadKaraokePrefs(original.id).then((saved) => setPrefs((cur) => (touched.current ? cur : saved))).catch(() => {});
  }, [original.id]);
  const update = (patch: Partial<KaraokePrefs>) => setPrefs((cur) => {
    touched.current = true;
    const next = { ...cur, ...patch };
    void saveKaraokePrefs(original.id, next).catch(() => {});
    return next;
  });
  const t = prefs.transpose;

  // mở karaoke: bật Đệm hát (tắt giai điệu kèn) và đổi tông; đóng thì trả lại như cũ
  const { setOpts } = p;
  // trang bài tạo lại đối tượng bộ phát mỗi lần vẽ: giữ bản mới nhất trong ref để vòng chữ chạy không khởi động lại
  const pRef = useRef(p);
  pRef.current = p;
  const wasSing = useRef(!!p.opts.sing);
  useEffect(() => {
    const prev = wasSing.current;
    setOpts({ sing: true });
    void fs.enter();
    return () => { pRef.current.stop(); setOpts({ sing: prev, transpose: 0 }); void fs.exit(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở / đóng
  }, []);
  useEffect(() => { setOpts({ transpose: t }); }, [t, setOpts]);

  // lời + thời điểm theo bài gốc (bản xếp lại cho kèn khác có thể mất lời ở nốt không thổi được)
  const lyricFlat = useMemo(() => {
    const f = flatten(parseTab(original.body, original.harpKey, harpTypeOf(original)));
    return f.length === flat.length ? f : flat;
  }, [original, flat]);
  const lines = useMemo(() => buildKaraoke(lyricFlat), [lyricFlat]);

  // số lỗ: giữ nguyên (thổi bằng kèn lệch tông tương ứng), hoặc xếp lại cho kèn đang xem
  const type = harpTypeOf(song);
  const holeFlat = useMemo(() => {
    if (!t || prefs.holes !== 'myHarp') return flat;
    const v = viewSong({ ...song, harpKey: shiftKey(song.harpKey, t) }, { type, key: song.harpKey, mode: 'octave' });
    return flatten(parseTab(v.song.body, song.harpKey, type));
  }, [t, prefs.holes, flat, song, type]);
  const missing = useMemo(() => holeFlat.filter((f, i) => f.token === null && flat[i]?.token).length, [holeFlat, flat]);

  const chordMap = useMemo(
    () => (prefs.chords && chordSegs ? chordsByLine(lines, transposeSpans(chordSegs, t)) : new Map<string, string>()),
    [prefs.chords, chordSegs, lines, t],
  );

  // ----- chữ chạy: đọc phách mỗi khung hình, ghi thẳng --p vào âm tiết (không vẽ lại React) -----
  const [shown, setShown] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const shownRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    let lastCount: number | null = null;
    const frame = () => {
      const beat = pRef.current.beatAt();
      if (beat !== null) {
        const pos = locate(lines, beat);
        if (pos.line >= 0 && pos.line !== shownRef.current) { shownRef.current = pos.line; setShown(pos.line); }
        const els = lineRef.current?.querySelectorAll<HTMLElement>('[data-s]');
        els?.forEach((el, i) => {
          const v = pos.line !== shownRef.current ? 0 : i < pos.syl ? 1 : i === pos.syl ? pos.p : 0;
          const s = v.toFixed(3);
          if (el.style.getPropertyValue('--p') !== s) el.style.setProperty('--p', s);
        });
        const c = countdownAt(lines, beat);
        if (c !== lastCount) { lastCount = c; setCount(c); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lines]);
  // dừng phát: chữ về trạng thái chưa hát
  useEffect(() => {
    if (p.playing) return;
    lineRef.current?.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => el.style.setProperty('--p', '0'));
    setCount(null);
  }, [p.playing, shown]);

  // phím tắt: cách = phát / dừng, Esc = thoát
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); pRef.current.toggle(); }
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startFrom = (li: number) => {
    const first = lines[li]?.syls[0]?.fi[0];
    shownRef.current = li;
    setShown(li);
    p.play(first);
  };

  const renderLine = (li: number, big: boolean) => {
    const l = lines[li];
    if (!l) return <div className="kara-line kara-empty" />;
    return (
      <div className={`kara-line${big ? ' current' : ' next'}${l.instrumental ? ' instrumental' : ''}`} ref={big ? lineRef : undefined}>
        {l.syls.map((s, si) => {
          const holes = prefs.holes === 'hide' ? [] : holesFor(s, holeFlat);
          const text = s.text || (l.instrumental ? '♪' : '·');
          const chord = chordMap.get(`${li}.${si}`);
          return (
            <span key={si} className="ks" data-s={big ? si : undefined}>
              {(chord || holes.length > 0) && (
                <span className="ks-top">
                  {chord && <span className="ks-chord">{chord}</span>}
                  {holes.length > 0 && (
                    <span className="ks-holes">
                      {holes.map((h, i) => <span key={i} className={h?.startsWith('-') ? 'draw' : 'blow'}>{h ? <TokenText token={h} /> : '–'}</span>)}
                    </span>
                  )}
                </span>
              )}
              <span className="ks-row">
                <span className="ks-word">
                  <span className="ks-base">{text}</span>
                  <span className="ks-fill" aria-hidden="true">{text}</span>
                </span>
                {s.hyphen && <span className="ks-hy">-</span>}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const noLyrics = lines.every((l) => l.instrumental);
  const playHarp = t ? harpName(shiftKey(song.harpKey, t), type) : null;

  return (
    <div ref={rootRef} className="karaoke" role="dialog" aria-modal="true" aria-label={`Karaoke: ${original.title}`}>
      <header className="kara-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Thoát karaoke"><Icon name="back" /></button>
        <div className="kara-title">
          <strong>{original.title || 'Karaoke'}</strong>
          {original.artist && <span className="muted"> · {original.artist}</span>}
        </div>
        <div className="kara-tools">
          <div className="kara-key" role="group" aria-label="Đổi tông cho hợp giọng">
            <button type="button" className="icon-btn" disabled={t <= -MAX_TRANSPOSE} onClick={() => update({ transpose: t - 1 })} aria-label="Hạ tông"><Icon name="minus" size={18} /></button>
            <span className="kara-key-val" aria-live="polite">Tông {t > 0 ? `+${t}` : t}</span>
            <button type="button" className="icon-btn" disabled={t >= MAX_TRANSPOSE} onClick={() => update({ transpose: t + 1 })} aria-label="Nâng tông"><Icon name="plus" size={18} /></button>
          </div>
          <select className="chip-select" value={prefs.holes} onChange={(e) => update({ holes: e.target.value as KaraokeHoles })} aria-label="Số lỗ kèn">
            {(Object.keys(HOLES_LABEL) as KaraokeHoles[]).map((k) => <option key={k} value={k}>{HOLES_LABEL[k]}</option>)}
          </select>
          <button type="button" className={`chip${prefs.chords ? ' on' : ''}`} aria-pressed={prefs.chords} onClick={() => update({ chords: !prefs.chords })}>Hợp âm</button>
        </div>
      </header>

      {t !== 0 && prefs.holes !== 'hide' && (
        <p className="kara-note small">
          {prefs.holes === 'same'
            ? <>Đã đổi tông {t > 0 ? `+${t}` : t}: thổi đúng số lỗ này bằng <strong>{playHarp}</strong>.</>
            : <>Số lỗ xếp lại cho {harpName(song.harpKey, type).replace(/^Kèn/, 'kèn')}{missing > 0 ? ` — ${missing} nốt không có trên kèn này (–)` : ''}.</>}
        </p>
      )}

      <main className="kara-stage" onClick={() => !p.playing && startFrom(shown)}>
        {noLyrics && <p className="kara-hint">Bài chưa có lời — thêm lời dưới dòng tab trong Sửa bài để hát karaoke.</p>}
        {p.countIn != null
          ? <div className="kara-count big" aria-live="assertive">{p.countIn}</div>
          : count != null && <div className="kara-count" aria-hidden="true">{'●'.repeat(count)}</div>}
        {renderLine(shown, true)}
        {renderLine(shown + 1, false)}
      </main>

      <footer className="kara-foot">
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(Math.max(0, shown - 1))} disabled={shown === 0} aria-label="Câu trước">
          <Icon name="back" size={18} /> Câu trước
        </button>
        <button type="button" className="kara-play" onClick={() => (p.playing ? p.stop() : startFrom(shown))} aria-label={p.playing ? 'Dừng' : 'Hát'}>
          <Icon name={p.playing ? 'stop' : 'play'} size={30} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(0)} aria-label="Hát lại từ đầu">
          <Icon name="loop" size={18} /> Từ đầu
        </button>
      </footer>
    </div>
  );
}
