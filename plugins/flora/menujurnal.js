import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menujurnal',
    command: ['menujurnal'],
    tags: 'Info',
    desc: 'Submenu Journal (tulis, rekap)',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `📔 *JOURNAL*\nCatatan harian kamu, tersimpan rapi tiap hari.\n\n📌 Cara pakai:\n└ ${prefix}jurnal [isi] — tulis catatan harian baru`;

        const buttons = [
            { id: '/journalreport', label: '📊 Lihat Rekap Journal' },
            { id: '/menuflora', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUJURNAL] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
