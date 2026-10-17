import { HARP_KEYS, HARP_TYPES, HARP_TYPE_LABEL, HarpKey, HarpType, harpName, holeCount, isChromatic, isTremolo } from '../lib/harp';

interface Props {
  value: HarpKey | 'auto';
  onChange: (k: HarpKey | 'auto') => void;
  allowAuto?: boolean;
  id?: string;
  label?: string;
}

export function KeySelect({ value, onChange, allowAuto, id, label = 'Tông kèn' }: Props) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as HarpKey | 'auto')}>
        {allowAuto && <option value="auto">Tự chọn kèn hợp nhất</option>}
        {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {k}</option>)}
      </select>
    </label>
  );
}

export function HarpTypeSelect({ value, onChange, id, label = 'Loại kèn' }: { value: HarpType; onChange: (t: HarpType) => void; id?: string; label?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as HarpType)}>
        {HARP_TYPES.map((t) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]}</option>)}
      </select>
    </label>
  );
}

export function KeyPlate({ k, type = 'diatonic', size = 'm' }: { k: string; type?: HarpType; size?: 's' | 'm' | 'l' }) {
  const holes = holeCount(type);
  // tremolo: hai hàng lỗ (trên / dưới) — dáng đặc trưng của kèn
  const trem = isTremolo(type);
  const cols = trem ? Math.ceil(holes / 2) : holes;
  return (
    <span className={`keyplate size-${size}${isChromatic(type) ? ' chromatic' : ''}${trem ? ' tremolo' : ''}`} aria-label={harpName(k, type)}>
      <span className="kp-letter">{k}</span>
      <span className="kp-holes" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{Array.from({ length: trem ? cols * 2 : holes }, (_, i) => <i key={i} />)}</span>
      {isChromatic(type) && <span className="kp-slide" aria-hidden="true" />}
    </span>
  );
}
