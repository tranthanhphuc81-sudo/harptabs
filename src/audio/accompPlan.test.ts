import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { harmonize, parseTonality } from './harmony';
import { arpTrack, BarPlan, barTrack, planAccomp, PlanNote } from './accompPlan';
import { strumPattern } from './patterns';

/** giai điệu dựng nhanh: [midi | null, số phách] */
const mel = (spec: [number | null, number][], sectionIndex = 0): PlanNote[] => {
  let t = 0;
  return spec.map(([midi, beats]) => { const n = { start: t, beats, midi, sectionIndex }; t += beats; return n; });
};
const bp0: BarPlan = { texture: 'strum', energy: 1, fill: 'none', phraseEnd: false, phraseStart: false, held: false };
const plan = (notes: PlanNote[], bpm: number, sections?: string[]) =>
  planAccomp(notes, harmonize(notes, 4, 0, parseTonality('C')), { bpm, beatsPerBar: 4, pickupBeats: 0, sections });

describe('kế hoạch đệm hát theo bài', () => {
  it('bài chậm nhiều nốt ngân: rải dây, kết bằng tiếng quạt ngân', () => {
    const p = plan(mel([[60, 2], [64, 2], [67, 4], [65, 2], [64, 2], [62, 4], [60, 4]]), 66);
    expect(p.feel.lyrical).toBe(true);
    expect(p.bars[0].texture).toBe('arp');
    expect(p.bars[p.bars.length - 1].texture).toBe('final');
    expect(p.summary).toMatch(/rải dây/);
  });

  it('bài nhanh: quạt; ô giai điệu dày thì quạt thưa lại', () => {
    const busy: [number, number][] = Array.from({ length: 8 }, (_, i) => [60 + (i % 5), 0.5]);
    const p = plan(mel([[60, 1], [62, 1], [64, 1], [65, 1], ...busy, [67, 2], [65, 2], [64, 4]]), 128);
    expect(p.feel.lively).toBe(true);
    expect(p.bars[0].texture).toBe('strum');
    expect(p.bars[1].texture).toBe('sparse');
  });

  it('điệp khúc của bài chậm được quạt, phiên khúc rải', () => {
    const verse = mel([[60, 2], [62, 2], [64, 4], [62, 4], [60, 4]], 0);
    const off = verse[verse.length - 1].start + 4;
    const chorus = mel([[67, 2], [69, 2], [67, 4], [64, 4], [60, 4]], 1).map((n) => ({ ...n, start: n.start + off }));
    const p = plan([...verse, ...chorus], 70, ['Phiên khúc', 'Điệp khúc']);
    expect(p.bars[0].texture).toBe('arp');
    expect(p.bars[4].texture).toBe('strum');
  });

  it('hết câu mà ô sau đổi hợp âm thì bass dẫn vào', () => {
    // câu 1 dừng ở Đô ngân dài, câu 2 mở bằng hợp âm Fa
    const p = plan(mel([[64, 1], [62, 1], [60, 2], [60, 4], [65, 1], [69, 1], [72, 2], [65, 4], [64, 4]]), 96);
    const walks = p.bars.filter((b) => b.fill === 'walk').length;
    const fills = p.bars.filter((b) => b.fill !== 'none').length;
    expect(fills).toBeGreaterThan(0);
    expect(walks).toBeGreaterThanOrEqual(0);
  });

  it('điệu từng ô luôn dài đúng một ô, câu dồn nằm ở phách cuối', () => {
    for (const bpb of [2, 3, 4]) {
      const base = strumPattern('ballad', bpb);
      const len = base.beats * base.subdiv;
      for (const texture of ['arp', 'strum', 'sparse', 'busy', 'final', 'rest'] as const) {
        for (const fill of ['none', 'walk', 'push'] as const) {
          const t = barTrack({ ...bp0, texture, fill, finalStep: 1 }, 1, base);
          expect(t.length, `${bpb} ${texture} ${fill}`).toBe(len);
          if (texture === 'final') expect(t).toContain('Z');
          if (fill === 'walk' && texture !== 'final' && texture !== 'rest') expect(t.slice(len - base.subdiv)).toMatch(/P/);
        }
      }
    }
    expect(barTrack({ ...bp0, texture: 'strum' }, -1, strumPattern('ballad', 4))).toMatch(/^\.+$/);
    expect(arpTrack(4, 2)).toBe('B345F345');
    expect(arpTrack(3, 2)).toBe('B34543');
  });

  it('các bài mẫu cùng kiểu nhịp được đệm khác nhau', () => {
    const byStyle = new Map<string, Set<string>>();
    // bản chromatic là cùng bài với bản diatonic nên đệm giống nhau — chỉ xét bài diatonic
    const songs = SAMPLE_SONGS.filter((s) => !s.harpType);
    for (const s of songs) {
      if (s.style === 'none' || s.style === 'metronome') continue;
      const notes = flatten(parseTab(s.body, s.harpKey, s.harpType));
      const bpb = Number(s.timeSig.split('/')[0]) || 4;
      const chords = harmonize(notes, bpb, s.pickupBeats, parseTonality(s.songKey));
      const p = planAccomp(notes, chords, { bpm: s.bpm, beatsPerBar: bpb, pickupBeats: s.pickupBeats });
      const base = strumPattern(s.style, bpb);
      const sig = p.bars.map((b, i) => barTrack(b, i, base)).join('|');
      if (!byStyle.has(s.style)) byStyle.set(s.style, new Set());
      byStyle.get(s.style)!.add(sig);
      expect(p.summary.length).toBeGreaterThan(10);
    }
    const styles = songs.filter((s) => s.style !== 'none' && s.style !== 'metronome').map((s) => s.style);
    for (const [style, sigs] of byStyle) {
      const count = styles.filter((x) => x === style).length;
      // mỗi bài một cách đệm (bài khác nhau thì kế hoạch khác nhau)
      expect(sigs.size, style).toBe(count);
    }
  });

  it('kỹ thuật tay guitar rơi đúng chỗ: vuốt mở câu, lắc thay câu dồn, rung ở nốt ngân', () => {
    const base = strumPattern('ballad', 4);
    expect(barTrack({ ...bp0, phraseStart: true }, 2, base, { rake: true })[0]).toBe('V');
    expect(barTrack({ ...bp0, phraseStart: true }, 2, base, {})[0]).toBe('B');
    expect(barTrack({ ...bp0, fill: 'push' }, 1, base, { shake: true }).slice(6)).toBe('L.');
    expect(barTrack({ ...bp0, held: true }, 1, base, { trem: true }).slice(6)).toBe('R.');
    // bass dẫn được giữ, không bị rung đè
    expect(barTrack({ ...bp0, held: true, fill: 'walk' }, 1, base, { trem: true }).slice(4)).toBe('R.QP');
    expect(barTrack({ ...bp0, fill: 'walk' }, 1, base, { shake: true }).slice(4)).toBe('L.QP');
    const slow = strumPattern('waltz', 3);
    expect(barTrack({ ...bp0, held: true }, 1, slow, { trem: true })).toHaveLength(6);
  });
});
