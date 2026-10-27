/**
 * Cấu hình theo bản build: cùng mã nguồn ra ba app — Sổ Tab Harmonica (mặc định), Sổ Tab Sáo (VITE_APP=recorder)
 * và Sổ Tab Kalimba (VITE_APP=kalimba).
 */
import type { HarpType } from './lib/harp';

export type AppKind = 'harmonica' | 'recorder' | 'kalimba';
const ENV = import.meta.env.VITE_APP;
export const APP: AppKind = ENV === 'recorder' ? 'recorder' : ENV === 'kalimba' ? 'kalimba' : 'harmonica';
export const IS_RECORDER_APP = APP === 'recorder';
export const IS_KALIMBA_APP = APP === 'kalimba';
export const IS_HARMONICA_APP = APP === 'harmonica';

/** tên app, link, danh từ nhạc cụ, động từ chơi — dùng trong chữ hiển thị */
export const BRAND = IS_RECORDER_APP
  ? { name: 'Sổ Tab Sáo', line1: 'Sổ Tab', line2: 'Sáo', url: 'https://sotabsao.pages.dev/', host: 'sotabsao.pages.dev', instrument: 'sáo dọc', noun: 'sáo', verb: 'thổi' }
  : IS_KALIMBA_APP
  ? { name: 'Sổ Tab Kalimba', line1: 'Sổ Tab', line2: 'Kalimba', url: 'https://sotabkalimba.pages.dev/', host: 'sotabkalimba.pages.dev', instrument: 'kalimba', noun: 'kalimba', verb: 'chơi' }
  : { name: 'Sổ Tab Harmonica', line1: 'Sổ Tab', line2: 'Harmonica', url: 'https://harptabs.pages.dev/', host: 'harptabs.pages.dev', instrument: 'harmonica', noun: 'kèn', verb: 'thổi' };

/** loại nhạc cụ hiện trong các ô chọn của bản build này (bài cũ thuộc loại khác vẫn mở được) */
export const SHOWN_HARP_TYPES: readonly HarpType[] = IS_RECORDER_APP
  ? ['recorderAlto', 'recorderSoprano', 'recorderTenor', 'recorderBass', 'saoTruc6']
  : IS_KALIMBA_APP
  ? ['kalimba17']
  : ['diatonic', 'chromatic', 'chromatic16', 'tremolo24', 'tremolo21', 'tremolo16', 'tremolo24m', 'tremolo21m', 'tremolo16m'];
