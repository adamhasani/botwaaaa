import stg from '../../toolkit/setting.js';
import moment from 'moment-timezone';
import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menuflora',
    command: ['menuflora'],
    tags: 'Info',
    desc: 'Tampilkan menu Flora (God Mode, Hermes, Simpanan, Journal, dll)',
    prefix: true,

    run: async (conn, msg, { chatInfo, platform }) => {
        const { chatId } = chatInfo;
        const now = moment().tz(stg.timezone).format('HH:mm • DD MMM YYYY');
        const isTelegram = platform === 'telegram';

        // Flora selalu pakai "/" sebagai gaya penulisan command di menu ini,
        // apapun platformnya — router command sudah nerima "/" dari WA maupun Telegram.
        const p = '/';

        const header = isTelegram
            ? `╔══════════════════════════╗\n║      🌸 FLORA ASSISTANT    ║\n║   Telegram — by Adam H.    ║\n╚══════════════════════════╝`
            : `╔══════════════════════════╗\n║      🌸 FLORA ASSISTANT    ║\n║      WhatsApp — Flora      ║\n╚══════════════════════════╝`;

        const menu = `${header}
🕐 ${now} WIB

━━━━━━━━━━━━━━━━━━━━━━━━━━
💻  *GOD MODE* — kontrol laptop
━━━━━━━━━━━━━━━━━━━━━━━━━━
└ ${p}god [perintah]
   └ Kontrol laptop Windows jarak jauh: cari file, screenshot,
     cek sistem, matikan proses, kunci layar, buka url.
   └ Ketik ${p}god tanpa perintah buat masuk mode persistent
     (semua chat abis itu langsung dikirim ke laptop).

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡  *HERMES MODE* — VPS & riset
━━━━━━━━━━━━━━━━━━━━━━━━━━
└ ${p}hermes [perintah]
   └ Cek spesifikasi VPS real-time atau riset web,
     AI otomatis milih mana yang cocok.
   └ Ketik ${p}hermes tanpa perintah buat masuk mode persistent.

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖  *AGENTIC* — tugas multi-langkah
━━━━━━━━━━━━━━━━━━━━━━━━━━
└ ${p}agentic [tugas kompleks]
   └ Pecah 1 perintah jadi beberapa langkah otomatis
     (riset -> simpan -> bikin reminder).

━━━━━━━━━━━━━━━━━━━━━━━━━━
💾  *SIMPANAN*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${p}simpan [teks/link]
│  └ Simpan catatan atau link ke database
├ ${p}cari [kata kunci]
│  └ Cari isi simpanan
├ ${p}listsimpanan
│  └ Lihat semua simpanan
└ ${p}hapussimpanan [id]
   └ Hapus 1 simpanan

━━━━━━━━━━━━━━━━━━━━━━━━━━
📔  *JOURNAL*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${p}jurnal [isi]
│  └ Tulis catatan harian
└ ${p}journalreport
   └ Lihat rekap journal

━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰  *REMINDER*
━━━━━━━━━━━━━━━━━━━━━━━━━━
└ ${p}reminder [teks] | [durasi]
   └ Contoh: ${p}reminder Minum air | 30 menit

━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  *INFO*
━━━━━━━━━━━━━━━━━━━━━━━━━━
└ ${p}menu
   └ Tampilkan menu ini lagi`;

        const buttons = [
            { id: `${p}god`, label: '💻 God Mode' },
            { id: `${p}hermes`, label: '⚡ Hermes Mode' },
            { id: '.menu', label: '🗂️ Menu Archive' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, menu, buttons, { quoted: msg });
            console.log(`[MENUFLORA] ✅ Terkirim ke ${chatId}`);
        } catch (e) {
            console.error(`[MENUFLORA] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
