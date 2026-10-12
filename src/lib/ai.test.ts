import { describe, expect, it } from 'vitest';
import { parseGeminiResponse, estimateCostUsd, buildGeminiRequest, validateInput } from '../../shared/ai';
import { aiToTab } from './ai';
import { parseTab, flatten } from './tabText';

const fake = {
  title: 'Test', tempo: 100, timeSignature: '4/4', confidence: 0.9, warnings: [], style: 'rock',
  sections: [{ name: 'Đoạn 1', lines: [{ notes: [
    { pitch: 'D4', beats: 1, lyric: 'Twin-' }, { pitch: 'D4', beats: 1, lyric: 'kle' },
    { pitch: 'A4', beats: 1, lyric: 'lit-' }, { pitch: 'R', beats: 1, lyric: '' },
    { pitch: 'B4', beats: 1, lyric: '_' }, { pitch: 'A4', beats: 2, lyric: 'star' },
  ] }] }],
};

describe('AI', () => {
  it('đọc phản hồi Gemini và tính chi phí', () => {
    const r = parseGeminiResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(fake) }] } }],
      usageMetadata: { promptTokenCount: 2500, candidatesTokenCount: 1500, thoughtsTokenCount: 500 },
    }, 'gemini-2.5-flash');
    expect(r.result.sections[0].lines[0].notes).toHaveLength(6);
    expect(r.usage.outputTokens).toBe(2000);
    expect(estimateCostUsd(r.usage)).toBeCloseTo((2500 * 0.3 + 2000 * 2.5) / 1e6);
  });

  it('báo lỗi bản quyền dễ hiểu', () => {
    expect(() => parseGeminiResponse({ candidates: [{ finishReason: 'RECITATION' }] }, 'm')).toThrow(/bản quyền/);
  });

  it('chuyển kết quả sang tab, tự chọn kèn không cần bend', () => {
    const conv = aiToTab(fake as never, 'auto', false);
    expect(conv.fit.stats.bends).toBe(0);
    const p = parseTab(conv.body, conv.harpKey);
    expect(p.issues).toEqual([]);
    const f = flatten(p);
    expect(f.map((e) => e.lyric ?? null)).toEqual(['Twin', 'kle', 'lit', null, null, 'star']);
    expect(f[0].hyphen).toBe(true);
  });

  it('ép về kèn C có dịch giọng → không bend', () => {
    const conv = aiToTab(fake as never, 'C', true);
    expect(conv.harpKey).toBe('C');
    expect(conv.fit.stats.bends).toBe(0);
  });

  it('kiểm tra đầu vào', () => {
    expect(validateInput({ kind: 'name', title: '' })).toBeTruthy();
    expect(validateInput({ kind: 'image', images: [] })).toBeTruthy();
    expect(validateInput({ kind: 'name', title: 'Hello' })).toBeNull();
    const req = buildGeminiRequest({ kind: 'name', title: 'Hello', lyrics: 'abc' }) as any;
    expect(req.contents[0].parts[0].text).toContain('USER_LYRICS:\nabc');
  });
});
