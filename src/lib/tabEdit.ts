/** Sửa từng nốt của bài ngay trên tab đang xem (không phải mở trình sửa văn bản) */
import { HarpKey, HarpType, parseToken } from './harp';
import { parseTab, serializeTab, TabEvent } from './tabText';

export type NoteEdit =
  | { kind: 'token'; token: string | null }
  | { kind: 'beats'; beats: number }
  | { kind: 'remove' }
  | { kind: 'duplicate' }
  /** chèn một nốt mới ngay sau nốt đang chọn (độ dài mặc định bằng nốt đó) */
  | { kind: 'insert'; token: string; beats?: number };

export interface NotePos { sectionIndex: number; lineIndex: number; eventIndex: number }

/** Áp một thay đổi lên đúng nốt; trả về body mới, hoặc null nếu nốt không hợp lệ / không tìm thấy */
export function editNote(body: string, key: HarpKey, type: HarpType, pos: NotePos, edit: NoteEdit): string | null {
  const parsed = parseTab(body, key, type);
  const line = parsed.sections[pos.sectionIndex]?.lines[pos.lineIndex];
  if (!line || line.kind !== 'tab') return null;
  const ev = line.events[pos.eventIndex];
  if (!ev) return null;
  switch (edit.kind) {
    case 'token': {
      if (edit.token === null) { ev.token = null; ev.midi = null; ev.lyric = undefined; ev.hyphen = undefined; break; }
      const note = parseToken(edit.token, key, type);
      if (!note) return null;
      ev.token = note.token;
      ev.midi = note.midi;
      break;
    }
    case 'beats':
      if (!(edit.beats > 0) || edit.beats > 32) return null;
      ev.beats = edit.beats;
      break;
    case 'remove':
      line.events.splice(pos.eventIndex, 1);
      // dòng hết nốt thì bỏ luôn dòng đó để không để lại dòng trống
      if (!line.events.length) parsed.sections[pos.sectionIndex].lines.splice(pos.lineIndex, 1);
      break;
    case 'insert': {
      const note = parseToken(edit.token, key, type);
      if (!note) return null;
      line.events.splice(pos.eventIndex + 1, 0, { token: note.token, midi: note.midi, beats: edit.beats ?? ev.beats });
      break;
    }
    case 'duplicate': {
      const copy: TabEvent = { ...ev, lyric: undefined, hyphen: undefined };
      line.events.splice(pos.eventIndex + 1, 0, copy);
      break;
    }
  }
  return serializeTab(parsed.sections);
}

/** Tách token thành hướng / lỗ / bend / overblow / nút gạt để dựng lại khi người dùng chọn từng phần */
export function splitToken(token: string | null): { draw: boolean; hole: number | null; bend: number; over: boolean; slide: boolean } {
  const m = token ? /^(-?)(\d+)('*)(o?)(<?)$/.exec(token) : null;
  if (!m) return { draw: false, hole: null, bend: 0, over: false, slide: false };
  return { draw: m[1] === '-', hole: Number(m[2]), bend: m[3].length, over: !!m[4], slide: !!m[5] };
}

export function joinToken(t: { draw: boolean; hole: number; bend?: number; over?: boolean; slide?: boolean }): string {
  return `${t.draw ? '-' : ''}${t.hole}${"'".repeat(t.bend ?? 0)}${t.over ? 'o' : ''}${t.slide ? '<' : ''}`;
}
