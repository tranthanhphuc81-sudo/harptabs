import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATTERNS } from './patterns';

vi.mock('./engine', () => ({ applyMix: () => {} }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

async function fresh(saved?: object) {
  store.clear();
  if (saved) store.set('harptabs.beatPrefs', JSON.stringify(saved));
  vi.resetModules();
  return import('./beatPrefs');
}

describe('tự động tối ưu âm thanh', () => {
  beforeEach(() => store.clear());

  it('mặc định bật; mỗi kiểu nhịp lấy bộ trống, độ lắc, bo… hợp nhất', async () => {
    const m = await fresh();
    expect(m.getBeatPrefs().auto).toBe(true);
    expect(m.getEffectivePrefs('bossa').kit).toBe('soft');
    expect(m.getEffectivePrefs('disco').kit).toBe('electronic');
    expect(m.getEffectivePrefs('reggae').swing).toBeCloseTo(0.12);
    expect(m.getEffectivePrefs('salsa').bo).toBe(true);
    // kiểu không ghi gì thì về mặc định, không "dính" cài đặt của kiểu trước
    expect(m.getEffectivePrefs('rock').swing).toBe(0);
    expect(m.getEffectivePrefs('rock').bo).toBe(false);
  });

  it('mục chỉnh tay được giữ nguyên, "Về tự động" bỏ hết chỉnh tay', async () => {
    const m = await fresh();
    m.setBeatPrefs({ kit: 'electronic' });
    expect(m.getBeatPrefs().manual).toEqual(['kit']);
    expect(m.getEffectivePrefs('bossa').kit).toBe('electronic');
    expect(m.getEffectivePrefs('bossa').compVol).toBe(0.6); // mục khác vẫn tự động
    // hiện hợp âm là sở thích riêng: không tính là chỉnh tay; nhạc cụ thì có (vì được tự chọn theo bài)
    m.setBeatPrefs({ instrument: 'piano', showChords: true });
    expect(m.getBeatPrefs().manual).toEqual(['kit', 'instrument']);
    m.setAutoPrefs(true);
    expect(m.getBeatPrefs().manual).toEqual([]);
    expect(m.getEffectivePrefs('bossa').kit).toBe('soft');
  });

  it('tắt tự động: giữ nguyên cài đặt cố định cho mọi kiểu nhịp', async () => {
    const m = await fresh();
    m.setAutoPrefs(false);
    m.setBeatPrefs({ kit: 'electronic' });
    expect(m.getEffectivePrefs('bossa').kit).toBe('electronic');
    expect(m.getEffectivePrefs('waltz').kit).toBe('electronic');
  });

  it('người dùng cũ: mục đã chỉnh khác mặc định được coi là chỉnh tay', async () => {
    const m = await fresh({ kit: 'electronic', swing: 0, boVol: 0.4 });
    expect(m.getBeatPrefs().auto).toBe(true);
    expect([...m.getBeatPrefs().manual].sort()).toEqual(['boVol', 'kit']);
    expect(m.getEffectivePrefs('bossa').kit).toBe('electronic');
  });

  it('mọi kiểu nhịp đều có cài đặt và tốc độ thường gặp', async () => {
    const m = await fresh();
    for (const name of Object.keys(PATTERNS)) {
      expect(m.STYLE_PRESETS[name as keyof typeof m.STYLE_PRESETS], name).toBeTruthy();
      const r = m.TEMPO_RANGES[name as keyof typeof m.TEMPO_RANGES];
      expect(r && r[0] < r[1], name).toBe(true);
    }
  });

  it('nhạc cụ lấy theo bài đang mở; chỉnh tay thì giữ, "Về tự động" lại theo bài', async () => {
    const m = await fresh();
    expect(m.getEffectivePrefs('tango').instrument).toBe('harmonica');
    m.setSongInstrument('accordion');
    expect(m.getEffectivePrefs('tango').instrument).toBe('accordion');
    expect(m.effectivePrefs(m.getBeatPrefs(), 'tango', 'guitar').instrument).toBe('guitar');
    m.setBeatPrefs({ instrument: 'piano' });
    expect(m.getBeatPrefs().manual).toContain('instrument');
    expect(m.getEffectivePrefs('tango').instrument).toBe('piano');
    m.setAutoPrefs(true);
    expect(m.getEffectivePrefs('tango').instrument).toBe('accordion');
    // rời bài: về kèn harmonica
    m.setSongInstrument(null);
    expect(m.getEffectivePrefs('tango').instrument).toBe('harmonica');
  });

  it('người dùng đã chọn nhạc cụ trước đây: coi là chỉnh tay, không bị đổi theo bài', async () => {
    const m = await fresh({ auto: true, manual: [], instrument: 'violin' });
    m.setSongInstrument('guitar');
    expect(m.getEffectivePrefs('bolero').instrument).toBe('violin');
    const m2 = await fresh({ auto: true, manual: [], instrument: 'harmonica' });
    m2.setSongInstrument('guitar');
    expect(m2.getEffectivePrefs('bolero').instrument).toBe('guitar');
  });
});
