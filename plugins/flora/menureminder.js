import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menureminder',
    command: ['menureminder'],
    tags: 'Info',
    desc: 'Submenu Reminder',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `⏰ *REMINDER*\nJangan sampai lupa lagi.\n\n📌 Cara pakai:\n└ ${prefix}reminder [teks] | [durasi]\n   Contoh: ${prefix}reminder Minum air | 30 menit`;

        const buttons = [
            { id: '/menuflora', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUREMINDER] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
