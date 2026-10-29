/**
 * Nhạc đệm cho các trang tập (thay tiếng bíp / máy đếm nhịp trơn): hợp âm piano dưới câu hỏi nghe – đáp,
 * nền trống + piano cho tập nhịp, tiếng bass trầm ngân dưới bài giữ nốt / bend.
 */
import { accompHit, AccompChord, audio, hat, kick, snare } from './engine';

/** hợp âm ba (trưởng / thứ) dựng từ nốt gốc: bass E2–D#3, hợp âm thế đóng quanh Đô4 cho piano */
export function triadChord(root: number, minor = false): AccompChord {
  const pc = ((root % 12) + 12) % 12;
  const bass = 40 + ((pc - 4 + 12) % 12);
  let r = 60 + pc;
  if (r > 66) r -= 12;
  return { bass, fifth: bass + 7 <= 51 ? bass + 7 : bass - 5, minor, triad: [r, r + (minor ? 3 : 4), r + 7] };
}

/** hợp âm hợp với một bậc trong gam trưởng: Đô Mi Sol → I, Fa La → IV, Rê Si → V (nửa cung tính từ nốt chủ) */
export function chordForDegree(tonic: number, degree: number): AccompChord {
  const d = ((degree % 12) + 12) % 12;
  if (d === 5 || d === 9) return triadChord(tonic + 5);
  if (d === 2 || d === 11) return triadChord(tonic + 7);
  return triadChord(tonic);
}

/** rải hợp âm chủ (piano) làm mốc trước câu hỏi */
export function playTonicRoll(tonic: number, when: number, dur = 1.2) {
  accompHit('piano', 'V', triadChord(tonic), when, dur / 1.5, dur, 0.8);
}

/** đệm piano dưới một câu: mỗi nốt đổi hợp âm thì đánh bass + hợp âm khẽ */
export function accompanyPhrase(tonic: number, notes: number[], start: number, step: number) {
  let last = '';
  notes.forEach((m, i) => {
    const ch = chordForDegree(tonic, m - tonic);
    const id = ch.triad.join();
    if (id === last) return;
    last = id;
    const t = start + i * step;
    accompHit('piano', 'B', ch, t, step, step * 1.6, 0.55);
    accompHit('piano', 'D', ch, t, step * 1.6, step, 0.5);
  });
}

/** chốt khi trả lời đúng: hợp âm chủ ngân (kết câu) */
export function playCadence(tonic: number, when: number) {
  accompHit('piano', 'Z', triadChord(tonic), when, 1.5, 1.5, 0.55);
}

/** vòng hợp âm tập nhịp: I – V – vi – IV (nhịp ba: I – IV – V – I) */
export function grooveChords(tonic: number, beatsPerBar: number): AccompChord[] {
  return beatsPerBar === 3
    ? [triadChord(tonic), triadChord(tonic + 5), triadChord(tonic + 7), triadChord(tonic)]
    : [triadChord(tonic), triadChord(tonic + 7), triadChord(tonic + 9, true), triadChord(tonic + 5)];
}

/**
 * Nền trống + piano cho một ô nhịp bắt đầu lúc `t`: trống cái phách 1 (và 3), trống lẫy phách 2 / 4, hi-hat mỗi nửa phách,
 * piano bass đầu ô và hợp âm khẽ mỗi phách.
 */
export function grooveBar(ch: AccompChord, t: number, beat: number, beatsPerBar: number) {
  for (let b = 0; b < beatsPerBar; b++) {
    const tb = t + b * beat;
    if (b === 0 || (beatsPerBar === 4 && b === 2)) kick(tb, b === 0 ? 1 : 0.8);
    if (beatsPerBar === 4 ? b % 2 === 1 : b > 0) snare(tb, 0.7);
    hat(tb, 0.5);
    hat(tb + beat / 2, 0.3);
    accompHit('piano', b === 0 ? 'B' : 'd', ch, tb, beat, beat * beatsPerBar, 0.6);
    if (b === 0) accompHit('piano', 'D', ch, tb, beat, beat, 0.55);
  }
}

/** nốt bass của tiếng nền: nốt chủ ở quãng tám 2 (Đô2–Si2, 65–123 Hz) — thấp hơn tầm dò của micro với kèn, sáo, pianica */
export const droneMidi = (tonic: number) => 36 + (((tonic % 12) + 12) % 12);
export const droneHz = (tonic: number) => 440 * 2 ** ((droneMidi(tonic) - 69) / 12);

/**
 * Tiếng bass trầm ngân đều dưới bài giữ nốt / bend: nghe có nhạc hơn, dễ cảm cao độ đúng hơn.
 * Chỉ một nốt trầm (không hợp âm) để micro không nghe nhầm là tiếng người chơi. Trả về hàm dừng.
 */
export function startDrone(tonic: number, period = 2.4): () => void {
  const m = droneMidi(tonic);
  const ch: AccompChord = { ...triadChord(tonic), bass: m, fifth: m };
  const c = audio();
  let next = c.currentTime + 0.1;
  const tick = () => {
    while (next < c.currentTime + 0.6) {
      accompHit('piano', 'B', ch, next, period, period * 1.05, 0.5);
      next += period;
    }
  };
  tick();
  const id = window.setInterval(tick, 200);
  return () => clearInterval(id);
}
