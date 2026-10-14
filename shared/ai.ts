/**
 * Phần dùng chung giữa app (chế độ gọi trực tiếp) và Cloudflare Worker (proxy):
 * prompt, JSON schema, dựng request Gemini, đọc & kiểm tra kết quả, ước tính chi phí.
 * Không phụ thuộc DOM hay Node — chạy được ở cả hai nơi.
 */

export const BEAT_STYLES = ['metronome', 'rock', 'ballad', 'shuffle', 'slowrock', 'train', 'bolero', 'rumba', 'chacha', 'tango', 'waltz'] as const;

export interface AiImage { mimeType: string; data: string /* base64, không có tiền tố data: */ }

export type AiInput =
  | { kind: 'image'; images: AiImage[]; title?: string; lyrics?: string; hint?: string }
  | { kind: 'name'; title: string; artist?: string; lyrics?: string; hint?: string };

export interface AiNote { pitch: string; beats: number; lyric?: string }
export interface AiLine { notes: AiNote[] }
export interface AiSection { name?: string; lines: AiLine[] }

export interface AiTranscription {
  title: string;
  artist?: string;
  songKey?: string;
  tempo?: number;
  timeSignature?: string;
  pickupBeats?: number;
  style?: (typeof BEAT_STYLES)[number];
  confidence: number;
  warnings: string[];
  sections: AiSection[];
}

export interface AiUsage { model: string; inputTokens: number; outputTokens: number }

export interface AiResponse { result: AiTranscription; usage: AiUsage }

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BASE64 = 4_000_000; // ~3 MB mỗi ảnh sau khi nén
export const MAX_LYRICS = 6000;

const SYSTEM_PROMPT = `You are the transcription engine of a learning app for the 10-hole diatonic harmonica.
Your only job is to output the MAIN MELODY of a song as a list of notes. The app converts notes to harmonica tabs and generates the backing beat itself, so never output tabs, chords or accompaniment.

NOTE FORMAT
- pitch: scientific pitch notation, middle C = C4. Use sharps or flats as written (e.g. "F#4", "Bb4"). Use "R" for a rest.
- beats: duration in quarter-note beats (quarter = 1, eighth = 0.5, dotted quarter = 1.5, half = 2, triplet eighth = 0.3333).
- lyric: the syllable sung on that note. If the word continues on the next note, end the syllable with "-" (e.g. "Twin-", "kle"). Use "_" when a syllable is held over several notes (melisma). Use "" when there is no lyric.
- Group notes into lines of roughly 2-4 bars following the musical phrases, and lines into sections ("Đoạn 1", "Điệp khúc", ...).
- If the piece starts with an incomplete bar (anacrusis), set pickupBeats to its length in beats.
- Pick the closest backing style from the allowed list.
- Write every warning in Vietnamese, short and practical.

WHEN GIVEN IMAGES OF SHEET MUSIC
- Read exactly what is written: clef, key signature, accidentals, time signature, tempo marking, ties (merge tied notes into one longer note), and dotted rhythms.
- If there are several staves, take the vocal or top melody line only.
- Write out simple repeats (repeat signs, 1st/2nd endings) in playing order, at most two passes.
- Transcribe the lyrics printed under the notes (first verse only) syllable by syllable.
- Numbered notation (jianpu / "số") is also allowed: 1 = do of the stated key.
- If parts are unreadable, transcribe what you can, lower confidence and add a warning that says which bars are uncertain.

WHEN GIVEN ONLY A SONG NAME
- Recall the melody of that specific song as accurately as you can, in its usual key.
- If you do not know the song or are unsure, return your best attempt with confidence below 0.4 and a warning that the melody needs to be checked by ear. Never substitute a different song.
- LYRICS: never write lyrics from memory. Use only the lyrics provided in USER_LYRICS, aligned syllable by syllable to the notes. If USER_LYRICS is empty, leave every lyric as "".

confidence: 0..1, your honest estimate that the melody is correct.`;

const NOTE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pitch: { type: 'STRING' },
    beats: { type: 'NUMBER' },
    lyric: { type: 'STRING' },
  },
  required: ['pitch', 'beats'],
};

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    artist: { type: 'STRING' },
    songKey: { type: 'STRING', description: 'e.g. "C", "G", "Am"' },
    tempo: { type: 'INTEGER', description: 'quarter-note BPM' },
    timeSignature: { type: 'STRING', description: 'e.g. "4/4"' },
    pickupBeats: { type: 'NUMBER' },
    style: { type: 'STRING', enum: [...BEAT_STYLES] },
    confidence: { type: 'NUMBER' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { notes: { type: 'ARRAY', items: NOTE_SCHEMA } },
              required: ['notes'],
            },
          },
        },
        required: ['lines'],
      },
    },
  },
  required: ['title', 'confidence', 'warnings', 'sections', 'tempo', 'timeSignature'],
};

export function validateInput(input: AiInput): string | null {
  if (!input || (input.kind !== 'image' && input.kind !== 'name')) return 'Yêu cầu không hợp lệ';
  if (input.lyrics && input.lyrics.length > MAX_LYRICS) return `Lời bài hát quá dài (tối đa ${MAX_LYRICS} ký tự)`;
  if (input.kind === 'image') {
    if (!Array.isArray(input.images) || input.images.length === 0) return 'Chưa có ảnh khuông nhạc';
    if (input.images.length > MAX_IMAGES) return `Tối đa ${MAX_IMAGES} ảnh mỗi lần`;
    for (const img of input.images) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(img.mimeType)) return 'Định dạng ảnh không hỗ trợ';
      if (typeof img.data !== 'string' || img.data.length > MAX_IMAGE_BASE64) return 'Ảnh quá lớn';
    }
  } else if (!input.title || input.title.trim().length < 2) {
    return 'Hãy nhập tên bài hát';
  }
  return null;
}

