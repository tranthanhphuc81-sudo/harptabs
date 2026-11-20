import { LANG, setLang, type Lang } from '../lib/i18n';

const OPTIONS: { lang: Lang; short: string; name: string }[] = [
  { lang: 'vi', short: 'VI', name: 'Tiếng Việt' },
  { lang: 'en', short: 'EN', name: 'English' },
];

/**
 * Nút chuyển ngôn ngữ ở đầu trang (VI | EN). Đổi thì tải lại trang (xem lib/i18n.ts).
 * Mặc định đặt ở góc trên bên phải `.page-head`; `inline` để nằm trong một hàng nút có sẵn.
 */
export function LangToggle({ inline = false }: { inline?: boolean }) {
  return (
    // nhãn luôn ghi hai thứ tiếng: lỡ chọn nhầm vẫn biết chỗ đổi lại
    <div className={`lang-toggle${inline ? ' inline' : ''}`} role="group" aria-label="Ngôn ngữ · Language">
      {OPTIONS.map((o) => (
        <button key={o.lang} type="button" lang={o.lang} title={o.name} aria-label={o.name} aria-pressed={LANG === o.lang}
          onClick={() => { if (LANG !== o.lang) setLang(o.lang); }}>
          {o.short}
        </button>
      ))}
    </div>
  );
}
