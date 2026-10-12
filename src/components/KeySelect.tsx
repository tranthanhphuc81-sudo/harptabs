import { HARP_KEYS, HarpKey } from '../lib/harp';

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

export function KeyPlate({ k, size = 'm' }: { k: string; size?: 's' | 'm' | 'l' }) {
  return (
    <span className={`keyplate size-${size}`} aria-label={`Kèn ${k}`}>
      <span className="kp-letter">{k}</span>
      <span className="kp-holes" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span>
    </span>
  );
}