export function buildGeminiRequest(input: AiInput): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];
  const lyrics = (input.lyrics ?? '').trim();
  if (input.kind === 'image') {
    for (const img of input.images) parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
    parts.push({
      text: [
        `MODE: sheet music image (${input.images.length} page${input.images.length > 1 ? 's' : ''}, in order).`,
        input.title ? `Song title (from user): ${input.title}` : '',
        input.hint ? `User note: ${input.hint}` : '',
        lyrics ? `USER_LYRICS (prefer these over what is printed if they differ):\n${lyrics}` : 'USER_LYRICS: (empty — use the lyrics printed on the sheet, if any)',
      ].filter(Boolean).join('\n'),
    });
  } else {
    parts.push({
      text: [
        'MODE: song name only.',
        `Song title: ${input.title.trim()}`,
        input.artist ? `Artist / composer: ${input.artist}` : '',
        input.hint ? `User note: ${input.hint}` : '',
        `USER_LYRICS:\n${lyrics || '(empty)'}`,
      ].filter(Boolean).join('\n'),
    });
  }
  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: input.kind === 'image' ? 0.1 : 0.3,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 16384,
    },
  };
}

export function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

interface GeminiRaw {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string; status?: string };
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Đọc phản hồi thô của Gemini, kiểm tra và chuẩn hoá. Ném Error có thông điệp tiếng Việt nếu lỗi. */
export function parseGeminiResponse(raw: GeminiRaw, model: string): AiResponse {
  if (raw.error) throw new Error(`Gemini báo lỗi: ${raw.error.message ?? raw.error.status ?? 'không rõ'}`);
  if (raw.promptFeedback?.blockReason) throw new Error('Yêu cầu bị chặn bởi bộ lọc an toàn của Gemini');
  const cand = raw.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) {
    if (cand?.finishReason === 'RECITATION') throw new Error('AI từ chối vì nội dung có thể vi phạm bản quyền (thường do lời bài hát). Hãy tự dán lời vào ô lời bài hát.');
    throw new Error('AI không trả về kết quả, hãy thử lại');
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(cand?.finishReason === 'MAX_TOKENS' ? 'Bài quá dài cho một lần chuyển — hãy chụp từng trang' : 'Kết quả AI không đọc được, hãy thử lại');
  }
  const sections: AiSection[] = (Array.isArray(data.sections) ? data.sections : [])
    .map((s: Record<string, unknown>) => ({
      name: typeof s.name === 'string' ? s.name.slice(0, 60) : undefined,
      lines: (Array.isArray(s.lines) ? s.lines : [])
        .map((l: Record<string, unknown>) => ({
          notes: (Array.isArray(l.notes) ? l.notes : [])
            .map((n: Record<string, unknown>) => ({
              pitch: String(n.pitch ?? 'R').slice(0, 6),
              beats: num(n.beats, 1, 0.0625, 16),
              lyric: typeof n.lyric === 'string' ? n.lyric.slice(0, 40) : '',
            })),
        }))
        .filter((l: AiLine) => l.notes.length > 0),
    }))
    .filter((s: AiSection) => s.lines.length > 0);
  if (!sections.length) throw new Error('AI không nhận ra giai điệu nào. Hãy chụp rõ hơn hoặc nhập tên bài đầy đủ hơn.');

  const style = BEAT_STYLES.includes(data.style as never) ? (data.style as AiTranscription['style']) : undefined;
  const usage = raw.usageMetadata ?? {};
  return {
    result: {
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 120) : 'Bài mới',
      artist: typeof data.artist === 'string' ? data.artist.slice(0, 120) : undefined,
      songKey: typeof data.songKey === 'string' ? data.songKey.slice(0, 8) : undefined,
      tempo: Math.round(num(data.tempo, 90, 30, 260)),
      timeSignature: typeof data.timeSignature === 'string' && /^\d{1,2}\/\d{1,2}$/.test(data.timeSignature) ? data.timeSignature : '4/4',
      pickupBeats: num(data.pickupBeats, 0, 0, 8),
      style,
      confidence: num(data.confidence, 0.5, 0, 1),
      warnings: Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === 'string').slice(0, 10) : [],
      sections,
    },
    usage: {
      model,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    },
  };
}

/** Bảng giá tham khảo (USD / 1 triệu token, vào / ra) — tra lại trên trang giá của Google khi cần. */
export const PRICE_TABLE: { match: RegExp; input: number; output: number }[] = [
  { match: /2\.5-flash-lite/, input: 0.1, output: 0.4 },
  { match: /2\.5-flash/, input: 0.3, output: 2.5 },
  { match: /2\.5-pro/, input: 1.25, output: 10 },
  { match: /3(\.\d)?-flash-lite/, input: 0.25, output: 1.5 },
  { match: /3\.[67]-flash/, input: 0.75, output: 3.75 },
  { match: /3\.5-flash/, input: 1.5, output: 9 },
  { match: /3-flash/, input: 0.5, output: 3 },
  { match: /3(\.\d)?-pro/, input: 2, output: 12 },
];

export function estimateCostUsd(u: AiUsage): number {
  const p = PRICE_TABLE.find((r) => r.match.test(u.model)) ?? { input: 0.5, output: 3 };
  return (u.inputTokens * p.input + u.outputTokens * p.output) / 1_000_000;
}

export const VND_PER_USD = 26_000;
