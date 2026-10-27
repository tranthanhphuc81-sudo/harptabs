import { memo } from 'react';
import { shapeName } from '../lib/capo';
import type { SheetLine, SheetSlot } from '../lib/chordSheet';

/**
 * Bài lời + hợp âm dán vào (không có giai điệu): hợp âm đặt trên chữ, hợp âm đang phát được tô sáng.
 * Có capo thì hiện tên thế bấm. Chạm vào chữ / hợp âm để phát từ đó.
 */
export const SheetView = memo(function SheetView({ lines, slots, capo, active, onSeek }: {
  lines: SheetLine[];
  slots: SheetSlot[];
  capo: number;
  /** thứ tự hợp âm đang phát (null: chưa phát) */
  active: number | null;
  onSeek: (slot: number) => void;
}) {
  const slotOf = new Map(slots.map((s, i) => [`${s.line}.${s.part}`, i]));
  // phần lời không có hợp âm thuộc hợp âm đứng trước nó
  let lastSlot = -1;
  return (
    <div className="chord-sheet sheet-view">
      {lines.map((l, li) => {
        if (l.kind === 'section') return <h3 key={li} className="cs-title">{l.title}</h3>;
        if (!l.parts.length) return <div key={li} className="sv-gap" />;
        return (
          <p key={li} className="cs-line">
            {l.parts.map((p, pi) => {
              const si = slotOf.get(`${li}.${pi}`);
              if (si !== undefined) lastSlot = si;
              const owner = si ?? lastSlot;
              const chordOnly = !p.text.trim();
              return (
                <span key={pi} className={`cs-syl${active != null && owner === active ? ' on' : ''}${chordOnly ? ' bare' : ''}`}
                  onClick={owner >= 0 ? () => onSeek(owner) : undefined}>
                  <b className="cs-chord">{p.chord ? shapeName(p.chord, capo) : ' '}</b>
                  <span className="cs-text">{p.text.replace(/\s{2,}/g, ' ') || ' '}</span>
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
});
