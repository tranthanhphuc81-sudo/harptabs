/** Nội dung học offline: kỹ thuật, thủ thuật, mẹo thổi harmonica diatonic và chromatic. */
import type { BeatStyle } from '../audio/patterns';
import { IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP, IS_PIANICA_APP, IS_TRANH_APP } from '../appConfig';
import { GUITAR_LESSON_GROUPS, GUITAR_LESSONS } from './guitarLessons';
import { PIANICA_LESSON_GROUPS, PIANICA_LESSONS } from './pianicaLessons';
import { TRANH_LESSON_GROUPS, TRANH_LESSONS } from './tranhLessons';
import { KALIMBA_LESSON_GROUPS, KALIMBA_LESSONS } from './kalimbaLessons';
import { RECORDER_LESSON_GROUPS, RECORDER_LESSONS } from './recorderLessons';
import type { HarpKey, HarpType } from '../lib/harp';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'list'; items: string[]; ordered?: boolean }
  | { t: 'tip'; text: string }
  | { t: 'warn'; text: string }
  | { t: 'tab'; body: string; caption?: string; harpKey?: HarpKey; harpType?: HarpType; bpm?: number; style?: BeatStyle; timeSig?: string }
  | { t: 'diagram'; harpKey?: HarpKey; harpType?: HarpType; advanced?: boolean }
  | { t: 'positions' }
  /** nút dẫn sang một trang khác của app (ví dụ trang tập ngẫu hứng) */
  | { t: 'link'; to: string; label: string; text?: string };

export interface Lesson {
  id: string;
  group: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
}

const HARMONICA_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật cơ bản', 'Bend và nâng cao', 'Âm nhạc', 'Bảo quản và mẹo', 'Kèn chromatic'];

