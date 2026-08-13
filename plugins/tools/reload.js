import { loadPlugins, plugins } from '../../toolkit/loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    name: 'reload',
    command: ['reload'],
    tags: 'Owner',
    desc: 'Reload semua plugin tanpa restart bot',
    prefix: true,
    owner: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        await conn.sendMessage(chatId, {
            text: '🔄 _Reloading plugins..._'
        }, { quoted: msg });

        const before = plugins.size;

        try {
            plugins.clear();
            await loadPlugins(path.join(__dirname, '../../'));

            const after = plugins.size;
            const diff  = after - before;
            const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0';

            await conn.sendMessage(chatId, {
                text: `✅ *Plugin berhasil direload!*\n\n`
                    + `📦 Sebelum : ${before} plugin\n`
                    + `📦 Sekarang: ${after} plugin (${diffStr})\n\n`
                    + `_Semua command sudah aktif._`
            }, { quoted: msg });

        } catch (e) {
            await conn.sendMessage(chatId, {
                text: `❌ *Reload gagal!*\n\n${e.message}`
            }, { quoted: msg });
        }
    }
};
