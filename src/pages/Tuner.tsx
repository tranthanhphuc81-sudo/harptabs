import { Link } from 'react-router-dom';
import { BRAND } from '../appConfig';
import { useEffect, useRef, useState } from 'react';
import { HarpKey, HarpType, harpLayout, holeCount, isChromatic, isFingered, isFretted, isKalimba, isDanBau, isOcarina, isPianica, isOrgan, isTranh, isRecorder, isSaoTruc, isTremolo, isTwoRowChromatic, midiToHz, midiToName, TECHNIQUE_LABEL } from '../lib/harp';
import { MicPitch, PitchReading } from '../audio/pitch';
import { canHoldNote } from '../lib/pitchPractice';
import { HarpDiagram } from '../components/HarpDiagram';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { TokenText } from '../components/TabView';
import { useAppState } from '../state';
import { useWakeLock } from '../components/useWakeLock';
import { t } from '../lib/i18n';
import { LangToggle } from '../components/LangToggle';

export default function Tuner() {
  const { settings } = useAppState();
  const [key, setKey] = useState<HarpKey>(settings.defaultHarpKey);
  const [type, setType] = useState<HarpType>(settings.defaultHarpType);
  const chrom = isChromatic(type);
  const trem = isTremolo(type);
  const [on, setOn] = useState(false);
  const [r, setR] = useState<PitchReading | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const micRef = useRef<MicPitch | null>(null);
  const smooth = useRef<number[]>([]);
  const holdRef = useRef<{ r: PitchReading | null; t: number }>({ r: null, t: 0 });

  useEffect(() => () => micRef.current?.stop(), []);
  useWakeLock(on);
  // dây trầm guitar (Mi2 ~82 Hz), dây buông đàn bầu (Đô3 ~131 Hz) thấp hơn tầm dò mặc định của kèn (150 Hz): hạ tầm dò theo nốt thấp nhất của đàn
  const lowHz = Math.round(Math.min(150, midiToHz(Math.min(...harpLayout(key, type).map((n) => n.midi))) * 0.85));

  const start = async () => {
    setErr(null);
    const mic = new MicPitch({ minHz: lowHz });
    mic.onReading = (x) => {
      const now = performance.now();
      if (!x) {
        // giữ kết quả cuối 400ms để chữ không nhấp nháy
        if (now - holdRef.current.t > 400) { setR(null); smooth.current = []; }
        return;
      }
      smooth.current.push(x.cents);
      if (smooth.current.length > 6) smooth.current.shift();
      const avg = smooth.current.reduce((a, b) => a + b, 0) / smooth.current.length;
      const out = { ...x, cents: avg };
      holdRef.current = { r: out, t: now };
      setR(out);
    };
    try {
      await mic.start();
      micRef.current = mic;
      setOn(true);
    } catch (e) {
      setErr((e as Error).name === 'NotAllowedError' ? t('Bạn chưa cho phép dùng micro. Bật quyền micro cho trang này rồi thử lại.') : (e as Error).message);
    }
  };
  const stop = () => { micRef.current?.stop(); micRef.current = null; setOn(false); setR(null); };
  // đổi loại đàn khi micro đang bật: mở lại micro với tầm dò mới
  const lowRef = useRef(lowHz);
  useEffect(() => {
    if (lowRef.current === lowHz) return;
    lowRef.current = lowHz;
    if (micRef.current) { micRef.current.stop(); micRef.current = null; void start(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowHz]);

  const matches = r ? harpLayout(key, type).filter((n) => n.midi === r.nearest) : [];
  const cents = r ? Math.round(r.cents) : 0;
  const inTune = r && Math.abs(cents) <= 15;

  // chú thích dưới nốt: guitar / ukulele ghi rõ dây + phím; bỏ chữ trùng; chỉ còn "Thế thường" thì không ghi (không nói thêm gì)
  const techLine = (() => {
    const labels = [...new Set(matches.map((m) => {
      if (isTwoRowChromatic(type)) return (m.slide ? t('Hàng trên') : t('Hàng dưới')) + (m.dir === 'blow' ? t(', thổi') : t(', hút'));
      if (isFretted(type)) { const [str, fret] = m.token.split('.'); return Number(fret) ? t('Dây {0} phím {1}', str, fret) : t('Dây {0} buông', str); }
      return TECHNIQUE_LABEL[m.technique];
    }))];
    return labels.length === 1 && labels[0] === TECHNIQUE_LABEL.fingered ? '' : labels.join(' / ');
  })();

  return (
    <div className="page page-tuner">
      <header className="page-head">
        <div>
          <h1>{t('Dò nốt')}</h1>
          <p className="muted">{isPianica(type) ? t('Thổi kèn pianica, app cho biết nốt gì, phím nào và có chuẩn không.') : isOrgan(type) ? t('Hát hoặc chơi một nốt (đàn khác, bài đang nghe), app cho biết nốt gì và nằm ở phím nào trên đàn — dùng để dò nốt một bài theo tai.') : isFretted(type) ? t('Gảy dây đàn, app cho biết nốt gì, nằm ở dây nào phím nào và có chuẩn không — dùng để lên dây.') : isKalimba(type) ? t('Gảy phím kalimba, app cho biết nốt gì, phím nào và có chuẩn không — dùng để chỉnh dây (gõ phím lên / xuống).') : isTranh(type) || isDanBau(type) ? t('Gảy dây đàn, app cho biết nốt gì, dây nào và có chuẩn không — dùng để lên dây.') : isFingered(type) ? t('Thổi sáo, app cho biết bạn đang ra nốt gì, thế bấm nào và có chuẩn không.') : <>{t('Thổi vào kèn, app cho biết bạn đang ra nốt gì, lỗ nào')}{trem ? t(' và có chuẩn không.') : isTwoRowChromatic(type) ? t(', hàng trên hay hàng dưới, và có chuẩn không.') : chrom ? t(', có bấm nút gạt hay không, và có chuẩn không.') : t(', và bend đã đủ sâu chưa.')}</>}</p>
        </div>
        <LangToggle />
      </header>

      <div className="row gap wrap end-align">
        <HarpTypeSelect value={type} onChange={setType} id="tuner-type" />
        <KeySelect value={key} onChange={(k) => setKey(k as HarpKey)} id="tuner-key" harpType={type} />
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? t('Tắt micro') : t('Bật micro')}
        </button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      <div className={`tuner-readout${inTune ? ' in-tune' : ''}`} aria-live="polite">
        <div className="tr-token">
          {matches.length ? matches.map((m, i) => (
            <span key={m.token} className={`tr-tok ${m.dir}`}>
              {i > 0 && <span className="tr-or">{t('hoặc')}</span>}
              <TokenText token={m.token} strings={isFretted(type) ? holeCount(type) : undefined} />
            </span>
          )) : <span className="tr-none">{on ? (r ? t('ngoài tầm {0}', BRAND.noun) : t('đang nghe…')) : '–'}</span>}
        </div>
        <div className="tr-note">
          {r ? <>{midiToName(r.nearest, settings.noteNames)} <span className="muted">{r.hz.toFixed(1)} Hz</span></> : ' '}
        </div>
        <div className="tr-tech">{techLine || ' '}</div>
        <div className="cents-meter" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={cents} aria-label={t('Độ lệch cao độ (cent)')}>
          <div className="cm-scale"><span>−50</span><span>0</span><span>+50</span></div>
          <div className="cm-track"><div className="cm-center" /><div className="cm-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%`, opacity: r ? 1 : 0 }} /></div>
          <div className="cm-hint">
            {!r ? ' ' : inTune ? t('Chuẩn') : cents < 0 ? t('Thấp {0} cent', -cents) : `Cao ${cents} cent`}
          </div>
        </div>
      </div>

      <HarpDiagram harpKey={key} harpType={type} highlight={matches.map((m) => m.token)} nameStyle={settings.noteNames} />
      {isDanBau(type) && <p className="row gap wrap"><Link to="/tap-boi-am" className="btn btn-ghost">{t('Tập bồi âm: chấm từng lần gảy')}</Link><Link to="/tap-boi-am?mode=nan" className="btn btn-ghost">{t('Tập nắn cần')}</Link></p>}
      {isTranh(type) && <p><Link to="/tap-cao-do?mode=bend" className="btn btn-ghost">{t('Tập nhấn: thước cao độ thiếu / đủ / quá')}</Link></p>}
      {type === 'diatonic' && <p><Link to="/tap-cao-do?mode=bend" className="btn btn-ghost">{t('Tập bend từng lỗ')}</Link></p>}
      {canHoldNote(type) && <p><Link to="/tap-cao-do?mode=hold" className="btn btn-ghost">{t('Tập giữ nốt dài')}</Link></p>}
      {isFretted(type) && <p><Link to={`/tap-hop-am?inst=${type === 'ukulele4' ? 'ukulele' : 'guitar'}`} className="btn btn-ghost">{t('Tập hợp âm: app nghe từng lần quạt')}</Link></p>}
      {isDanBau(type)
        ? <p className="muted small">{t('Mẹo đàn bầu: lên dây buông đúng nốt chủ (dây Đô: Đô3), rồi gảy bồi 1/2 để kiểm tra — phải ra đúng Đô cao hơn một quãng tám. Tập nắn cần: gảy bồi rồi đẩy / kéo cần tới khi kim chỉ đúng nốt cần ra.')}</p>
        : isTranh(type)
        ? <p className="muted small">{t('Mẹo lên dây đàn tranh: gảy từng dây buông, kim lệch trái là thấp → vặn trục cho căng hoặc đẩy nhạn ra xa; lệch phải là cao → nới dây. Dây Bắc từ dây 1: Sol La Đô Rê Mi lặp lại (dây Đảo: Sol La Đô Rê Fa). Tập nhấn: nhấn dây phía trái nhạn tới khi kim chỉ đúng nốt cần ra.')}</p>
        : isOcarina(type)
        ? <p className="muted small">{t('Mẹo: ocarina rất nhạy với hơi thổi — thổi mạnh thì nốt cao lên, yếu thì thấp xuống. Nhìn kim cent để tìm độ mạnh đúng cho từng nốt (nốt trầm nhẹ, nốt cao mạnh dần); lỗ bịt chưa kín làm nốt rè.')}</p>
        : isOrgan(type)
        ? <p className="muted small">{t('Đàn organ / piano điện luôn đúng tông nên không cần chỉnh. Dùng trang này để dò nốt theo tai: hát từng nốt của câu nhạc, app chỉ phím trên sơ đồ bàn phím. Piano cơ lâu ngày lệch tông thì cần thợ lên dây.')}</p>
        : isPianica(type)
        ? <p className="muted small">{t('Mẹo: pianica thổi mạnh quá thì nốt hơi cao và rè, yếu quá thì tiếng nhỏ, hơi thấp. Nhìn kim cent để tập giữ hơi đều; nốt lệch hẳn dù thổi đều là lưỡi gà cần chỉnh ở tiệm nhạc.')}</p>
        : isFretted(type)
        ? <p className="muted small">{t('Lên dây chuẩn:')} {type === 'ukulele4' ? <>{t('dây 4 → 1:')} <strong>G4 C4 E4 A4</strong> {t('(Sol Đô Mi La, dây 4 Sol cao)')}</> : <>{t('dây 6 → 1:')} <strong>E2 A2 D3 G3 B3 E4</strong> {t('(Mi La Rê Sol Si Mi)')}</>}{t('. Gảy dây buông: kim lệch trái là thấp → vặn khoá căng dây; lệch phải là cao → nới dây. Nới thấp một chút rồi vặn lên tới chuẩn để dây giữ tông lâu.')}</p>
        : isKalimba(type)
        ? <p className="muted small">{t('Mẹo chỉnh dây kalimba: nốt thấp (kim lệch trái) thì gõ nhẹ phím vào trong cho phím ngắn lại; nốt cao thì gõ phím ra ngoài cho dài ra. Gõ từng chút rồi đo lại.')}</p>
        : isSaoTruc(type)
        ? <p className="muted small">{t('Mẹo: sáo trúc thổi hơi chếch, nốt cao / thấp thay đổi theo góc thổi và độ mạnh. Nhìn kim cent để tập giữ hơi; lỗ bịt chưa kín làm nốt rè hoặc vọt quãng.')}</p>
        : isRecorder(type)
        ? <p className="muted small">{t('Mẹo: sáo dọc thổi mạnh quá thì nốt cao lên (và dễ vọt quãng tám), yếu quá thì thấp xuống. Nhìn kim cent để tập giữ hơi đều; ngón bịt chưa kín cũng làm nốt lệch hoặc rè.')}</p>
        : trem
        ? <p className="muted small">{t('Mẹo: mỗi nốt tremolo có hai lưỡi gà chỉnh lệch nhau một chút để tạo tiếng rung, nên kim lệch cent hơi dao động là bình thường. Nốt lạc hẳn sang lỗ bên thường do môi chưa khép gọn một lỗ.')}</p>
        : isTwoRowChromatic(type)
        ? <p className="muted small">{t('Mẹo: Tombo S-50 mỗi lỗ chỉ một lưỡi, lỗ rất hẹp — nốt lạc sang lỗ bên hoặc sang hàng kia thường do môi chưa khép gọn một lỗ.')}</p>
        : chrom
        ? <p className="muted small">{t('Mẹo: kèn chromatic có nhiều cách ra cùng một nốt (ví dụ Đô ở lỗ 4 thổi, lỗ 5 thổi, hoặc')} <strong>−4&lt;</strong>{t('). Nốt kêu rè hoặc lệch cent thường do bấm gạt chưa hết hoặc hơi lọt sang lỗ bên.')}</p>
        : <p className="muted small">{t('Mẹo: khi tập bend, nhìn kim lệch cent. Bend nửa cung ở lỗ 4 chuẩn khi app hiện')} <strong>−4′</strong> {t('và kim ở giữa.')}</p>}
    </div>
  );
}
