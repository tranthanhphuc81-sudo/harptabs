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
    // nhạc cụ, hiện hợp âm là sở thích riêng: không tính là chỉnh tay
    m.setBeatPrefs({ instrument: 'piano', showChords: true });
    expect(m.getBeatPrefs().manual).toEqual(['kit']);
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
});
