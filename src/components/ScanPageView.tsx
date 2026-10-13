import { useEffect, useRef } from 'react';
import type { Gray, OmrNote, OmrStaff } from '../lib/omr';

/** Vẽ ảnh xám đã chuẩn hoá lên canvas */
function GrayCanvas({ image }: { image: Gray }) {
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

interface Props {
  /** ảnh xám (đang sửa) hoặc URL ảnh đã lưu (chỉ xem) */
  image: Gray | { url: string; width: number; height: number };
  staves: OmrStaff[];
  notes: OmrNote[];
  tokenOf: (id: string) => string | null | undefined;
  zoom: number;
  label: string;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** key "trang:khuông:ô" của ô lệch phách / ô có dấu lặng máy đoán */
  offBars?: Set<string>;
  guessBars?: Set<string>;
  page?: number;
}

/** Ảnh khuông nhạc kèm vạch nhịp và số lỗ kèn trên từng nốt */
export function ScanPageView({ image, staves, notes, tokenOf, zoom, label, selected, onSelect, offBars, guessBars, page = 0 }: Props) {
  const w = image.width, h = image.height;
  const barClass = (si: number, bi: number) => {
    const k = (i: number) => `${page}:${si}:${i}`;
    if (offBars?.has(k(bi)) || offBars?.has(k(bi + 1))) return 'bar bad';
    if (guessBars?.has(k(bi)) || guessBars?.has(k(bi + 1))) return 'bar guess';
    return 'bar';
  };
  return (
    <div className="scan-scroll">
      <div className="scan-stage" style={{ width: `${zoom * 100}%` }}>
        {'url' in image ? <img src={image.url} alt="" className="scan-canvas" /> : <GrayCanvas image={image} />}
        <svg viewBox={`0 0 ${w} ${h}`} className="scan-overlay" role="group" aria-label={label}>
          {staves.map((st, si) => st.bars.map((bx, bi) => (
            <line key={`b${si}-${bi}`} x1={bx} x2={bx} y1={st.top - st.space} y2={st.bottom + st.space} className={barClass(si, bi)} />
          )))}
          {notes.map((n) => {
            const st = staves[n.staff];
            if (!st) return null;
            const tok = tokenOf(n.id);
            const isDraw = !!tok && tok.startsWith('-');
            return (
              <g key={n.id} className={`onote${n.id === selected ? ' sel' : ''}${n.rest ? ' rest' : ''}${n.guess ? ' guess' : ''}${onSelect ? '' : ' ro'}`}
                onClick={onSelect ? () => onSelect(n.id === selected ? null : n.id) : undefined}>
                {onSelect && <circle cx={n.x} cy={n.y} r={st.space * 1.7} className="hit" />}
                <ellipse cx={n.x} cy={n.y} rx={st.space * 0.85} ry={st.space * 0.65} className="mark" />
                <text x={n.x} y={st.top - st.space * 1.3} fontSize={st.space * 2.1} textAnchor="middle"
                  className={n.guess ? 'tok-guess' : n.rest ? 'tok-rest' : isDraw ? 'tok-draw' : 'tok-blow'}>
                  {n.rest ? (n.guess ? '?' : '—') : tok ?? '×'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