const HARMONICA_LESSONS: Lesson[] = [
  // ---------------- BẮT ĐẦU ----------------
  {
    id: 'chon-va-cam-ken',
    group: 'Bắt đầu',
    title: 'Chọn kèn và cầm kèn',
    summary: 'Vì sao nên bắt đầu với kèn C, và cách cầm để hơi kín, tay thả lỏng.',
    minutes: 5,
    blocks: [
      { t: 'p', text: 'Harmonica diatonic 10 lỗ có 20 lưỡi gà (reed): mỗi lỗ một lưỡi cho hơi thổi, một lưỡi cho hơi hút. Mỗi cây chỉ chơi trọn thang âm của một tông, nên người chơi lâu năm thường có nhiều cây.' },
      { t: 'h', text: 'Cây đầu tiên: kèn C' },
      { t: 'list', items: [
        'Gần như mọi giáo trình và tab trên mạng đều viết cho kèn **C**.',
        'Kèn C nằm giữa dải: không quá trầm (khó bend đúng) cũng không quá cao (chói, khó kiểm soát).',
        'Nên chọn kèn có lược (comb) bằng nhựa: không nở khi ướt, dễ vệ sinh.',
        'Sau kèn C, cây thứ hai hợp lý là **A** hoặc **G** để chơi blues vị trí 2 ở giọng Mi và Rê.',
      ] },
      { t: 'h', text: 'Cách cầm' },
      { t: 'list', ordered: true, items: [
        'Tay trái cầm kèn giữa ngón cái và ngón trỏ, mặt có số lỗ hướng lên, lỗ 1 (trầm) bên trái.',
        'Tay phải khum lại, ôm phía sau tay trái tạo thành một "hộp cộng hưởng". Đóng mở tay phải sẽ tạo hiệu ứng wah ở bài sau.',
        'Đưa kèn sâu vào giữa hai môi, môi ướt và mềm, chạm phần nắp kim loại chứ không chỉ mép lỗ.',
        'Vai, cổ, hàm thả lỏng. Đầu thẳng, kèn nằm ngang hoặc hơi chúc phần sau xuống.',
      ] },
      { t: 'tip', text: 'Di chuyển kèn chứ đừng di chuyển đầu. Miệng giữ nguyên, tay trượt kèn sang trái phải.' },
    ],
  },
  {
    id: 'doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc harptab',
    summary: 'Ký hiệu thổi, hút, bend trong app và những kiểu ghi khác bạn sẽ gặp trên mạng.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Harptab ghi số lỗ thay vì nốt nhạc, nên không cần biết đọc khuông nhạc. Trong app này:' },
      { t: 'list', items: [
        '`4` là thổi lỗ 4 (một số nơi ghi `+4`).',
        '`-4` là hút lỗ 4.',
        "`-3'` là hút lỗ 3 rồi bend xuống nửa cung; `-3''` bend 1 cung; `-3'''` bend 1 cung rưỡi.",
        "`8'` là bend khi thổi (chỉ có ở lỗ 7–10).",
        '`6o` là overblow, `-7o` là overdraw: kỹ thuật nâng cao.',
        '`4:2` nghĩa là giữ 2 phách, `4:0.5` là nửa phách. Không ghi gì là 1 phách.',
      ] },
      { t: 'p', text: 'Ô nốt trong app có độ rộng theo độ dài nốt, màu vàng đồng là thổi, màu xanh là hút, dấu phẩy nhỏ màu đỏ là bend.' },
      { t: 'h', text: 'Các kiểu ghi khác trên mạng' },
      { t: 'list', items: [
        '`4` / `-4`, `+4` / `-4`, hoặc `4B` / `4D` (Blow/Draw): cùng nghĩa thổi/hút.',
        "`-3b`, `-3'`, `3b`: bend nửa cung. `-3bb`, `-3''`, `-3\"`: bend 1 cung.",
        'Số có vòng tròn hoặc gạch dưới thường là hút. Hãy đọc chú thích của trang đó.',
        'Tab ghi "kèn C" mà bạn có kèn khác: dùng nút đổi kèn trong app để chuyển tự động.',
      ] },
      { t: 'p', text: 'Sơ đồ dưới đây là toàn bộ nốt của kèn C. Chạm vào ô để nghe.' },
      { t: 'diagram', harpKey: 'C' },
      { t: 'tip', text: 'Lỗ 1–6 hút cao hơn thổi; từ lỗ 7 trở lên thì ngược lại. Vì vậy ở lỗ 7 trở lên, Si là hút (-7) và Đô là thổi (7).' },
    ],
  },
  {
    id: 'hoi-tho',
    group: 'Bắt đầu',
    title: 'Hơi thở',
    summary: 'Thở bằng bụng, hơi đi qua kèn nhẹ và đều. Âm hay đến từ luồng hơi chứ không từ lực thổi.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Người mới thường thổi và hút quá mạnh. Lưỡi gà của harmonica rất nhạy: hơi mạnh làm tiếng chát, dễ "tắc" (choke) và nhanh hỏng kèn.' },
      { t: 'list', ordered: true, items: [
        'Đặt tay lên bụng. Hít vào thấy bụng phồng, thở ra bụng xẹp. Vai và ngực gần như đứng yên.',
        'Mở họng như khi ngáp nhẹ hoặc nói "a". Hơi đi từ bụng qua họng mở thẳng vào kèn.',
        'Má không phồng, môi không mím chặt.',
        'Tưởng tượng bạn đang thở qua kèn chứ không phải thổi vào kèn.',
      ] },
      { t: 'p', text: 'Bài tập nốt dài: giữ mỗi nốt 4 phách, âm phải đều từ đầu đến cuối, không run, không tắt dần.' },
      { t: 'tab', caption: 'Nốt dài lỗ 4', body: '4:4 -4:4 4:4 -4:4\n5:4 -5:4 5:4 -5:4\n', bpm: 70, style: 'ballad' },
      { t: 'tip', text: 'Thổi và hút đổi nhau liên tục giúp bạn không bao giờ hết hơi hay bị đầy hơi. Đây là lợi thế riêng của harmonica.' },
    ],
  },
  {
    id: 'don-am',
    group: 'Bắt đầu',
    title: 'Thổi đơn âm',
    summary: 'Hai cách chỉ ra một lỗ: chu môi (pucker) và chặn lưỡi (tongue blocking).',
    minutes: 10,
    blocks: [
      { t: 'p', text: 'Đây là kỹ năng nền quan trọng nhất. Đừng vội tập bài khi một nốt còn bị lẫn sang lỗ bên cạnh.' },
      { t: 'h', text: 'Cách 1: chu môi (pucker)' },
      { t: 'list', ordered: true, items: [
        'Đặt kèn sâu vào miệng, chu môi như khi huýt sáo hoặc hút ống hút.',
        'Lỗ mở giữa hai môi nhỏ vừa bằng một lỗ kèn.',
        'Thổi nhẹ, trượt kèn chậm qua lại đến khi nghe một nốt trong, không rè.',
        'Dùng gương hoặc chạm ngón tay chặn lỗ hai bên để kiểm tra.',
      ] },
      { t: 'h', text: 'Cách 2: chặn lưỡi (tongue blocking)' },
      { t: 'list', ordered: true, items: [
        'Ngậm rộng 3–4 lỗ.',
        'Đặt đầu lưỡi lên mặt kèn chặn các lỗ bên trái, chừa lỗ bên phải ở khoé môi phải.',
        'Âm dày, ấm hơn và mở đường cho octave, slap, hợp âm đệm.',
      ] },
      { t: 'tip', text: 'Người mới nên học chu môi trước vì dễ bend hơn; sau vài tháng hãy tập thêm chặn lưỡi. Nhiều tay chơi giỏi dùng cả hai.' },
      { t: 'tab', caption: 'Đi từng lỗ, mỗi nốt phải sạch', body: '4 -4 4 -4 5 -5 5 -5\n6 -6 6 -6 5 -5 4:2\n', bpm: 72, style: 'ballad' },
      { t: 'tab', caption: 'Nhảy lỗ: giữ môi, trượt kèn', body: '4 6 4 6 5 7 5 7\n-4 -6 -4 -6 4:4\n', bpm: 66, style: 'ballad' },
      { t: 'link', to: '/tap-cao-do?mode=hold', label: 'Tập giữ nốt dài', text: 'Giữ một đơn âm thật đều: app đo giữ được bao lâu và cao độ có chao không.' },
    ],
  },
  {
    id: 'nhip-tau-hoa',
    group: 'Bắt đầu',
    title: 'Nhịp tàu hoả',
    summary: 'Bài tập nhịp kinh điển dùng hợp âm: tạo âm tàu chạy chỉ với lỗ 1–4.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Thổi và hút hợp âm (nhiều lỗ cùng lúc) theo nhịp đều tạo ra âm thanh giống đoàn tàu: một kỹ thuật đệm rất cổ điển của harmonica đồng quê và blues.' },
      { t: 'list', ordered: true, items: [
        'Ngậm 3–4 lỗ đầu (1–4), không cần đơn âm.',
        'Hút–hút–thổi–thổi lặp lại, nhấn ở phách đầu: "**hút**-hút-**thổi**-thổi".',
        'Tăng tốc dần như tàu rời ga, rồi chậm lại.',
        'Khi quen, dùng lưỡi đọc thầm "tu-ca-tu-ca" để nhịp sắc hơn.',
      ] },
      { t: 'p', text: 'App ghi hợp âm bằng một lỗ đại diện. Bật beat "Train" và chơi cả cụm 1–4 theo gợi ý dưới đây.' },
      { t: 'tab', caption: 'Đại diện: -2 là hút cụm 1–4, 2 là thổi cụm 1–4', body: '-2 -2 2 2 -2 -2 2 2\n-2 -2 2 2 -2 -2 2 2\n', bpm: 100, style: 'train' },
      { t: 'tip', text: 'Thêm "whoo-whoo" còi tàu: hút cùng lúc lỗ 4 và 5 rồi bend nhẹ.' },
    ],
  },

  // ---------------- KỸ THUẬT CƠ BẢN ----------------
  {
    id: 'vibrato',
    group: 'Kỹ thuật cơ bản',
    title: 'Vibrato',
    summary: 'Làm nốt dài rung, có hồn. Ba nguồn: họng, cơ hoành và tay.',
    minutes: 8,
    blocks: [
      { t: 'list', items: [
        '**Vibrato họng**: giữ nốt và nói thầm "ha-ha-ha" hoặc "ư-ư-ư" bằng họng, không ngắt hơi. Phổ biến nhất trong blues.',
        '**Vibrato cơ hoành**: đẩy hơi theo nhịp "hư-hư-hư" từ bụng, sâu và chậm hơn.',
        '**Vibrato tay**: đóng mở tay phải đều đặn trong khi giữ nốt, tạo hiệu ứng "u-a-u-a".',
      ] },
      { t: 'p', text: 'Bắt đầu chậm: 2 nhịp rung mỗi phách theo máy đếm nhịp, sau đó mới tăng tốc. Vibrato đều quan trọng hơn vibrato nhanh.' },
      { t: 'tab', caption: 'Giữ nốt dài và thêm rung', body: '-4:4 -4:4 6:4 -6:4 -4:4\n', bpm: 70, style: 'ballad' },
      { t: 'tip', text: 'Chỉ dùng vibrato ở cuối nốt dài, đừng rung mọi nốt.' },
    ],
  },
  {
    id: 'hieu-ung-tay',
    group: 'Kỹ thuật cơ bản',
    title: 'Hiệu ứng tay: wah-wah',
    summary: 'Dùng bàn tay làm bộ lọc âm thanh.',
    minutes: 5,
    blocks: [
      { t: 'list', ordered: true, items: [
        'Khum tay phải ôm kín phía sau kèn: âm bị "đóng", tối.',
        'Mở tay ra từ từ trong khi giữ nốt: âm sáng dần, nghe như "u-a".',
        'Đóng mở theo phách tạo "wah-wah"; đóng mở nhanh là vibrato tay.',
      ] },
      { t: 'tip', text: 'Hiệu ứng rõ nhất ở nốt hút lỗ 2–4. Tay càng kín thì "wah" càng sâu.' },
      { t: 'tab', caption: 'Mỗi nốt 2 phách: đóng tay, mở tay', body: '-4:2 -4:2 -3:2 -3:2\n-2:2 -2:2 -2:4\n', bpm: 72, style: 'shuffle' },
    ],
  },
  {
    id: 'luoi',
    group: 'Kỹ thuật cơ bản',
    title: 'Dùng lưỡi: tách nốt, octave, láy',
    summary: 'Tonguing để nốt lặp gọn gàng, cộng thêm octave và láy (trill).',
    minutes: 10,
    blocks: [
      { t: 'h', text: 'Tách nốt (tonguing)' },
      { t: 'p', text: 'Khi một nốt lặp lại liên tiếp, đừng ngắt bằng cổ họng. Đọc thầm "tu-tu-tu" khi thổi hoặc "đu-đu" khi hút để lưỡi tách nốt. Chơi nhanh thì dùng "tu-cu-tu-cu".' },
      { t: 'tab', caption: 'Nốt lặp bằng lưỡi', body: '4:0.5 4:0.5 4:0.5 4:0.5 -4:0.5 -4:0.5 -4:0.5 -4:0.5 5 5 -4 -4 4:2\n', bpm: 84, style: 'rock' },
      { t: 'h', text: 'Octave' },
      { t: 'p', text: 'Dùng chặn lưỡi: ngậm 4 lỗ, lưỡi chặn 2 lỗ giữa, chừa lỗ ngoài cùng hai bên. Ví dụ ngậm 1–4, chừa 1 và 4: hai nốt Đô cách nhau một quãng tám vang cùng lúc.' },
      { t: 'h', text: 'Láy (trill / warble)' },
      { t: 'p', text: 'Lắc nhanh kèn (hoặc đầu) qua lại giữa hai lỗ cạnh nhau, thường là hút 4 và 5. Âm rộn ràng, rất blues.' },
      { t: 'tab', caption: 'Đổi nhanh giữa -4 và -5', body: '-4:0.25 -5:0.25 -4:0.25 -5:0.25 -4:0.25 -5:0.25 -4:0.25 -5:0.25 -4:2\n', bpm: 70, style: 'shuffle' },
    ],
  },

  // ---------------- BEND ----------------
  {
    id: 'bend-hut',
    group: 'Bend và nâng cao',
    title: 'Bend khi hút',
    summary: 'Kéo nốt xuống thấp hơn: âm thanh đặc trưng của blues. Mất vài tuần đến vài tháng, ai cũng làm được.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Bend là thay đổi hình dạng khoang miệng để lưỡi gà rung ở cao độ thấp hơn. Bend không phải hút mạnh hơn: hút mạnh chỉ làm nốt tắt và hại kèn.' },
      { t: 'h', text: 'Các bước' },
      { t: 'list', ordered: true, items: [
        'Bắt đầu với lỗ 4 hoặc lỗ 1 (dễ nhất với nhiều người). Phải có đơn âm sạch trước.',
        'Hút nhẹ và nói thầm "i". Từ từ chuyển sang "u", như nói "i-u", lưỡi kéo dần về sau.',
        'Đồng thời hạ hàm, như đang nuốt một quả trứng. Cảm giác luồng hơi tụt sâu xuống họng.',
        'Khi bend đúng, cao độ tụt xuống và tiếng dày hơn. Thả "u" về "i", nốt trở lại.',
        'Mở trang Dò nốt: lúc bend nửa cung lỗ 4, app phải hiện -4′ và kim nằm giữa.',
      ] },
      { t: 'diagram', harpKey: 'C', advanced: false },
      { t: 'h', text: 'Mỗi lỗ bend được bao nhiêu' },
      { t: 'list', items: [
        "Lỗ 1: nửa cung (-1').",
        "Lỗ 2: tối đa 1 cung (-2', -2'').",
        "Lỗ 3: tối đa 1 cung rưỡi (-3', -3'', -3'''): khó nhất, tập sau cùng.",
        "Lỗ 4: nửa cung (-4'). Lỗ 6: nửa cung (-6').",
        'Lỗ 5 gần như không bend được khi hút (chỉ hạ nhẹ để tạo màu).',
      ] },
      { t: 'tab', caption: 'Bend nửa cung lỗ 4: bình thường, bend, nhả', body: "-4:2 -4':2 -4:4\n-4:2 -4':2 -4:4\n", bpm: 60, style: 'shuffle' },
      { t: 'tab', caption: 'Lỗ 2: từng bậc', body: "-2:2 -2':2 -2'':2 -2':2 -2:4\n", bpm: 60, style: 'shuffle' },
      { t: 'tab', caption: 'Lỗ 3: ba bậc', body: "-3:2 -3':2 -3'':2 -3''':2 -3'':2 -3':2 -3:4\n", bpm: 56, style: 'shuffle' },
      { t: 'warn', text: 'Đau họng, chóng mặt, hoặc kèn kêu "tịt" là đang hút quá mạnh. Nghỉ một chút và làm nhẹ hơn.' },
      { t: 'tip', text: 'Nhiều người thấy kèn A dễ tập bend hơn kèn C vì cao độ thấp hơn một chút. Nếu tập mãi chưa ra trên kèn C, thử với kèn A.' },
      { t: 'link', to: '/tap-cao-do?mode=bend', label: 'Tập bend với micro', text: 'Chọn lỗ cần bend, thước cao độ cho biết đang bend thiếu, đúng hay quá; giữ đúng nửa giây là đạt.' },
    ],
  },
  {
    id: 'bend-thoi',
    group: 'Bend và nâng cao',
    title: 'Bend khi thổi',
    summary: 'Lỗ 7–10 bend khi thổi, dùng nhiều trong blues ở dải cao.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Ở lỗ 8, 9, 10, nốt thổi cao hơn nốt hút nên bend xảy ra khi thổi. Khoang miệng phải nhỏ hơn bend hút vì cao độ cao hơn.' },
      { t: 'list', ordered: true, items: [
        'Thổi nhẹ lỗ 8, nói thầm "i".',
        'Đẩy lưỡi lên và hơi về trước, như chuyển "i" sang "ích" nhưng không đóng hẳn.',
        'Cảm giác hơi bị "nén" sát răng cửa. Cao độ tụt xuống.',
      ] },
      { t: 'tab', caption: "Bend thổi lỗ 8 và 9", body: "8:2 8':2 8:4\n9:2 9':2 9:4\n", bpm: 60, style: 'shuffle' },
      { t: 'tip', text: "Lỗ 10 bend được 1 cung (10''), nhưng hơi mạnh dễ làm lưỡi gà kêu rít. Nhẹ thôi." },
      { t: 'link', to: '/tap-cao-do?mode=bend', label: 'Tập bend thổi với micro' },
    ],
  },
  {
    id: 'overblow',
    group: 'Bend và nâng cao',
    title: 'Overblow và overdraw',
    summary: 'Lấy những nốt kèn diatonic vốn không có. Kỹ thuật cho người đã bend vững.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Overblow (lỗ 1, 4, 5, 6) và overdraw (lỗ 7, 9, 10) làm lưỡi gà "còn lại" phát âm, cho ra nốt cao hơn nửa cung so với nốt cao nhất của lỗ đó. Nhờ vậy kèn diatonic có thể chơi đủ 12 nốt.' },
      { t: 'list', items: [
        'Kèn phải được chỉnh khe lưỡi gà (gapping) thấp; kèn mua sẵn thường khó overblow.',
        'Bắt đầu với 6o: thổi lỗ 6, đặt khoang miệng như bend thổi, đẩy hơi vững đến khi nốt "bật" sang cao độ mới.',
        'Dùng trang Dò nốt để kiểm tra: overblow lỗ 6 trên kèn C là Sib.',
      ] },
      { t: 'diagram', harpKey: 'C', advanced: true },
      { t: 'warn', text: 'Đừng tập overblow khi chưa bend sạch các lỗ 1–6. Cố quá dễ làm lệch lưỡi gà.' },
    ],
  },

  // ---------------- ÂM NHẠC ----------------
  {
    id: 'vi-tri',
    group: 'Âm nhạc',
    title: 'Vị trí và chọn tông kèn',
    summary: 'Cùng một cây kèn chơi được nhiều giọng. Bảng tra nhanh kèn nào cho giọng nào.',
    minutes: 8,
    blocks: [
      { t: 'list', items: [
        '**Vị trí 1 (thẳng)**: giọng bài = tông kèn. Kèn C chơi giọng Đô. Hợp nhạc dân ca, thiếu nhi, ballad, nhạc vàng.',
        '**Vị trí 2 (cross harp)**: giọng bài cao hơn tông kèn một quãng năm. Kèn C chơi giọng Sol. Âm thanh chính của blues, rock, đồng quê: nốt gốc là hút lỗ 2, các nốt hút bend được.',
        '**Vị trí 3 (slant)**: kèn C chơi giọng Rê (thứ). Hợp nhạc thứ, buồn, nhạc phim.',
      ] },
      { t: 'p', text: 'Cách nhớ vị trí 2: đếm lên 5 nốt từ tông kèn (C, D, E, F, **G**), hoặc lấy tông bài lùi xuống 5 nốt để ra kèn cần dùng.' },
      { t: 'positions' },
      { t: 'tip', text: 'Bài trong thư viện có giọng gốc khác với kèn của bạn? Dùng nút đổi kèn ở trang bài hát: app tự chọn lỗ dễ thổi nhất.' },
      { t: 'link', to: '/jam', label: 'Thử vị trí 2 trên nền nhạc blues' },
    ],
  },
  {
    id: 'blues-12-o',
    group: 'Âm nhạc',
    title: 'Blues 12 ô nhịp',
    summary: 'Khung hoà âm kinh điển của blues, chơi trên kèn C ở giọng Sol.',
    minutes: 12,
    blocks: [
      { t: 'p', text: 'Blues 12 ô nhịp lặp lại ba hợp âm: I (Sol), IV (Đô), V (Rê) theo thứ tự cố định:' },
      { t: 'list', items: ['Ô 1–4: I I I I', 'Ô 5–8: IV IV I I', 'Ô 9–12: V IV I V'] },
      { t: 'p', text: 'Trên kèn C vị trí 2: hợp âm I là hút lỗ 1–4, IV là thổi lỗ 1–4 hoặc 4–6, V là hút lỗ 4–6. Câu dưới đây đi theo nốt của từng hợp âm, có -3′ (Sib) là nốt "blue".' },
      { t: 'tab', caption: '12 ô nhịp với nhịp shuffle', body: "# Ô 1–4 (I)\n-2 -3' -3 -2 -2 -3' -3 -2\n-2 -3' -3 -2 -2 -3' -4 -3\n\n# Ô 5–8 (IV, I)\n4 5 6 5 4 5 6 5\n-2 -3' -3 -2 -2 -3' -3 -2\n\n# Ô 9–12 (V, IV, I, V)\n-4 -5 -6 -5 4 5 6 5\n-2 -3' -3 -2 -4 -5 -6 -4\n", bpm: 84, style: 'shuffle' },
      { t: 'tip', text: 'Khi đã thuộc, thử thay câu ở ô 1–4 bằng câu của riêng bạn, chỉ dùng -2 -3′ 4 -4′ -4 -5 6. Đó là thang âm blues, khó chơi sai.' },
      { t: 'link', to: '/jam', label: 'Tập ngẫu hứng trên nền nhạc blues', text: 'Nền nhạc 12 ô chạy lặp, hiện hợp âm từng ô và các lỗ thang âm blues; có chế độ máy hỏi – bạn đáp và thư viện lick.' },
    ],
  },
  {
    id: 'jazz-co-ban',
    group: 'Âm nhạc',
    title: 'Jazz cơ bản: vòng ii – V – I',
    summary: 'Hợp âm 7 các loại, nốt 3 và 7, và vì sao người chơi jazz hay dùng kèn chromatic.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Blues chỉ có 3 hợp âm và một thang âm "khó chơi sai". Jazz thì hợp âm đổi liên tục (mỗi ô, có khi nửa ô), nên người chơi phải biết **nốt nào thuộc hợp âm đang vang**.' },
      { t: 'h', text: 'Các loại hợp âm 7' },
      { t: 'list', items: [
        '**Cmaj7** (Đô Mi Sol Si): sáng, êm — hợp âm chủ của jazz giọng trưởng.',
        '**Dm7** (Rê Fa La Đô): hợp âm thứ 7, mềm.',
        '**G7** (Sol Si Rê Fa): hợp âm 7 át, căng, muốn "về" hợp âm chủ.',
        '**Bm7♭5 / Bø** (Si Rê Fa La): nửa giảm, dùng trong vòng giọng thứ.',
        '**dim7** (giảm 7): bốn nốt cách đều nhau, dùng để nối hai hợp âm.',
      ] },
      { t: 'h', text: 'Vòng ii – V – I' },
      { t: 'p', text: 'Ở giọng Đô: **Dm7 → G7 → Cmaj7**. Vòng này có mặt trong gần như mọi bài jazz, kể cả khi bài đổi giọng giữa chừng (ví dụ Autumn Leaves đi qua ii–V–I trưởng rồi ii–V–i thứ).' },
      { t: 'tip', text: 'Mẹo dễ nhất: mỗi khi hợp âm đổi, cho câu của bạn rơi vào **nốt 3 hoặc nốt 7** của hợp âm mới (Dm7: Fa, Đô; G7: Si, Fa; Cmaj7: Mi, Si). Chỉ cần vậy là nghe ra "chất jazz".' },
      { t: 'h', text: 'Kèn nào chơi jazz?' },
      { t: 'p', text: 'Jazz cần đủ 12 nốt thăng giáng. **Kèn chromatic** có nút gạt nên chơi được mọi nốt (Toots Thielemans dùng kèn này). Kèn diatonic chơi jazz được nhưng phải dùng nhiều bend và **overblow** (như Howard Levy), khó hơn nhiều.' },
      { t: 'link', to: '/jam', label: 'Tập jazz trên nền nhạc', text: 'Trong trang Tập ngẫu hứng, chọn **Jazz**: nền nhạc swing có bass walking chạy các vòng ii–V–I, hiện nốt của từng hợp âm trên kèn bạn chọn, có máy hỏi – bạn đáp và lick mẫu.' },
    ],
  },
  {
    id: 'hoc-bai-bang-tai',
    group: 'Âm nhạc',
    title: 'Học bài bằng tai',
    summary: 'Tự mò giai điệu khi không có tab, kết hợp với trang Dò nốt.',
    minutes: 6,
    blocks: [
      { t: 'list', ordered: true, items: [
        'Ngâm nga câu đầu tiên cho đến khi thuộc.',
        'Tìm nốt đầu: thổi thử lỗ 4, 5, 6 đến khi trùng với giọng ngâm nga. Trang Dò nốt giúp so cao độ.',
        'Nốt tiếp theo cao hay thấp hơn? Đi từng bước một lỗ, thổi hoặc hút.',
        'Ghi ngay vào app (nút Thêm bài) để không quên. Đặt độ dài sau, cao độ trước.',
        'Nếu cần nốt không có trên kèn, có thể bài ở vị trí khác: thử đổi sang kèn khác.',
      ] },
      { t: 'tip', text: 'Phần lớn bài nhạc Việt phổ thông ở vị trí 1 chơi gọn trong lỗ 4–8 của kèn đúng tông.' },
    ],
  },

  // ---------------- BẢO QUẢN & MẸO ----------------
  {
    id: 'bao-quan',
    group: 'Bảo quản và mẹo',
    title: 'Bảo quản kèn',
    summary: 'Giữ kèn sạch và bền nhiều năm.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Súc miệng hoặc uống nước lọc trước khi thổi. Không thổi ngay sau khi ăn, đặc biệt đồ ngọt.',
        'Làm ấm kèn trong lòng bàn tay vào ngày lạnh để hơi nước không đọng trên lưỡi gà.',
        'Thổi xong: gõ nhẹ mặt lỗ vào lòng bàn tay để rũ nước, rồi thổi mạnh vài hơi khô.',
        'Để kèn khô tự nhiên rồi cất vào hộp. Tránh túi quần, nơi ẩm, nắng gắt.',
        'Lược gỗ không được ngâm nước. Lược nhựa có thể rửa nước ấm sau khi tháo nắp.',
        'Không cho người khác mượn thổi chung, vừa mất vệ sinh vừa dễ lệch bend.',
      ] },
      { t: 'warn', text: 'Một lỗ bị tịt hoặc rè sau khi thổi mạnh thường là lưỡi gà bị lệch hoặc dính bụi. Gõ rũ, thổi nhẹ; nếu không hết thì cần tháo nắp kiểm tra, đừng chọc vật nhọn vào lỗ.' },
    ],
  },
  {
    id: 'meo-luyen-tap',
    group: 'Bảo quản và mẹo',
    title: 'Mẹo luyện tập hiệu quả',
    summary: 'Tập ít mà đều, chậm mà đúng. Tận dụng các công cụ trong app.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '15–20 phút mỗi ngày tốt hơn 2 tiếng mỗi cuối tuần.',
        'Khởi động 2 phút bằng nốt dài và thang âm trước khi chơi bài.',
        'Hạ tempo xuống 60–70% (nút − ở thanh phát), chơi đúng rồi mới tăng dần 5% mỗi lần.',
        'Bật **Lặp đoạn** cho câu khó, đừng tập lại cả bài từ đầu.',
        'Tắt Giai điệu, chỉ giữ Beat để tự chơi cùng nhạc nền.',
        'Dùng **Chờ nốt**: app chỉ chuyển nốt khi bạn thổi đúng cao độ. Rất tốt cho câu có bend.',
        'Thu âm mình bằng điện thoại mỗi tuần để nghe tiến bộ.',
        'Đau môi, mỏi hàm: nghỉ. Thả lỏng là chìa khoá của âm thanh đẹp.',
      ] },
    ],
  },
  {
    id: 'loi-thuong-gap',
    group: 'Bảo quản và mẹo',
    title: 'Lỗi thường gặp và cách sửa',
    summary: 'Tiếng rè, nhiều lỗ cùng kêu, nốt bị tắt… và cách khắc phục.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        '**Nhiều lỗ cùng kêu**: môi chưa đủ nhỏ hoặc kèn chưa đủ sâu trong miệng. Đưa kèn sâu hơn, chu môi gọn hơn.',
        '**Nốt hút lỗ 2, 3 bị tắt hoặc méo**: hút quá mạnh, vô tình bend. Thả lỏng hàm, nói "i" khi hút.',
        '**Tiếng mỏng, nhỏ**: họng đóng. Mở họng như ngáp, thở bằng bụng.',
        '**Hết hơi giữa câu**: nhìn tab để chọn chỗ đổi hơi; ở chỗ nghỉ, thở qua mũi hoặc qua khoé miệng.',
        '**Nhảy lỗ sai**: trượt kèn bằng tay, đầu đứng yên; tập nhảy lỗ chậm với máy đếm nhịp.',
        '**Bend không xuống**: đang hút mạnh thay vì đổi khẩu hình. Hút nhẹ, tập "i-u" và hạ hàm.',
      ] },
    ],
  },
  {
    id: 'lo-trinh-30-ngay',
    group: 'Bảo quản và mẹo',
    title: 'Lộ trình 30 ngày',
    summary: 'Kế hoạch 4 tuần cho người mới bắt đầu.',
    minutes: 4,
    blocks: [
      { t: 'list', ordered: true, items: [
        '**Tuần 1**: cầm kèn, hơi thở, nốt dài, đơn âm lỗ 4–6. Bài: Thang âm Đô trưởng, Twinkle Twinkle.',
        '**Tuần 2**: đơn âm lỗ 1–8, nhảy lỗ, tách nốt bằng lưỡi, nhịp tàu hoả. Bài: Frère Jacques, Ode to Joy.',
        '**Tuần 3**: lỗ 7–9 (đảo chiều), vibrato, wah-wah, nốt dài có biểu cảm. Bài: Amazing Grace, Happy Birthday.',
        '**Tuần 4**: bend lỗ 4 và lỗ 1, vị trí 2, thang âm blues, blues 12 ô nhịp. Bài: Jingle Bells, Thang âm blues.',
      ] },
      { t: 'link', to: '/jam', label: 'Tuần 4: tập ngẫu hứng blues' },
      { t: 'tip', text: 'Sau 30 ngày, dùng trang Nhập bài (file nhạc, quét khuông nhạc, dán tab) để chuyển những bài bạn yêu thích thành tab và tập tiếp.' },
    ],
  },
  // ---------------- KÈN CHROMATIC ----------------
  {
    id: 'chromatic-la-gi',
    group: 'Kèn chromatic',
    title: 'Kèn chromatic là gì',
    summary: 'Cấu tạo 12 lỗ, nút gạt, khác gì kèn diatonic và nên chọn cây nào.',
    minutes: 5,
    blocks: [
      { t: 'p', text: 'Kèn chromatic có một **nút gạt** (slide) ở bên phải. Bấm nút gạt thì mọi nốt cao lên nửa cung, nên một cây chơi được đủ 12 nốt, mọi giọng, không cần bend. Vì vậy kèn chromatic hay dùng cho nhạc trữ tình, jazz, cổ điển, nhạc Việt có nhiều nốt thăng giáng.' },
      { t: 'h', text: 'Cấu tạo' },
      { t: 'list', items: [
        'Kèn phổ biến nhất có **12 lỗ**, 3 quãng tám, từ Đô4 đến Rê7. Kèn **16 lỗ** thêm một quãng tám trầm (lỗ 1 là Đô3).',
        'Cứ 4 lỗ là một quãng tám, lặp lại y hệt: thổi **Đô Mi Sol Đô**, hút **Rê Fa La Si**.',
        'Mỗi lỗ có 4 lưỡi gà: thổi, hút, thổi + gạt, hút + gạt. Các lưỡi gà có **van** (miếng nhựa mỏng) để hơi không lọt sang lưỡi bên kia.',
        'Vì có van nên kèn chromatic gần như không bend được như diatonic, và cũng không cần bend.',
      ] },
      { t: 'p', text: 'Sơ đồ kèn C chromatic 12 lỗ. Hàng trên cùng và dưới cùng là khi bấm nút gạt. Chạm vào ô để nghe.' },
      { t: 'diagram', harpKey: 'C', harpType: 'chromatic' },
      { t: 'h', text: 'Chọn cây đầu tiên' },
      { t: 'list', items: [
        'Chọn kèn **C, 12 lỗ**: hầu hết tab và giáo trình viết cho cây này.',
        'Nút gạt phải nhẹ, nhả về nhanh, không kêu lạch cạch. Thử thổi cả 4 kiểu ở vài lỗ xem có nốt nào rè không.',
        'Kèn 16 lỗ nặng và to hơn, hợp khi đã chơi quen và cần tiếng trầm.',
      ] },
      { t: 'tip', text: 'Trong app, chọn loại kèn ở Cài đặt → Loại kèn mặc định. Bài diatonic có sẵn đổi sang chromatic được bằng nút đổi kèn trong trang bài.' },
    ],
  },
  {
    id: 'chromatic-doc-tab',
    group: 'Kèn chromatic',
    title: 'Đọc tab kèn chromatic',
    summary: 'Ký hiệu thổi, hút, nút gạt và các kiểu ghi hay gặp trên mạng.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '`4` là thổi lỗ 4, `-4` là hút lỗ 4.',
        '`4<` là thổi lỗ 4 có bấm nút gạt, `-4<` là hút có bấm nút gạt.',
        'Trường độ ghi giống kèn diatonic: `4:2` giữ 2 phách, `4:0.5` nửa phách.',
      ] },
      { t: 'h', text: 'Các kiểu ghi khác trên mạng' },
      { t: 'list', items: [
        '`<4`, `4*`, `4\'` hoặc số có gạch chéo: đều là bấm nút gạt. Khi dán tab vào app, các kiểu này được đổi về `4<`.',
        'Một số trang dùng `+4` cho thổi. Số trong ngoặc `(4)` thường là hút, đọc chú thích của trang đó.',
        'Tab có lỗ 11, 12 chắc chắn là tab chromatic. App tự nhận ra khi bạn dán.',
      ] },
      { t: 'h', text: 'Một nốt, nhiều chỗ thổi' },
      { t: 'p', text: 'Đô ở cuối quãng tám này và đầu quãng tám sau trùng nhau: lỗ 4 thổi và lỗ 5 thổi đều là Đô5. `-4<` (Si + gạt) cũng là Đô. Tương tự Fa có thể là `-2` hoặc `2<`. App chọn chỗ gần nốt trước và nốt sau nhất để ít phải nhảy lỗ.' },
      { t: 'tab', harpKey: 'C', harpType: 'chromatic', caption: 'Thang âm Đô trưởng hai quãng tám', bpm: 80, body: '1 -1 2 -2 3 -3 -4 4:2\n5 -5 6 -6 7 -7 -8 8:2\n8 -8 -7 7 -6 6 -5 5:2\n4 -4 -3 3 -2 2 -1 1:2\n' },
    ],
  },
  {
    id: 'chromatic-nut-gat',
    group: 'Kèn chromatic',
    title: 'Dùng nút gạt',
    summary: 'Bấm gạt dứt khoát, chơi thang âm chromatic và các giọng Fa, Sol.',
    minutes: 8,
    blocks: [
      { t: 'list', ordered: true, items: [
        'Đặt ngón trỏ tay phải lên nút gạt, các ngón còn lại ôm thân kèn. Không đặt ngón cái lên nút.',
        'Bấm **hết hành trình**, nhanh và dứt khoát. Bấm nửa chừng thì tiếng rè hoặc ra hai nốt cùng lúc.',
        'Bấm gạt **ngay trước** khi đổi hơi, không bấm giữa lúc đang thổi nốt cũ.',
        'Tập chậm với máy đếm nhịp: mỗi phách một nốt, đều tay rồi mới tăng tốc.',
      ] },
      { t: 'tab', harpKey: 'C', harpType: 'chromatic', caption: 'Thang âm chromatic (12 nốt) lên rồi xuống', bpm: 72, body: '1 1< -1 -1< 2 -2 -2< 3 3< -3 -3< -4 4:2\n4 -4 -3< -3 3< 3 -2< -2 2 -1< -1 1< 1:2\n' },
      { t: 'h', text: 'Chơi giọng khác trên cùng một cây' },
      { t: 'p', text: 'Kèn diatonic muốn chơi giọng Fa phải đổi kèn. Kèn chromatic chỉ cần bấm gạt ở đúng nốt: giọng Fa trưởng có Si giáng (`-3<`), giọng Sol trưởng có Fa thăng (`-6<`).' },
      { t: 'tab', harpKey: 'C', harpType: 'chromatic', caption: 'Thang âm Fa trưởng', bpm: 80, body: '-2 3 -3 -3< 4 -5 6 -6:2\n-6 6 -5 4 -3< -3 3 -2:2\n' },
      { t: 'tab', harpKey: 'C', harpType: 'chromatic', caption: 'Thang âm Sol trưởng', bpm: 80, body: '3 -3 -4 5 -5 6 -6< 7:2\n7 -6< 6 -5 5 -4 -3 3:2\n' },
      { t: 'tip', text: 'Nốt Mi + gạt (`2<`, `6<`) bằng Fa và Si + gạt (`-4<`, `-8<`) bằng Đô. Ít khi cần, nhưng đôi khi giúp khỏi nhảy lỗ.' },
    ],
  },
  {
    id: 'chromatic-hoi-am',
    group: 'Kèn chromatic',
    title: 'Hơi thở và âm sắc',
    summary: 'Đơn âm, chặn lưỡi, vibrato, và cách giữ van không kêu.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        '**Đơn âm**: lỗ kèn chromatic vuông và sát nhau hơn diatonic. Môi chúm vừa một lỗ, hoặc dùng **chặn lưỡi** (lưỡi che các lỗ bên trái, hơi đi qua khoé phải).',
        'Chặn lưỡi được người chơi chromatic dùng nhiều vì tiếng dày hơn và dễ đánh quãng tám (lỗ 1 và lỗ 5 cùng lúc).',
        '**Thổi nhẹ**: kèn chromatic cần ít hơi hơn diatonic. Hút mạnh làm van rung kêu "rè".',
        '**Vibrato**: rung bằng họng (như cười "ha-ha-ha" không thành tiếng) hoặc đóng mở tay phải ôm kèn. Tay vẫn bấm nút gạt được.',
      ] },
      { t: 'tab', harpKey: 'C', harpType: 'chromatic', caption: 'Đoạn mở đầu Für Elise (Beethoven), có Rê thăng là -5<', bpm: 76, timeSig: '3/4', body: '6:0.5 -5<:0.5 6:0.5 -4:0.5 -5:0.5 5:0.5 -3 r:0.5 1:0.5 2:0.5 -3:0.5\n-4 r:0.5 2:0.5 3<:0.5 -4:0.5 5:3\n' },
      { t: 'tip', text: 'Bật Chờ nốt khi tập bài có nốt gạt: app chỉ đi tiếp khi bạn thổi đúng, nên biết ngay mình bấm gạt có đủ chưa.' },
    ],
  },
  {
    id: 'chromatic-bao-quan',
    group: 'Kèn chromatic',
    title: 'Bảo quản kèn chromatic',
    summary: 'Van dính, nút gạt kẹt, và những điều không nên làm.',
    minutes: 3,
    blocks: [
      { t: 'list', items: [
        '**Làm ấm kèn** bằng tay trước khi thổi khi trời lạnh, để hơi không đọng làm dính van.',
        'Van dính (nốt bị tắt hoặc kêu): thổi mạnh ngược chiều vài lần, hoặc gõ nhẹ kèn vào lòng bàn tay, lỗ hướng xuống.',
        'Thổi xong: gõ nhẹ để ráo nước, để kèn khô tự nhiên rồi mới cất vào hộp.',
        'Không ăn kẹo, uống nước ngọt ngay trước khi thổi: đường làm nút gạt kẹt.',
        '**Không ngâm nước** như kèn diatonic nhựa: van và lò xo nút gạt dễ hỏng. Nút gạt kẹt thì nhờ người sửa hoặc làm theo hướng dẫn của hãng.',
      ] },
    ],
  },
];

/** bộ bài học theo app: Sổ Tab Sáo dùng bài học sáo dọc */
export const LESSON_GROUPS = IS_RECORDER_APP ? RECORDER_LESSON_GROUPS : IS_KALIMBA_APP ? KALIMBA_LESSON_GROUPS : IS_GUITAR_APP ? GUITAR_LESSON_GROUPS : IS_PIANICA_APP ? PIANICA_LESSON_GROUPS : IS_TRANH_APP ? TRANH_LESSON_GROUPS : HARMONICA_LESSON_GROUPS;
export const LESSONS: Lesson[] = IS_RECORDER_APP ? RECORDER_LESSONS : IS_KALIMBA_APP ? KALIMBA_LESSONS : IS_GUITAR_APP ? GUITAR_LESSONS : IS_PIANICA_APP ? PIANICA_LESSONS : IS_TRANH_APP ? TRANH_LESSONS : HARMONICA_LESSONS;
