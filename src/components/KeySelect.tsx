import { BRAND, SHOWN_HARP_TYPES } from '../appConfig';
import { hasInstrumentArt, InstrumentArt, instrumentCaption } from './InstrumentArt';
import { HARP_KEYS, HARP_TYPE_LABEL, HarpKey, harpKeyLabel, HarpType, harpName, holeCount, isChromatic, isDanBau, isFixedKey, isFretted, isKalimba, isPianica, isOrgan, isTranh, isSaoTruc, isTremolo, isTwoRowChromatic } from '../lib/harp';
import { t as tx } from '../lib/i18n';

interface Props {
  value: HarpKey | 'auto';
  onChange: (k: HarpKey | 'auto') => void;
  allowAuto?: boolean;
  id?: string;
  label?: string;
  /** loại kèn: kèn giọng thứ hiện tên "Am", "Dm"… */
  harpType?: HarpType;
}

export function KeySelect({ value, onChange, allowAuto, id, label = tx('Tông {0}', BRAND.noun), harpType }: Props) {
  // sáo dọc chỉ có một tông (alto Fa, soprano Đô): không cần chọn
  if (isFixedKey(harpType)) return null;
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as HarpKey | 'auto')}>
        {allowAuto && <option value="auto">{tx('Tự chọn {0} hợp nhất', BRAND.noun)}</option>}
        {HARP_KEYS.map((k) => <option key={k} value={k}>{isSaoTruc(harpType) ? tx('Sáo {0}', k) : isKalimba(harpType) ? `Kalimba ${k}` : isTranh(harpType) || isDanBau(harpType) ? tx('Đàn {0}', k) : tx('Kèn {0}', harpKeyLabel(k, harpType))}</option>)}
      </select>
    </label>
  );
}

export function HarpTypeSelect({ value, onChange, id, label = tx('Loại {0}', BRAND.noun) }: { value: HarpType; onChange: (t: HarpType) => void; id?: string; label?: string }) {
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
  // nhạc cụ khác harmonica: hình vẽ đúng nhạc cụ + chữ nhỏ phân loại
  if (hasInstrumentArt(type)) {
    const cap = instrumentCaption(type, k);
    return (
      <span className={`keyplate instrument size-${size}`} role="img" aria-label={harpName(k, type)}>
        <InstrumentArt type={type} />
        {cap && <span className="kp-cap">{cap}</span>}
      </span>
    );
  }
  const holes = holeCount(type);
  // tremolo: hai hàng lỗ (trên / dưới) — dáng đặc trưng của kèn
  const trem = isTremolo(type) || isTwoRowChromatic(type);
  const cols = trem ? Math.ceil(holes / 2) : holes;
  return (
    <span className={`keyplate size-${size}${isFretted(type) || isPianica(type) || isOrgan(type) || isTranh(type) || isDanBau(type) ? ' fretted' : ''}${isChromatic(type) ? ' chromatic' : ''}${trem ? ' tremolo' : ''}`} aria-label={harpName(k, type)}>
      <span className="kp-letter">{isDanBau(type) ? tx('Bầu') : isTranh(type) ? 'Tr' : isPianica(type) ? 'Pia' : isOrgan(type) ? (type === 'piano88' ? 'Pno' : 'Org') : isFretted(type) ? (type === 'ukulele4' ? 'Uke' : 'Gtr') : harpKeyLabel(k, type)}</span>
      <span className="kp-holes" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{Array.from({ length: trem ? cols * 2 : holes }, (_, i) => <i key={i} />)}</span>
      {isChromatic(type) && !isTwoRowChromatic(type) && <span className="kp-slide" aria-hidden="true" />}
    </span>
  );
}
