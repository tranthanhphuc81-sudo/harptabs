/** File MIDI gốc của bài (karaoke phát bản phối gốc): lưu, đọc, xoá */
import { db } from './db';
import type { MidiLink } from './midiArrange';
import type { MidiSource } from './types';

/** file karaoke MIDI thường vài chục KB; quá lớn thì không giữ */
export const MAX_MIDI_BYTES = 2e6;

export async function loadMidiSource(songId: string): Promise<MidiSource | null> {
  return (await db.midiSources.get(songId)) ?? null;
}

export async function saveMidiSource(songId: string, name: string, bytes: Uint8Array, link: MidiLink, tabSig: string): Promise<void> {
  if (bytes.length > MAX_MIDI_BYTES) return;
  const data = bytes.slice().buffer;
  await db.midiSources.put({ songId, name, data, size: data.byteLength, ...link, tabSig, createdAt: Date.now() });
}

export async function deleteMidiSource(songId: string): Promise<void> {
  await db.midiSources.delete(songId);
}

export function midiBytes(src: MidiSource): Uint8Array {
  return new Uint8Array(src.data);
}
