import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db, downloadJson, ensureSeeded, exportAll, importBackup } from '../lib/db';
import { HarpKey } from '../lib/harp';
import { VND_PER_USD, geminiUrl } from '../../shared/ai';
import { KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export default function SettingsPage() {
  const { settings: s, update, toast } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const count = useLiveQuery(() => db.songs.count(), []);
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
    const data = await exportAll();
    downloadJson(data, `harptabs-sao-luu-${new Date().toISOString().slice(0, 10)}.json`);
    toast(`Đã xuất ${data.songs.length} bài`);
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
        <h2>Hiển thị</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Giao diện</span>
            <select value={s.theme} onChange={(e) => update({ theme: e.target.value as typeof s.theme })}>
              <option value="system">Theo máy</option><option value="light">Sáng</option><option value="dark">Tối</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Cỡ chữ tab</span>
            <select value={s.tabSize} onChange={(e) => update({ tabSize: e.target.value as typeof s.tabSize })}>
              <option value="s">Nhỏ</option><option value="m">Vừa</option><option value="l">Lớn (để xa khi thổi)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Tên nốt</span>
            <select value={s.noteNames} onChange={(e) => update({ noteNames: e.target.value as typeof s.noteNames })}>
              <option value="letter">C D E F G A B</option><option value="solfege">Đô Rê Mi Fa Sol La Si</option>
            </select>
          </label>
          <KeySelect value={s.defaultHarpKey} onChange={(k) => update({ defaultHarpKey: k as HarpKey })} label="Kèn mặc định" />
          <label className="check wide">
            <input type="checkbox" checked={s.showNoteNames} onChange={(e) => update({ showNoteNames: e.target.checked })} />
            Hiện tên nốt phía trên tab
          </label>
        </div>
      </section>

      <section className="panel">
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
      </section>

      <section className="panel">
        <h2>Dữ liệu</h2>
        <p className="muted">{count ?? 0} bài đang lưu trên thiết bị này. Xoá dữ liệu trình duyệt sẽ mất bài, nên thỉnh thoảng hãy xuất file sao lưu.</p>
        <div className="row gap wrap">
          <button type="button" className="btn btn-primary" onClick={doExport}><Icon name="download" size={18} /> Xuất file sao lưu</button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> Nhập file sao lưu</button>
          <button type="button" className="btn btn-ghost" onClick={restoreSamples}>Khôi phục bài mẫu</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
      </section>

      <p className="muted small about">Sổ Tab Harmonica 1.0. Bài mẫu chỉ gồm nhạc thuộc phạm vi công cộng.</p>
    </div>
  );
}
