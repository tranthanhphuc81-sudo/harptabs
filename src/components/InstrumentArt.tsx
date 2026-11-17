/**
 * Hình nhỏ của nhạc cụ (danh sách bài, đầu trang bài): mỗi loại một dáng riêng thay cho tấm kèn harmonica.
 * Màu lấy từ bảng màu đang dùng (CSS .ia-*) nên hợp cả sáng lẫn tối.
 */
import type { ReactNode } from 'react';
import { HarpType, holeCount, isDanBau, isFretted, isKalimba, isKeyboard, isOcarina, isRecorder, isSaoTruc, isTranh } from '../lib/harp';

/** nhạc cụ có hình riêng (harmonica giữ tấm kèn kim loại cũ) */
export const hasInstrumentArt = (t: HarpType | undefined) =>
  isFretted(t) || isKalimba(t) || isRecorder(t) || isSaoTruc(t) || isOcarina(t) || isKeyboard(t) || isTranh(t) || isDanBau(t);

/** chữ nhỏ ở góc: phân biệt các loại cùng họ (ukulele, kalimba 17 phím, sáo alto, piano 88…) */
export function instrumentCaption(t: HarpType, key: string): string {
  if (t === 'ukulele4') return 'Uke';
  if (t === 'guitar6' || isDanBau(t)) return '';
  if (isSaoTruc(t)) return key;
  if (t === 'recorderAlto') return 'Alto';
  if (t === 'recorderSoprano') return 'Sop';
  if (t === 'recorderTenor') return 'Ten';
  if (t === 'recorderBass') return 'Bass';
  if (t === 'organ61') return '61';
  if (t === 'piano88') return '88';
  if (t === 'pianica32') return '32';
  if (t === 'pianica37') return '37';
  return String(holeCount(t));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Guitar({ uke }: { uke?: boolean }) {
  // nằm ngang, cần đàn sang phải
  const [r1, r2, cx1, cx2, hole, neckH] = uke ? [8, 6.5, 13, 20, 2.6, 4.4] : [10, 8, 12, 21, 3.3, 5];
  const strings = uke ? 4 : 6;
  const neckX = cx2 + r2 - 1;
  return (
    <>
      <circle className="ia-wood" cx={cx1} cy={20} r={r1} />
      <circle className="ia-wood" cx={cx2} cy={20} r={r2} />
      {/* phủ lại phần ruột (không viền) để thân đàn liền một khối, không lộ đường viền giữa hai bầu */}
      <circle className="ia-wood ia-nostroke" cx={cx1} cy={20} r={r1 - 0.35} />
      <circle className="ia-wood ia-nostroke" cx={cx2} cy={20} r={r2 - 0.35} />
      <rect className="ia-wood-2" x={neckX} y={20 - neckH / 2} width={41 - neckX} height={neckH} rx={0.8} />
      <rect className="ia-dark" x={40} y={20 - neckH / 2 - 1.6} width={6} height={neckH + 3.2} rx={1.6} />
      <circle className="ia-dark" cx={cx2 - 1} cy={20} r={hole} />
      <rect className="ia-dark" x={cx1 - r1 / 2 - 1} y={20 - neckH / 2 - 1} width={2} height={neckH + 2} rx={0.6} />
      {range(strings).map((i) => {
        const y = 20 - neckH / 2 + 0.7 + (i * (neckH - 1.4)) / (strings - 1);
        return <line key={i} className="ia-string" x1={cx1 - r1 / 2} y1={y} x2={42} y2={y} />;
      })}
    </>
  );
}

function Kalimba({ tines }: { tines: number }) {
  const n = Math.min(tines, 11);
  const w = 30 / n;
  const mid = (n - 1) / 2;
  return (
    <>
      <rect className="ia-wood" x={6} y={3} width={36} height={34} rx={7} />
      <circle className="ia-dark" cx={24} cy={29} r={3.2} />
      {range(n).map((i) => {
        const h = 17 - Math.abs(i - mid) * (8 / Math.max(mid, 1));
        return <rect key={i} className="ia-metal" x={9 + i * w + w * 0.18} y={6} width={w * 0.64} height={h} rx={w * 0.3} />;
      })}
      <rect className="ia-dark" x={8} y={11} width={32} height={2.4} rx={1.2} />
    </>
  );
}

function Recorder() {
  // sáo dọc vẽ nằm chéo, đầu thổi bên trái
  return (
    <g transform="rotate(-18 24 20)">
      <path className="ia-wood" d="M2 17.2 L9 16.6 L9 23.4 L2 22.8 Q1 20 2 17.2 Z" />
      <rect className="ia-wood" x={8} y={16.4} width={38} height={7.2} rx={3.4} />
      <rect className="ia-dark" x={11} y={17.8} width={3.2} height={2} rx={0.5} />
      <rect className="ia-wood-2" x={8} y={16.4} width={2.2} height={7.2} />
      {[18, 22, 25.5, 29, 32.5, 36, 39.5].map((x) => <circle key={x} className="ia-dark" cx={x} cy={20} r={1.25} />)}
    </g>
  );
}

function SaoTruc() {
  return (
    <g transform="rotate(-14 24 20)">
      <rect className="ia-bamboo" x={1} y={16.8} width={46} height={6.4} rx={3.2} />
      {[6, 21, 38].map((x) => <rect key={x} className="ia-wood-2" x={x} y={16.8} width={1.6} height={6.4} />)}
      <ellipse className="ia-dark" cx={10} cy={20} rx={1.7} ry={1.3} />
      {[24.5, 27.5, 30.5, 33.5, 41, 44].map((x) => <circle key={x} className="ia-dark" cx={x} cy={20} r={1.1} />)}
    </g>
  );
}

function Ocarina() {
  return (
    <>
      <path className="ia-wood" d="M6 22 Q6 9 24 9 Q42 9 44 20 Q44 31 26 31 Q12 31 6 22 Z" />
      <path className="ia-wood-2" d="M38 13 L46 9 L47 13 L41 17 Z" />
      {[[14, 18], [19, 16], [24, 15.5], [29, 16], [34, 18], [18, 24], [24, 25], [30, 24]].map(([x, y]) => (
        <circle key={`${x}-${y}`} className="ia-dark" cx={x} cy={y} r={1.6} />
      ))}
    </>
  );
}

function Keys({ x, y, w, h, white = 7 }: { x: number; y: number; w: number; h: number; white?: number }) {
  const kw = w / white;
  const blacks = range(white - 1).filter((i) => i % 7 !== 2 && i % 7 !== 6);
  return (
    <>
      <rect className="ia-key" x={x} y={y} width={w} height={h} rx={1.2} />
      {range(white - 1).map((i) => <line key={i} className="ia-keyline" x1={x + (i + 1) * kw} y1={y} x2={x + (i + 1) * kw} y2={y + h} />)}
      {blacks.map((i) => <rect key={i} className="ia-dark" x={x + (i + 1) * kw - kw * 0.3} y={y} width={kw * 0.6} height={h * 0.6} rx={0.5} />)}
    </>
  );
}

function Keyboard({ type }: { type: HarpType }) {
  if (type === 'pianica32' || type === 'pianica37') {
    return (
      <>
        <rect className="ia-body" x={7} y={8} width={38} height={26} rx={5} />
        <path className="ia-dark" d="M1 19 H8 V23 H1 Q0 21 1 19 Z" />
        <Keys x={10} y={14} w={32} h={16} />
      </>
    );
  }
  if (type === 'piano88') {
    return (
      <>
        <path className="ia-dark" d="M3 8 H45 V16 H3 Z" />
        <rect className="ia-wood-2" x={3} y={6} width={42} height={3} rx={1} />
        <Keys x={4} y={16} w={40} h={18} white={10} />
      </>
    );
  }
  return (
    <>
      <rect className="ia-body" x={2} y={7} width={44} height={28} rx={3.5} />
      {[8, 12, 16].map((x) => <circle key={x} className="ia-glow" cx={x} cy={11.5} r={1.4} />)}
      <rect className="ia-dark" x={22} y={10} width={18} height={3.4} rx={1} />
      <Keys x={4} y={16} w={40} h={17} white={10} />
    </>
  );
}

function Tranh() {
  // thân đàn dài, đầu to bên trái (đầu dây), đuôi thon bên phải; nhạn xếp chéo trên mặt đàn
  const n = 7;
  const L = { x: 6, y0: 25.5, y1: 33 }, R = { x: 44, y0: 11.5, y1: 17.5 };
  const yAt = (t: number, x: number) => {
    const ya = L.y0 + t * (L.y1 - L.y0), yb = R.y0 + t * (R.y1 - R.y0);
    return ya + ((x - L.x) / (R.x - L.x)) * (yb - ya);
  };
  return (
    <>
      <path className="ia-wood" d="M2 30 Q2 24.5 7.5 23.5 L44 9.5 Q47.2 8.8 47.2 12.2 L47.2 17.4 Q47.2 19.4 45 20 L9 35.4 Q2 37.2 2 32 Z" />
      {range(n).map((i) => {
        const t = i / (n - 1);
        return <line key={i} className="ia-string-dark" x1={L.x} y1={yAt(t, L.x)} x2={R.x} y2={yAt(t, R.x)} />;
      })}
      {range(n).map((i) => {
        const t = i / (n - 1);
        const x = 14 + t * 18;
        const y = yAt(t, x);
        return <path key={i} className="ia-metal-edge" d={`M${x - 1.5} ${y + 1.3} L${x} ${y - 1.7} L${x + 1.5} ${y + 1.3} Z`} />;
      })}
      <rect className="ia-wood-2" x={5} y={24} width={1.6} height={10} rx={0.6} transform="rotate(-8 6 29)" />
    </>
  );
}

function DanBau() {
  return (
    <>
      <rect className="ia-wood" x={2} y={23} width={44} height={9} rx={3.5} />
      <path className="ia-rod" d="M38.5 23 Q37 12 33 3" />
      <circle className="ia-bamboo" cx={38.5} cy={20.5} r={3.6} />
      <line className="ia-string-dark" x1={5} y1={24.2} x2={35.5} y2={10} />
      <rect className="ia-dark" x={4} y={23.5} width={2} height={3} rx={0.6} />
    </>
  );
}

export function InstrumentArt({ type }: { type: HarpType }) {
  let art: ReactNode = null;
  if (isFretted(type)) art = <Guitar uke={type === 'ukulele4'} />;
  else if (isKalimba(type)) art = <Kalimba tines={holeCount(type)} />;
  else if (isSaoTruc(type)) art = <SaoTruc />;
  else if (isRecorder(type)) art = <Recorder />;
  else if (isOcarina(type)) art = <Ocarina />;
  else if (isKeyboard(type)) art = <Keyboard type={type} />;
  else if (isTranh(type)) art = <Tranh />;
  else if (isDanBau(type)) art = <DanBau />;
  return <svg className="ia-svg" viewBox="0 0 48 40" aria-hidden="true">{art}</svg>;
}
