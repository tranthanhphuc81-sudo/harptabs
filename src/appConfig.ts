/**
 * Cấu hình theo bản build: cùng mã nguồn ra hai app — Sổ Tab Harmonica (mặc định) và Sổ Tab Sáo (VITE_APP=recorder).
 */
import type { HarpType } from './lib/harp';

export type AppKind = 'harmonica' | 'recorder';
export const APP: AppKind = import.meta.env.VITE_APP === 'recorder' ? 'recorder' : 'harmonica';
export const IS_RECORDER_APP = APP === 'recorder';

/** tên app, link, danh từ nhạc cụ dùng trong chữ hiển thị */
export const BRAND = IS_RECORDER_APP
  ? { name: 'Sổ Tab Sáo', line1: 'Sổ Tab', line2: 'Sáo', url: 'https://sotabsao.pages.dev/', host: 'sotabsao.pages.dev', instrument: 'sáo dọc', noun: 'sáo' }
  : { name: 'Sổ Tab Harmonica', line1: 'Sổ Tab', line2: 'Harmonica', url: 'https://harptabs.pages.dev/', host: 'harptabs.pages.dev', instrument: 'harmonica', noun: 'kèn' };

/** loại nhạc cụ hiện trong các ô chọn của bản build này (bài cũ thuộc loại khác vẫn mở được) */
export const SHOWN_HARP_TYPES: readonly HarpType[] = IS_RECORDER_APP
  ? ['recorderAlto', 'recorderSoprano', 'recorderTenor']
  : ['diatonic', 'chromatic', 'chromatic16', 'tremolo24', 'tremolo21', 'tremolo16', 'tremolo24m', 'tremolo21m', 'tremolo16m'];
