import { DEGREE_NAMES } from '../data/saoTrucFingerings';
import { BRAND, IS_GUITAR_APP, IS_HARMONICA_APP, IS_RECORDER_APP } from '../appConfig';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db, ensureSeeded, importBackup } from '../lib/db';
import { backupStatus, downloadBackup, loadBackupMeta } from '../lib/backup';
import { deleteAllRecordings } from '../lib/recordings';
import { HarpKey } from '../lib/harp';
import { VND_PER_USD, geminiUrl } from '../../shared/ai';
import { AI_ENABLED } from '../lib/features';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { ThemePicker } from '../components/ThemePicker';
import { SyncCalibrator } from '../components/SyncCalibrator';
import { useAppState } from '../state';

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const mb = (b: number) => (b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : b < 1e9 ? `${num(b / 1e6)} MB` : `${num(b / 1e9)} GB`);

/** Trình duyệt có giữ dữ liệu lâu dài không, đang dùng bao nhiêu bộ nhớ */
function useStorageInfo() {
  const [info, setInfo] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const refresh = async () => {
    const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    const [persisted, est] = await Promise.all([
      st?.persisted?.().catch(() => null) ?? null,
      st?.estimate?.().catch(() => undefined),
    ]);
    setInfo({ persisted, usage: est?.usage, quota: est?.quota });
  };
  useEffect(() => { void refresh(); }, []);
  const persist = async () => {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    await refresh();
    return !!ok;
  };
  return { ...info, refresh, persist };
}

