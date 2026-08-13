import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menutgsedlink',
    command: ['menutgsedlink'],
    tags: 'Info',
    desc: 'Submenu Tugas & Edlink Archive Lite',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `📋 *TUGAS & EDLINK*\nKelola deadline dan sinkron data kampus.\n\n📌 Cara pakai:\n├ ${prefix}addtugas Nama | YYYY-MM-DD | HH:mm | Ket\n├ ${prefix}deltugas [nama] — hapus tugas\n├ ${prefix}updatetoken [token] — update token Edlink manual\n└ ${prefix}claimquest — klaim Daily Quest\n\n🔔 Auto reminder: H-7 • H-3 • H-1 • Saat deadline\n🔄 Auto sync Edlink: tiap 2 jam`;

        // 3 tombol max: 2 aksi tersering + kembali
        const buttons = [
            { id: '/listtugas', label: '📋 Lihat Tugas' },
            { id: '/edlinksync', label: '🎓 Sync Edlink' },
            { id: '.menu', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUTGSEDLINK] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
