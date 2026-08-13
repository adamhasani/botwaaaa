import stg from '../../toolkit/setting.js';
import moment from 'moment-timezone';
import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menu',
    command: ['menu', 'help', 'bantuan'],
    tags: 'Info',
    desc: 'Tampilkan menu bot (Archive)',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;
        const now = moment().tz(stg.timezone).format('HH:mm • DD MMM YYYY');
        const isTelegram = platform === 'telegram';
        const header = isTelegram
            ? `╔══════════════════════════╗\n║   🗂️  THE ARCHIVE LITE    ║\n║  Telegram Bot by Adam H.  ║\n╚══════════════════════════╝`
            : `╔══════════════════════════╗\n║   🗂️  THE ARCHIVE LITE    ║\n║   WA Bot by Adam Hasani   ║\n╚══════════════════════════╝`;

        const menu = `${header}
🕐 ${now} WIB

━━━━━━━━━━━━━━━━━━━━━━━━━━
📥  *DOWNLOADER*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${prefix}tt [link]
│  └ Download video TikTok tanpa watermark
├ ${prefix}ig [link]
│  └ Download video / foto Instagram
└ ${prefix}yt [link]
   └ Download video YouTube (maks 10 menit)

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  *TUGAS & DEADLINE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${prefix}addtugas
│  └ Tambah tugas / deadline baru
│  └ Format: ${prefix}addtugas Nama | YYYY-MM-DD | HH:mm | Ket
│  └ Contoh: ${prefix}addtugas UTS MTK | 2025-06-15 | 08:00 | Bab 3
├ ${prefix}listtugas
│  └ Lihat semua tugas aktif + countdown
└ ${prefix}deltugas [nama]
   └ Hapus tugas dari daftar

━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓  *EDLINK*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${prefix}edlinksync
│  └ Sync tugas, jadwal, materi & pengumuman
├ ${prefix}updatetoken [token]
│  └ Update token Edlink manual
├ ${prefix}claimquest
│  └ Klaim semua Daily Quest Edlink sekarang
└ ${prefix}cekkoneksi
   └ Cek status koneksi VPS ke Edlink

━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️  *TOOLS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${prefix}s [reply gambar/video]
│  └ Buat stiker dari gambar / video
├ ${prefix}addstiker [reply stiker]
│  └ Tambah stiker ke koleksi random harian
├ ${prefix}cekfitur [jadwal/deadline/kelas]
│  └ Tes notif fitur terjadwal
└ ${prefix}cekid
   └ Cek JID chat atau grup ini

━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  *INFO*
━━━━━━━━━━━━━━━━━━━━━━━━━━
├ ${prefix}menu / ${prefix}help / ${prefix}bantuan
│  └ Tampilkan menu ini
└ 🔔 Auto reminder: H-7 • H-3 • H-1 • Saat deadline
   🔄 Auto sync Edlink: tiap 2 jam
   🎯 Auto claim quest: tiap hari jam 07:05`;

        const buttons = [
            { id: `${prefix}listtugas`, label: '📋 Lihat Tugas' },
            { id: `${prefix}cekfitur status`, label: '🔧 Status Fitur' },
            { id: '/menu', label: '⚡ Menu Flora' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, menu, buttons, { quoted: msg });
            console.log(`[MENU] ✅ Terkirim ke ${chatId}`);
        } catch (e) {
            console.error(`[MENU] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    }
};
