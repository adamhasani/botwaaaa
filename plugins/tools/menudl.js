import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menudl',
    command: ['menudl'],
    tags: 'Info',
    desc: 'Submenu Downloader Archive Lite',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `📥 *DOWNLOADER*\nTinggal kirim linknya, ga perlu buka aplikasi lain.\n\n📌 Cara pakai:\n├ ${prefix}tt [link] — TikTok tanpa watermark\n├ ${prefix}ig [link] — Instagram video/foto\n└ ${prefix}yt [link] — YouTube (maks 10 menit)`;

        const buttons = [
            { id: '.menu', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUDL] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
