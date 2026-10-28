/** Bài học cho app Sổ Tab Kalimba (kalimba 17 phím tông C, có bài cho đàn 8 / 10 phím). Tab ghi số 1–7, chấm trên = quãng tám cao. */
import type { Lesson } from './lessons';

const K = { harpKey: 'C' as const, harpType: 'kalimba17' as const };

export const KALIMBA_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật', 'Âm nhạc', 'Bảo quản và mẹo'];

export const KALIMBA_LESSONS: Lesson[] = [
  {
    id: 'kalimba-lam-quen',
    group: 'Bắt đầu',
    title: 'Làm quen với kalimba',
    summary: 'Cầm đàn, gảy bằng ngón cái, phím nào ra nốt nào.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Cầm đàn bằng hai tay, hai **ngón cái** đặt lên phím, các ngón còn lại đỡ mặt sau.',
        'Gảy bằng **mép móng / đầu ngón cái**, đẩy phím xuống rồi thả trượt ra. Gảy nhẹ cũng đủ vang.',
        '**Phím dài nhất ở giữa** là nốt thấp nhất (Đô = 1). Lên cao thì **xen kẽ sang trái, sang phải**: Rê bên trái, Mi bên phải, Fa bên trái…',
        'Nốt bên trái gảy tay trái, bên phải gảy tay phải — hai tay thay nhau rất tự nhiên.',
      ] },
      { t: 'diagram', ...K },
      { t: 'tip', text: 'Nhiều kalimba có số / chấm khắc sẵn trên phím: số 1–7 là Đô–Si, chấm trên là lên quãng tám — giống hệt tab trong app.' },
    ],
  },
  {
    id: 'kalimba-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab kalimba',
    summary: 'Số 1–7, chấm quãng tám, hình phím nhỏ dưới mỗi nốt.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        '**1 2 3 4 5 6 7** = Đô Rê Mi Fa Sol La Si (theo tông kalimba; kalimba C thì 1 = Đô).',
        '**Chấm trên** số (1°) = lên một quãng tám; hai chấm = lên hai quãng tám.',
        'Hình nhỏ dưới mỗi số: cả cây đàn (17, 10 hoặc 8 phím), **phím tô màu là phím cần gảy**.',
        'Ô dài hơn = ngân lâu hơn; dấu – là nghỉ. Muốn tên Đô-Rê-Mi phía trên: Cài đặt → Hiện tên nốt.',
      ] },
      { t: 'tab', caption: 'Twinkle Twinkle Little Star', body: '1 1 5 5 6 6 5:2\n4 4 3 3 2 2 1:2\n', bpm: 90, style: 'ballad', ...K },
    ],
  },
  {
    id: 'kalimba-chon-dan',
    group: 'Bắt đầu',
    title: 'Kalimba 8, 10 hay 17 phím?',
    summary: 'Đàn nhỏ chơi được bài nào, cách chọn loại đàn trong app.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        '**8 phím**: Đô4 … Đô5 — đủ một quãng tám, chơi được bài thiếu nhi, bài hát ru ngắn.',
        '**10 phím**: Đô4 … Mi5 — thêm 2°, 3°, chơi được phần lớn bài dân ca, bài hát đơn giản.',
        '**17 phím**: Đô4 … Mi6 — loại phổ biến nhất, đủ tầm cho hầu hết bài hát.',
        'Cả ba loại đều xếp **phím thấp nhất ở giữa**, lên cao xen kẽ trái – phải, nên tab số đọc giống nhau.',
      ] },
      { t: 'diagram', harpKey: 'C', harpType: 'kalimba10' },
      { t: 'diagram', harpKey: 'C', harpType: 'kalimba8' },
      { t: 'tip', text: 'Đàn nhỏ: vào **Cài đặt** chọn loại kalimba 8 hoặc 10 phím. Ở trang bài, ô "Xem cho kalimba" xếp lại bài (dịch giọng nếu cần) và báo số nốt nằm ngoài tầm đàn.' },
    ],
  },
  {
    id: 'kalimba-hai-tay',
    group: 'Kỹ thuật',
    title: 'Hai tay thay nhau và gảy hai phím',
    summary: 'Luyện đi thang âm xen kẽ trái phải, rồi gảy hai nốt cùng lúc.',
    minutes: 6,
    blocks: [
      { t: 'tab', caption: 'Thang âm Đô trưởng: tay trái – tay phải luân phiên', body: '1 2 3 4 5 6 7 1°:2\n1° 7 6 5 4 3 2 1:2\n', bpm: 72, style: 'metronome', ...K },
      { t: 'p', text: 'Hai phím **cạnh nhau** (ví dụ 1 và 3, ở hai bên phím giữa) gảy cùng lúc bằng một ngón cái là ra **quãng 3** — hợp âm nhỏ rất hay. Thử gảy 1+3, rồi 3+5.' },
      { t: 'tip', text: 'Tiếng rè: phím chạm nhau hoặc vật lạ dưới cầu đàn. Tiếng tắt nhanh: ngón tay chạm vào phím vừa gảy.' },
    ],
  },
  {
    id: 'kalimba-truong-do',
    group: 'Kỹ thuật',
    title: 'Giữ nhịp: nốt dài, nốt ngắn, dấu nghỉ',
    summary: 'Đếm phách khi gảy, để nốt ngân đủ và nghỉ đúng chỗ.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Đếm to "1 – 2 – 3 – 4" theo tiếng gõ nhịp, mỗi tiếng gõ là **một phách**.',
        'Ô số ngắn = nửa phách (gảy nhanh hai nốt trong một tiếng gõ); ô dài = ngân 2 phách trở lên — **đừng chặn phím**, để nó tự vang.',
        'Dấu – là **nghỉ**: không gảy, nhưng vẫn đếm.',
      ] },
      { t: 'tab', caption: 'Một phách, hai phách, nửa phách', body: '1 1 1 1\n3:2 3:2\n5:0.5 5:0.5 5:0.5 5:0.5 5 r\n1°:4\n', bpm: 72, style: 'metronome', ...K },
      { t: 'tab', caption: 'Ode to Joy (đoạn đầu)', body: '3 3 4 5 5 4 3 2\n1 1 2 3 3:1.5 2:0.5 2:2\n', bpm: 84, style: 'ballad', ...K },
      { t: 'tip', text: 'Bật **Chờ nốt** ở trang bài: app chỉ đi tiếp khi bạn gảy đúng nốt — tập chậm cho chắc rồi mới chơi theo nhạc.' },
    ],
  },
  {
    id: 'kalimba-hop-am',
    group: 'Kỹ thuật',
    title: 'Hợp âm I, IV, V nằm sát nhau',
    summary: 'Gảy ba phím liền nhau bằng một ngón cái là ra hợp âm.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Nhờ cách xếp xen kẽ, ba nốt của hợp âm trưởng thường là **ba phím liền nhau**. Đặt ngón cái lên phím đầu rồi miết qua cả ba: tiếng hợp âm rải rất đẹp.' },
      { t: 'list', items: [
        '**Hợp âm I (Đô)**: 1 – 3 – 5 — phím giữa và hai phím ngay bên phải.',
        '**Hợp âm IV (Fa)**: 4 – 6 – 1° — ba phím liền nhau bên trái.',
        '**Hợp âm V (Sol)**: 5 – 7 – 2° — ba phím liền nhau bên phải.',
        '**Hợp âm vi (La thứ)**: 6 – 1° – 3° — bên trái, xa phím giữa hơn.',
      ] },
      { t: 'diagram', ...K },
      { t: 'tab', caption: 'Rải hợp âm I – IV – V – I', body: '1:0.5 3:0.5 5 r:2\n4:0.5 6:0.5 1° r:2\n5:0.5 7:0.5 2° r:2\n1:0.5 3:0.5 5:3\n', bpm: 72, style: 'ballad', ...K },
      { t: 'tip', text: 'Ở trang bài, bật **Hợp âm** để xem hợp âm của từng đoạn: gảy nốt gốc bằng tay trái, giai điệu bằng tay phải là thành bài có đệm.' },
    ],
  },
  {
    id: 'kalimba-vibrato',
    group: 'Kỹ thuật',
    title: 'Rung tiếng (vibrato) và láy nốt',
    summary: 'Che – mở lỗ thoát âm sau đàn, gảy lặp nhanh hai phím.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '**Kalimba hộp** có lỗ tròn phía sau: gảy một nốt dài rồi dùng ngón giữa **che – mở lỗ** liên tục, tiếng sẽ "ưa – ưa" như rung.',
        'Che lỗ trước rồi mở ra sau khi gảy: ra tiếng **"wah"**.',
        '**Láy**: hai ngón cái gảy xen kẽ thật nhanh hai phím kề nhau (ví dụ 3 và 2), như tiếng chuông ngân.',
        'Kalimba tấm phẳng không có lỗ: đưa đàn lại gần / ra xa người để tiếng to nhỏ dần.',
      ] },
      { t: 'tab', caption: 'Láy 3 – 2 rồi ngân', body: '3:0.25 2:0.25 3:0.25 2:0.25 3:3\n5:0.25 3:0.25 5:0.25 3:0.25 5:3\n', bpm: 72, style: 'metronome', ...K },
    ],
  },
  {
    id: 'kalimba-ngu-cung',
    group: 'Âm nhạc',
    title: 'Ngẫu hứng bằng thang ngũ cung',
    summary: '5 nốt 1 2 3 5 6: gảy nốt nào cũng hợp, tập chơi tự do trên nền nhạc.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Bỏ hai nốt **4 và 7** ra khỏi thang Đô trưởng là còn **thang ngũ cung** 1 2 3 5 6. Trên nền nhạc giọng Đô, gảy các nốt này theo thứ tự nào cũng nghe hợp — rất dễ để bắt đầu ngẫu hứng.' },
      { t: 'tab', caption: 'Thang ngũ cung lên, xuống', body: '1:0.5 2:0.5 3:0.5 5:0.5 6:0.5 1°:0.5 2°:0.5 3°:0.5\n3°:0.5 2°:0.5 1°:0.5 6:0.5 5:0.5 3:0.5 2:0.5 1:0.5\n', bpm: 80, style: 'ballad', ...K },
      { t: 'list', items: [
        'Bắt đầu bằng câu ngắn 3–4 nốt, **kết câu ở 1 hoặc 5** nghe sẽ "chắc".',
        'Chơi 2 ô, nghỉ 2 ô; lặp lại câu của mình rồi đổi một chút.',
        'Nhạc ngũ cung rất gần với dân ca Việt Nam: thử ngân nga một câu dân ca quen bằng các nốt này.',
      ] },
      { t: 'link', to: '/jam', label: 'Tập ngẫu hứng trên nền nhạc', text: 'Nền blues 12 ô chạy lặp, tô các phím ngũ cung trên cây đàn; có máy hỏi – bạn đáp và thư viện lick cho kalimba.' },
    ],
  },
  {
    id: 'kalimba-dem-hat',
    group: 'Âm nhạc',
    title: 'Giai điệu kèm nốt trầm',
    summary: 'Tay trái giữ nốt gốc, tay phải chơi giai điệu.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Khi đã quen giai điệu, thêm **một nốt trầm** ở đầu mỗi ô nhịp: gảy cùng lúc nốt gốc của hợp âm (1, 4 hoặc 5) và nốt giai điệu. Bài nghe đầy đặn như có người đệm.' },
      { t: 'list', items: [
        'Nốt trầm nằm gần phím giữa: **1** (giữa), **4** (trái), **5** (phải).',
        'Gảy nốt trầm và nốt giai điệu **cùng lúc** bằng hai ngón cái, các nốt sau chỉ gảy giai điệu.',
        'Không chắc hợp âm? Bật **Hợp âm** ở trang bài để xem: C → 1, F → 4, G → 5.',
      ] },
      { t: 'tab', caption: 'Twinkle Twinkle (giai điệu)', body: '1 1 5 5 6 6 5:2\n4 4 3 3 2 2 1:2\n', bpm: 84, style: 'ballad', ...K },
      { t: 'tip', text: '"1 1 5 5": tới nốt 5 đầu tiên thì gảy thêm 1 cùng lúc. "6 6 5": gảy 4 cùng nốt 6 đầu. "4 4 3 3": nốt 4 đã là nốt gốc, tới 3 thì gảy thêm 1. "2 2 1": gảy 5 cùng nốt 2 đầu.' },
    ],
  },
  {
    id: 'kalimba-chinh-day',
    group: 'Bảo quản và mẹo',
    title: 'Chỉnh dây kalimba bằng app',
    summary: 'Dùng trang Dò nốt, gõ nhẹ phím lên / xuống để chỉnh.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Mở **Dò nốt**, gảy từng phím, xem kim lệch bao nhiêu cent.',
        'Nốt **thấp** (kim lệch trái): gõ nhẹ đầu phím **vào trong** cho phần rung ngắn lại.',
        'Nốt **cao** (kim lệch phải): gõ nhẹ phím **ra ngoài** cho phần rung dài ra.',
        'Gõ từng chút bằng búa chỉnh đi kèm đàn, đo lại sau mỗi lần.',
      ] },
      { t: 'warn', text: 'Đừng bẻ cong phím. Kalimba gỗ nên tránh nắng và nơi ẩm; lau phím khô sau khi chơi để không gỉ.' },
    ],
  },
];