export default function SettingsPage() {
  const { settings: s, update, toast } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const count = useLiveQuery(() => db.songs.count(), []);
  const storage = useStorageInfo();
  // bản thu karaoke: đếm theo bảng (cập nhật khi thêm / xoá)
  const recs = useLiveQuery(async () => {
    let count = 0, bytes = 0;
    await db.recordings.each((r) => { count++; bytes += r.size || 0; });
    return { count, bytes };
  }, []);
  const [confirmRecs, setConfirmRecs] = useState(false);
  const clearRecs = async () => {
    if (!confirmRecs) { setConfirmRecs(true); setTimeout(() => setConfirmRecs(false), 4000); return; }
    await deleteAllRecordings();
    setConfirmRecs(false);
    void storage.refresh();
    toast('Đã xoá hết bản thu karaoke');
  };
  const backup = useLiveQuery(async () => {
    const [songs, meta] = await Promise.all([db.songs.toArray(), loadBackupMeta()]);
    return backupStatus(songs, meta.lastBackupAt, null);
  }, []);
  const usage = useLiveQuery(async () => {
    const rows = await db.aiLog.toArray();
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
    const month = rows.filter((r) => r.at >= from.getTime());
    return {
      total: rows.length,
      totalUsd: rows.reduce((a, r) => a + r.costUsd, 0),
      month: month.length,
      monthUsd: month.reduce((a, r) => a + r.costUsd, 0),
    };
  }, []);

  const vnd = (usd: number) => `${Math.round(usd * VND_PER_USD).toLocaleString('vi-VN')}đ`;

  const test = async () => {
    setTesting(true);
    try {
      if (s.aiMode === 'proxy') {
        if (!s.proxyUrl) throw new Error('Chưa nhập địa chỉ máy chủ');
        const r = await fetch(`${s.proxyUrl.replace(/\/+$/, '')}/health`);
        if (!r.ok) throw new Error(`Máy chủ trả lỗi ${r.status}`);
        toast('Kết nối máy chủ AI thành công');
      } else {
        if (!s.geminiKey) throw new Error('Chưa nhập API key');
        const r = await fetch(geminiUrl(s.model).replace(':generateContent', ''), { headers: { 'x-goog-api-key': s.geminiKey } });
        if (r.status === 404) throw new Error(`Key hợp lệ nhưng không có model "${s.model}"`);
        if (!r.ok) throw new Error('API key không hợp lệ hoặc chưa bật Gemini API');
        toast(`Key hợp lệ, model ${s.model} sẵn sàng`);
      }
    } catch (e) {
      toast((e as Error).message === 'Failed to fetch' ? 'Không kết nối được — kiểm tra mạng hoặc địa chỉ' : (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const doExport = async () => {
    toast(`Đã xuất ${await downloadBackup()} bài`);
    void storage.refresh();
  };

  const askPersist = async () => {
    toast(await storage.persist()
      ? 'Trình duyệt sẽ giữ dữ liệu, không tự xoá khi máy đầy bộ nhớ'
      : 'Trình duyệt chưa đồng ý — cài app lên màn hình chính rồi thử lại, và nhớ xuất file sao lưu');
  };

  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const r = await importBackup(JSON.parse(await f.text()));
      toast(`Đã nhập ${r.added} bài mới, cập nhật ${r.updated}, bỏ qua ${r.skipped}`);
    } catch (e) {
      toast((e as Error).message || 'File không hợp lệ');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const restoreSamples = async () => {
    await db.kv.bulkDelete(['seeded', 'seededSamples']);
    await ensureSeeded();
    toast('Đã khôi phục các bài mẫu');
  };

  return (
    <div className="page page-settings">
      <header className="page-head"><h1>Cài đặt</h1></header>

      <section className="panel">
        <h2>Giao diện</h2>
        <ThemePicker palette={s.palette} mode={s.theme} onPalette={(palette) => update({ palette })} onMode={(theme) => update({ theme })} />
      </section>

      <section className="panel">
        <h2>Hiển thị</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Cỡ chữ tab</span>
            <select value={s.tabSize} onChange={(e) => update({ tabSize: e.target.value as typeof s.tabSize })}>
              <option value="s">Nhỏ</option><option value="m">Vừa</option><option value="l">Lớn (để xa khi thổi)</option>
            </select>
          </label>
          {!IS_HARMONICA_APP && !IS_GUITAR_APP && (
            <label className="field">
              <span className="field-label">Cỡ hình dưới nốt: {Math.round((s.fingerScale ?? 1) * 100)}%</span>
              <input type="range" min={0.6} max={2.5} step={0.1} value={s.fingerScale ?? 1} onChange={(e) => update({ fingerScale: Number(e.target.value) })} />
            </label>
          )}
          <label className="field">
            <span className="field-label">Tên nốt</span>
            <select value={s.noteNames} onChange={(e) => update({ noteNames: e.target.value as typeof s.noteNames })}>
              <option value="letter">C D E F G A B</option><option value="solfege">Đô Rê Mi Fa Sol La Si</option>
            </select>
          </label>
          <HarpTypeSelect value={s.defaultHarpType} onChange={(t) => update({ defaultHarpType: t })} label={`Loại ${BRAND.noun} mặc định`} />
          {IS_RECORDER_APP && (
            <label className="field">
              <span className="field-label">Kiểu bấm sáo</span>
              <select value={s.recorderFingering ?? 'baroque'} onChange={(e) => update({ recorderFingering: e.target.value as 'baroque' | 'german' })}>
                <option value="baroque">Baroque (phổ biến, lỗ 4 nhỏ hơn lỗ 5)</option>
                <option value="german">German (lỗ 4 to hơn lỗ 5)</option>
              </select>
            </label>
          )}
          {IS_RECORDER_APP && (
            <label className="field">
              <span className="field-label">Sáo trúc: bịt hết lỗ ra nốt</span>
              <select value={s.saoTrucClosed ?? 5} onChange={(e) => update({ saoTrucClosed: Number(e.target.value) })}>
                {DEGREE_NAMES.map((n, i) => <option key={n} value={i + 1}>{n} {i === 4 ? '(sáo Đô bịt hết ra Sol — phổ biến)' : `(sáo Đô bịt hết ra ${n})`}</option>)}
              </select>
              <span className="small muted">Tính theo tông sáo: sáo Đô chọn "Sol" thì bịt hết lỗ ra Sol, mở dần ra La, Si, Đô…</span>
            </label>
          )}
          {IS_GUITAR_APP && (
            <label className="field">
              <span className="field-label">Sơ đồ hợp âm</span>
              <select value={s.chordHorizontal ? 'h' : 'v'} onChange={(e) => update({ chordHorizontal: e.target.value === 'h' })}>
                <option value="v">Dựng đứng (như sách hợp âm, dây trầm bên trái)</option>
                <option value="h">Nằm ngang (cùng hướng với tab, dây 1 ở trên)</option>
              </select>
              <span className="small muted">Sách và trang hợp âm đều vẽ dựng đứng. Chọn nằm ngang nếu bạn chỉ dùng app này và muốn nhìn giống tab.</span>
            </label>
          )}
          <KeySelect value={s.defaultHarpKey} onChange={(k) => update({ defaultHarpKey: k as HarpKey })} label="Kèn mặc định" harpType={s.defaultHarpType} />
          <label className="check wide">
            <input type="checkbox" checked={s.showNoteNames} onChange={(e) => update({ showNoteNames: e.target.checked })} />
            Hiện tên nốt phía trên tab
          </label>
          <label className="check wide">
            <input type="checkbox" checked={s.keepAwake} onChange={(e) => update({ keepAwake: e.target.checked })} />
            Giữ màn hình sáng khi đang phát bài, chờ nốt hoặc dò nốt
          </label>
          {s.keepAwake && (
            <label className="check wide">
              <input type="checkbox" checked={s.keepAwakeAlways ?? true} onChange={(e) => update({ keepAwakeAlways: e.target.checked })} />
              Luôn giữ sáng suốt lúc app đang mở (tốn pin hơn)
            </label>
          )}
          <SyncCalibrator value={s.syncOffsetMs} onChange={(syncOffsetMs) => update({ syncOffsetMs })} />
          <label className="field wide">
            <span className="field-label">Độ trễ micro khi chấm điểm karaoke: {s.micLatencyMs} ms</span>
            <input type="range" min={0} max={300} step={10} value={s.micLatencyMs} onChange={(e) => update({ micLatencyMs: Number(e.target.value) })} />
            <span className="help">Hát đúng mà điểm "vào nhịp" thấp (nhất là micro Bluetooth): tăng số này.</span>
          </label>
        </div>
      </section>

      {AI_ENABLED && <section className="panel">
        <h2>Kết nối AI</h2>
        <p className="muted">AI chỉ dùng khi bạn nhập bài mới. Mọi phần còn lại chạy offline.</p>
        <fieldset className="radio-group">
          <legend className="sr-only">Cách kết nối</legend>
          <label>
            <input type="radio" checked={s.aiMode === 'proxy'} onChange={() => update({ aiMode: 'proxy' })} />
            Qua máy chủ AI <span className="muted">(khuyên dùng, API key nằm trên máy chủ — xem thư mục worker/)</span>
          </label>
          <label>
            <input type="radio" checked={s.aiMode === 'direct'} onChange={() => update({ aiMode: 'direct' })} />
            Gọi thẳng Gemini bằng key của bạn <span className="muted">(chỉ cho máy cá nhân, key lưu trên thiết bị này)</span>
          </label>
        </fieldset>
        <div className="form-grid">
          {s.aiMode === 'proxy' ? (
            <>
              <label className="field wide">
                <span className="field-label">Địa chỉ máy chủ AI</span>
                <input type="url" inputMode="url" value={s.proxyUrl} onChange={(e) => update({ proxyUrl: e.target.value.trim() })} placeholder="https://harptabs-ai.ten-ban.workers.dev" />
              </label>
              <label className="field wide">
                <span className="field-label">Mã ứng dụng (nếu máy chủ có đặt APP_TOKEN)</span>
                <input value={s.appToken} onChange={(e) => update({ appToken: e.target.value.trim() })} autoComplete="off" />
              </label>
            </>
          ) : (
            <label className="field wide">
              <span className="field-label">Gemini API key <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">lấy key miễn phí</a></span>
              <span className="row gap">
                <input className="grow" type={showKey ? 'text' : 'password'} value={s.geminiKey} onChange={(e) => update({ geminiKey: e.target.value.trim() })} autoComplete="off" spellCheck={false} />
                <button type="button" className="btn btn-ghost" onClick={() => setShowKey(!showKey)}>{showKey ? 'Ẩn' : 'Hiện'}</button>
              </span>
            </label>
          )}
          <label className="field wide">
            <span className="field-label">Model</span>
            <input list="models" value={s.model} onChange={(e) => update({ model: e.target.value.trim() })} spellCheck={false} />
            <datalist id="models">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
            <span className="help">Flash-lite rẻ và đủ tốt cho phần lớn bản nhạc. Khi dùng máy chủ proxy, model ngoài danh sách cho phép sẽ được đổi về mặc định.</span>
          </label>
        </div>
        <div className="row gap center wrap">
          <button type="button" className="btn btn-ghost" onClick={test} disabled={testing}>{testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
          {usage && (
            <span className="muted small">
              Tháng này {usage.month} lần, khoảng {vnd(usage.monthUsd)}. Tổng cộng {usage.total} lần, khoảng {vnd(usage.totalUsd)}.
            </span>
          )}
        </div>
      </section>}

      <section className="panel">
        <h2>Dữ liệu</h2>
        <p className="muted">{count ?? 0} bài đang lưu trên thiết bị này. Xoá dữ liệu trình duyệt sẽ mất bài, nên thỉnh thoảng hãy xuất file sao lưu.</p>
        <label className="check wide">
          <input type="checkbox" checked={s.shareStats} onChange={(e) => update({ shareStats: e.target.checked })} />
          <span>
            Gửi thống kê ẩn danh
            <span className="muted small" style={{ display: 'block' }}>Mỗi ngày một lần, app gửi một mã ngẫu nhiên của máy này, loại app (web / đã cài / Android) và số lần mở app, để tác giả biết có bao nhiêu người dùng. Không gửi bài hát, tên hay thông tin cá nhân.</span>
          </span>
        </label>
        <dl className="storage-info">
          <div>
            <dt>Sao lưu gần nhất</dt>
            <dd>
              {backup?.lastBackupAt ? new Date(backup.lastBackupAt).toLocaleDateString('vi-VN') : 'Chưa sao lưu'}
              {!!backup?.changed && <span className="muted"> · {backup.changed} bài mới / đã sửa sau đó</span>}
            </dd>
          </div>
          <div>
            <dt>Giữ dữ liệu lâu dài</dt>
            <dd>
              {storage.persisted === null ? 'Trình duyệt không hỗ trợ'
                : storage.persisted ? 'Đã bật — trình duyệt không tự xoá khi máy đầy bộ nhớ'
                : <>Chưa bật — trình duyệt có thể tự xoá khi máy đầy bộ nhớ <button type="button" className="link-btn" onClick={askPersist}>Bật</button></>}
            </dd>
          </div>
          {storage.usage !== undefined && (
            <div>
              <dt>Bộ nhớ đang dùng</dt>
              <dd>{mb(storage.usage)}{storage.quota ? <span className="muted"> · máy còn trống khoảng {mb(Math.max(0, storage.quota - storage.usage))}</span> : null}</dd>
            </div>
          )}
          <div>
            <dt>Bản thu karaoke</dt>
            <dd>
              {recs?.count ? <>{recs.count} bản · {mb(recs.bytes)} <button type="button" className="link-btn" onClick={() => void clearRecs()}>{confirmRecs ? 'Xoá thật?' : 'Xoá hết'}</button></> : 'Chưa có'}
              <span className="muted small" style={{ display: 'block' }}>Chỉ lưu trên máy này — không có trong file sao lưu.</span>
            </dd>
          </div>
        </dl>
        <div className="row gap wrap">
          <button type="button" className="btn btn-primary" onClick={doExport}><Icon name="download" size={18} /> Xuất file sao lưu</button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> Nhập file sao lưu</button>
          <button type="button" className="btn btn-ghost" onClick={restoreSamples}>Khôi phục bài mẫu</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
      </section>

      <p className="muted small about">
        {BRAND.name} 1.0. Bài mẫu chỉ gồm nhạc thuộc phạm vi công cộng.<br />
        © {new Date().getFullYear()} Trần Thanh Phúc. Liên hệ: <a href="tel:+84913656539">0913.65.65.39</a>
      </p>
    </div>
  );
}
