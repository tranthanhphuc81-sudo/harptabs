import { BRAND, SHOWN_HARP_TYPES } from '../appConfig';
import { HARP_KEYS, HARP_TYPE_LABEL, HarpKey, harpKeyLabel, HarpType, harpName, holeCount, isChromatic, isDanBau, isFixedKey, isFretted, isKalimba, isPianica, isTranh, isSaoTruc, isTremolo } from '../lib/harp';

interface Props {
  value: HarpKey | 'auto';
  onChange: (k: HarpKey | 'auto') => void;
  allowAuto?: boolean;
  id?: string;
  label?: string;
  /** loại kèn: kèn giọng thứ hiện tên "Am", "Dm"… */
  harpType?: HarpType;
}

export function KeySelect({ value, onChange, allowAuto, id, label = `Tông ${BRAND.noun}`, harpType }: Props) {
  // sáo dọc chỉ có một tông (alto Fa, soprano Đô): không cần chọn
  if (isFixedKey(harpType)) return null;
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as HarpKey | 'auto')}>
        {allowAuto && <option value="auto">Tự chọn {BRAND.noun} hợp nhất</option>}
        {HARP_KEYS.map((k) => <option key={k} value={k}>{isSaoTruc(harpType) ? `Sáo ${k}` : isKalimba(harpType) ? `Kalimba ${k}` : isTranh(harpType) || isDanBau(harpType) ? `Đàn ${k}` : `Kèn ${harpKeyLabel(k, harpType)}`}</option>)}
      </select>
    </label>
  );
}

export function HarpTypeSelect({ value, onChange, id, label = `Loại ${BRAND.noun}` }: { value: HarpType; onChange: (t: HarpType) => void; id?: string; label?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as HarpType)}>
        {(SHOWN_HARP_TYPES.includes(value) ? SHOWN_HARP_TYPES : [...SHOWN_HARP_TYPES, value]).map((t) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]}</option>)}
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
    <span className={`keyplate size-${size}${isFretted(type) || isPianica(type) || isTranh(type) || isDanBau(type) ? ' fretted' : ''}${isChromatic(type) ? ' chromatic' : ''}${trem ? ' tremolo' : ''}`} aria-label={harpName(k, type)}>
      <span className="kp-letter">{isDanBau(type) ? 'Bầu' : isTranh(type) ? 'Tr' : isPianica(type) ? 'Pia' : isFretted(type) ? (type === 'ukulele4' ? 'Uke' : 'Gtr') : harpKeyLabel(k, type)}</span>
      <span className="kp-holes" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{Array.from({ length: trem ? cols * 2 : holes }, (_, i) => <i key={i} />)}</span>
      {isChromatic(type) && <span className="kp-slide" aria-hidden="true" />}
    </span>
  );
}
