/** Gọi AI từ app: qua proxy (khuyên dùng) hoặc gọi thẳng Gemini bằng key của chính bạn. */
import {
  AiInput, AiResponse, AiTranscription, buildGeminiRequest, geminiUrl, parseGeminiResponse, validateInput,
} from '../../shared/ai';
import { HarpKey, HarpType, nameToMidi } from './harp';
import { fitToHarp, rankHarpKeys, TabFit } from './converter';
import { TabEvent, TabSection, serializeTab } from './tabText';
import type { Settings } from './types';
import type { BeatStyle } from '../audio/patterns';
import { suggestStyle } from '../audio/suggest';

export async function transcribe(input: AiInput, s: Settings, signal?: AbortSignal): Promise<AiResponse> {
  const err = validateInput(input);
  if (err) throw new Error(err);
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Bạn đang offline — tính năng AI cần mạng');

  if (s.aiMode === 'direct') {
    if (!s.geminiKey) throw new Error('Chưa nhập Gemini API key trong Cài đặt');
    const res = await fetch(geminiUrl(s.model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.geminiKey },
      body: JSON.stringify(buildGeminiRequest(input)),
      signal,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 400 && /API key/i.test(JSON.stringify(raw))) throw new Error('API key không hợp lệ');
      if (res.status === 429) throw new Error('Vượt hạn mức của Gemini, đợi một lát rồi thử lại');
      if (res.status === 404) throw new Error(`Không tìm thấy model "${s.model}" — kiểm tra lại tên model trong Cài đặt`);
      throw new Error(raw?.error?.message ?? `Lỗi Gemini (${res.status})`);
    }
    return parseGeminiResponse(raw, s.model);
  }

  if (!s.proxyUrl) throw new Error('Chưa cấu hình địa chỉ máy chủ AI trong Cài đặt');
  const res = await fetch(`${s.proxyUrl.replace(/\/+$/, '')}/v1/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(s.appToken ? { 'x-app-token': s.appToken } : {}) },
    body: JSON.stringify({ input, model: s.model }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Máy chủ AI lỗi (${res.status})`);
  return data as AiResponse;
}

/** Nén ảnh trước khi gửi: cạnh dài tối đa 2000px, JPEG 85% → rẻ hơn và nhanh hơn */
export async function prepareImage(file: File): Promise<{ mimeType: string; data: string; preview: string }> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(`Không đọc được ảnh "${file.name}"`);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mimeType: 'image/jpeg', data: url.split(',')[1], preview: url };
}

export interface ConvertedSong {
  body: string;
  harpKey: HarpKey;
  harpType: HarpType;
  fit: TabFit;
  bpm: number;
  timeSig: string;
  pickupBeats: number;
  style: BeatStyle;
  songKey?: string;
  invalidPitches: number;
}

/**
 * Chuyển kết quả AI thành tab.
 * targetKey = 'auto' → chọn kèn hợp nhất (giữ giọng gốc);
 * targetKey cụ thể → chơi trên kèn đó, `allowTranspose` cho phép dịch giọng cho dễ thổi.
 */
export function aiToTab(r: AiTranscription, targetKey: HarpKey | 'auto', allowTranspose: boolean, harpType: HarpType = 'diatonic'): ConvertedSong {
  let invalid = 0;
  const sections: TabSection[] = r.sections.map((sec) => ({
    title: sec.name,
    lines: sec.lines.map((line, li) => ({
      kind: 'tab' as const,
      lineNo: li,
      events: line.notes.map((n): TabEvent => {
        const p = n.pitch.trim().toUpperCase() === 'R' ? null : nameToMidi(n.pitch);
        if (p === null && n.pitch.trim().toUpperCase() !== 'R') invalid++;
        const raw = (n.lyric ?? '').trim();
        const melisma = raw === '_' || raw === '~';
        const hyphen = !melisma && raw.endsWith('-') && raw.length > 1;
        const lyric = melisma || !raw ? undefined : raw.replace(/-+$/, '');
        return { token: p === null ? null : '?', midi: p, beats: n.beats, lyric: p === null ? undefined : lyric, hyphen: p === null ? undefined : hyphen };
      }),
    })),
  }));

  const midis: (number | null)[] = [];
  sections.forEach((s) => s.lines.forEach((l) => l.kind === 'tab' && l.events.forEach((e) => midis.push(e.midi))));

  const fit = targetKey === 'auto'
    ? rankHarpKeys(midis, 1, harpType)[0]
    : fitToHarp(midis, targetKey, { transpose: allowTranspose ? 'any' : 'octave', type: harpType });

  let i = 0;
  sections.forEach((s) => s.lines.forEach((l) => {
    if (l.kind !== 'tab') return;
    l.events.forEach((e) => {
      const tok = fit.tokens[i++];
      if (e.midi === null || tok === null) {
        e.token = null; e.midi = null; e.lyric = undefined; e.hyphen = undefined;
      } else {
        e.token = tok; e.midi += fit.shift;
      }
    });
  }));

  // AI / máy quét không cho kiểu nhịp thì tự chọn theo giai điệu, nhịp, tốc độ, tên bài
  let style: BeatStyle | undefined = r.style;
  if (!style) {
    const notes: { start: number; beats: number; midi: number | null; lyric?: string }[] = [];
    let t = 0;
    sections.forEach((s) => s.lines.forEach((l) => {
      if (l.kind === 'tab') l.events.forEach((e) => { notes.push({ start: t, beats: e.beats, midi: e.midi, lyric: e.lyric }); t += e.beats; });
    }));
    style = suggestStyle({ title: r.title, timeSig: r.timeSignature ?? '4/4', bpm: r.tempo ?? 90, pickupBeats: r.pickupBeats, songKey: r.songKey }, notes).style;
  }
  return {
    body: serializeTab(sections),
    harpKey: fit.key,
    harpType,
    fit,
    bpm: r.tempo ?? 90,
    timeSig: r.timeSignature ?? '4/4',
    pickupBeats: r.pickupBeats ?? 0,
    style,
    songKey: r.songKey,
    invalidPitches: invalid,
  };
}
