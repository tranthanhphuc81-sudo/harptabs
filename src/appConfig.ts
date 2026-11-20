/**
 * Cấu hình theo bản build: cùng mã nguồn ra bảy app — Sổ Tab Harmonica (mặc định), Sổ Tab Sáo (VITE_APP=recorder),
 * Sổ Tab Kalimba (VITE_APP=kalimba) và Sổ Tab Guitar (VITE_APP=guitar: guitar và ukulele), Sổ Tab Pianica (VITE_APP=pianica),
 * Sổ Tab Đàn Tranh – Đàn Bầu (VITE_APP=tranh), Sổ Tab Organ (VITE_APP=organ: organ, piano).
 */
import type { HarpType } from './lib/harp';
import { LANG, t } from './lib/i18n';

export type AppKind = 'harmonica' | 'recorder' | 'kalimba' | 'guitar' | 'pianica' | 'tranh' | 'organ';
const ENV = import.meta.env.VITE_APP;
export const APP: AppKind = ENV === 'recorder' || ENV === 'kalimba' || ENV === 'guitar' || ENV === 'pianica' || ENV === 'tranh' || ENV === 'organ' ? ENV : 'harmonica';
export const IS_RECORDER_APP = APP === 'recorder';
export const IS_KALIMBA_APP = APP === 'kalimba';
export const IS_GUITAR_APP = APP === 'guitar';
export const IS_PIANICA_APP = APP === 'pianica';
export const IS_TRANH_APP = APP === 'tranh';
export const IS_ORGAN_APP = APP === 'organ';
export const IS_HARMONICA_APP = APP === 'harmonica';
/** nhạc cụ thổi (động từ "thổi" trong BRAND.verb) — so sánh bằng cờ này, đừng so chữ BRAND.verb vì nó đổi theo ngôn ngữ */
export const IS_BLOWN_APP = IS_RECORDER_APP || IS_PIANICA_APP || IS_HARMONICA_APP;

/** tên app, link, danh từ nhạc cụ, động từ chơi — dùng trong chữ hiển thị */
export const BRAND = IS_RECORDER_APP
  ? { name: 'Sổ Tab Sáo', line1: 'Sổ Tab', line2: 'Sáo', url: 'https://sotabsao.pages.dev/', host: 'sotabsao.pages.dev', instrument: t('sáo dọc'), noun: t('sáo'), verb: LANG === 'en' ? 'play' : 'thổi' }
  : IS_TRANH_APP
  ? { name: 'Sổ Tab Đàn Tranh – Đàn Bầu', line1: 'Sổ Tab', line2: 'Tranh – Bầu', url: 'https://sotabdantranh.pages.dev/', host: 'sotabdantranh.pages.dev', instrument: t('đàn tranh, đàn bầu'), noun: t('đàn'), verb: LANG === 'en' ? 'play' : 'chơi' }
  : IS_ORGAN_APP
  ? { name: 'Sổ Tab Organ', line1: 'Sổ Tab', line2: 'Organ', url: 'https://sotaborgan.pages.dev/', host: 'sotaborgan.pages.dev', instrument: t('đàn organ, piano'), noun: t('đàn'), verb: LANG === 'en' ? 'play' : 'chơi' }
  : IS_PIANICA_APP
  ? { name: 'Sổ Tab Pianica', line1: 'Sổ Tab', line2: 'Pianica', url: 'https://sotabpianica.pages.dev/', host: 'sotabpianica.pages.dev', instrument: t('kèn pianica'), noun: 'pianica', verb: LANG === 'en' ? 'play' : 'thổi' }
  : IS_GUITAR_APP
  ? { name: 'Sổ Tab Guitar', line1: 'Sổ Tab', line2: 'Guitar', url: 'https://sotabguitar.pages.dev/', host: 'sotabguitar.pages.dev', instrument: 'guitar, ukulele', noun: t('đàn'), verb: LANG === 'en' ? 'play' : 'chơi' }
  : IS_KALIMBA_APP
  ? { name: 'Sổ Tab Kalimba', line1: 'Sổ Tab', line2: 'Kalimba', url: 'https://sotabkalimba.pages.dev/', host: 'sotabkalimba.pages.dev', instrument: 'kalimba', noun: 'kalimba', verb: LANG === 'en' ? 'play' : 'chơi' }
  : { name: 'Sổ Tab Harmonica', line1: 'Sổ Tab', line2: 'Harmonica', url: 'https://harptabs.pages.dev/', host: 'harptabs.pages.dev', instrument: 'harmonica', noun: t('kèn'), verb: LANG === 'en' ? 'play' : 'thổi' };

/** loại nhạc cụ hiện trong các ô chọn của bản build này (bài cũ thuộc loại khác vẫn mở được) */
export const SHOWN_HARP_TYPES: readonly HarpType[] = IS_RECORDER_APP
  ? ['recorderAlto', 'recorderSoprano', 'recorderTenor', 'recorderBass', 'saoTruc6', 'ocarina12']
  : IS_TRANH_APP
  ? ['tranh17', 'tranh16', 'tranh19', 'tranh21', 'tranh22', 'danbau']
  : IS_ORGAN_APP
  ? ['organ61', 'piano88']
  : IS_PIANICA_APP
  ? ['pianica32', 'pianica37']
  : IS_GUITAR_APP
  ? ['guitar6', 'ukulele4']
  : IS_KALIMBA_APP
  ? ['kalimba17', 'kalimba10', 'kalimba8']
  : ['diatonic', 'chromatic', 'chromatic16', 'trochilusSolo', 'tomboS50', 'tremolo24', 'tremolo21', 'tremolo16', 'tremolo24m', 'tremolo21m', 'tremolo16m'];

/** thư mục biểu tượng của app trong public/ (harmonica nằm ở gốc) */
export const ICON_DIR = APP === 'harmonica' ? '' : `${APP}/`;

/** hai nốt mẫu (nốt chính / nốt phụ) theo cách ghi tab của nhạc cụ — dùng ở ô xem trước bảng màu */
export const TAB_SAMPLE: [string, string] = IS_RECORDER_APP ? ['Sol', 'La']
  : IS_KALIMBA_APP ? ['5', '1̇']
  : IS_GUITAR_APP ? ['3.2', '2.0']
  : IS_PIANICA_APP || IS_ORGAN_APP ? ['C4', 'E4']
  : IS_TRANH_APP ? ['5', '7^']
  : ['4', '−4'];
