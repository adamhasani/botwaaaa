import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menutugas',
    command: ['menutugas'],
    tags: 'Info',
    desc: 'Submenu Tugas & Edlink',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `📋 *TUGAS & EDLINK*\nKelola deadline dan sinkron data kampus.\n\n📌 Cara pakai:\n├ ${prefix}addtugas Nama | YYYY-MM-DD | HH:mm | Ket\n├ ${prefix}deltugas [nama] — hapus tugas\n└ ${prefix}updatetoken [token] — update token Edlink manual`;

        const buttons = [
            { id: '/listtugas', label: '📋 Lihat Tugas' },
            { id: '/edlinksync', label: '🎓 Sync Edlink' },
            { id: '/claimquest', label: '🎯 Claim Quest' },
            { id: '/cekkoneksi', label: '📡 Cek Koneksi' },
            { id: '/menuflora', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUTUGAS] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
