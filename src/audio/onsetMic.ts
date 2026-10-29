/**
 * Thu micro trên CÙNG đồng hồ âm thanh với máy đếm nhịp (audio() của engine) để đo lệch nhịp chính xác tới vài mili giây:
 * một AudioWorklet tính năng lượng từng khối 128 mẫu kèm thời điểm của khối, gửi về theo lô.
 */
import { audio } from './engine';

const WORKLET = `
class EnergyTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let s = 0;
      for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
      this.buf.push(currentTime, s / ch.length);
      if (this.buf.length >= 16) { this.port.postMessage(this.buf); this.buf = []; }
    }
    return true;
  }
}
registerProcessor('energy-tap', EnergyTap);
`;

let loaded: Promise<void> | null = null;

export class OnsetMic {
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  /** mỗi khối: thời điểm (giây, đồng hồ audio()), năng lượng trung bình */
  onBlock?: (t: number, energy: number) => void;

  async start() {
    const c = audio();
    if (!c.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ đo nhịp (cần Chrome / Safari mới hơn).');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Thiết bị không hỗ trợ micro trong trình duyệt này');
    await c.resume();
    loaded ??= c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
    await loaded;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.src = c.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(c, 'energy-tap', { numberOfInputs: 1, numberOfOutputs: 1 });
    // nối ra loa với âm lượng 0 để trình duyệt luôn chạy khâu xử lý
    this.sink = c.createGain();
    this.sink.gain.value = 0;
    this.node.port.onmessage = (e: MessageEvent<number[]>) => {
      const b = e.data;
      for (let i = 0; i < b.length; i += 2) this.onBlock?.(b[i], b[i + 1]);
    };
    this.src.connect(this.node).connect(this.sink).connect(c.destination);
  }

  stop() {
    this.node?.port.close();
    this.src?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.src = null; this.node = null; this.sink = null;
  }
}

/** ước lượng độ trễ vòng khi không đo được (đeo tai nghe): độ trễ loa của trình duyệt + chút độ trễ micro */
export function estimatedLatency(): number {
  const c = audio();
  return (c.outputLatency || 0) + (c.baseLatency || 0) + 0.02;
}
