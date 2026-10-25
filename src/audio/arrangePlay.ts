/** Đánh một nốt của bản phối MIDI gốc: nhạc cụ gần nhất của app, bass bằng tiếng bass, kênh 10 bằng bộ trống */
import type { ArrNote } from '../lib/midiArrange';
import { arrangeBus, bass, bongo, clap, clave, conga, cowbell, crash, guiro, hat, kick, playToneAs, ride, rim, shaker, snare, tom } from './engine';

const TOMS = [41, 43, 45, 47, 48, 50];

/** trống GM (số nốt kênh 10) → tiếng trống của app; nốt lạ thì bỏ */
function drumHit(note: number, t: number, vel: number) {
  switch (note) {
    case 35: case 36: return kick(t, vel);
    case 37: return rim(t, vel);
    case 38: case 40: return snare(t, vel);
    case 39: return clap(t, vel);
    case 42: case 44: return hat(t, vel * 0.8);
    case 46: return hat(t, vel * 0.8, true);
    case 41: case 43: case 45: case 47: case 48: case 50: return tom(t, vel, 1 - TOMS.indexOf(note) / 5);
    case 49: case 52: case 55: case 57: return crash(t, vel * 0.8);
    case 51: case 53: case 59: return ride(t, vel);
    case 54: case 69: case 70: case 82: return shaker(t, vel);
    case 56: return cowbell(t, vel);
    case 60: return bongo(t, 'h', vel);
    case 61: return bongo(t, 'o', vel);
    case 62: return conga(t, 't', vel);
    case 63: return conga(t, 'o', vel);
    case 64: return conga(t, 'l', vel);
    case 73: case 74: return guiro(t, note === 74, vel);
    case 75: case 76: case 77: return clave(t, vel);
  }
}

/** `transpose`: đổi tông karaoke (không áp cho trống) */
export function playArrNote(n: ArrNote, when: number, durSec: number, transpose: number) {
  if (n.voice === 'drum') return drumHit(n.midi, when, n.vel);
  const midi = n.midi + transpose;
  if (n.voice === 'bass') return bass(midi, when, durSec, n.vel);
  playToneAs(n.voice, midi, when, durSec, n.vel, arrangeBus());
}
