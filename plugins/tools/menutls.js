import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menutls',
    command: ['menutls'],
    tags: 'Info',
    desc: 'Submenu Tools & Info Archive Lite',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `🛠️ *TOOLS & INFO*\nPerkakas kecil yang sering kepake harian.\n\n📌 Cara pakai:\n├ ${prefix}s [reply gambar/video] — buat stiker\n├ ${prefix}addstiker [reply stiker] — tambah ke koleksi random\n└ ${prefix}cekfitur [jadwal/deadline/kelas] — tes notif fitur`;

        const buttons = [
            { id: '/cekid', label: '🆔 Cek ID Chat' },
            { id: '/cekfitur status', label: '🔧 Status Fitur' },
            { id: '.menu', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUTLS] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
