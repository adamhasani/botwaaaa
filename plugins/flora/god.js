import { executeGodAgent, setMode, getMode } from '../../toolkit/floraAgent.js';
import { Toolkit } from '@isaxn/bailyes';

// [FITUR] Screenshot laptop bisa resolusi tinggi (full-HD/4K) — resize dulu
// pakai Toolkit.resize (sharp) biar kirim lebih cepat & gak mepet limit ukuran WA.
// Gagal resize (mis. buffer bukan gambar valid) -> kirim buffer asli apa adanya.
async function prepScreenshot(buffer) {
    try {
        return await Toolkit.resize(buffer, 1280, 1280, 'inside');
    } catch {
        return buffer;
    }
}

export default {
    name: 'god',
    command: ['god'],
    tags: 'Flora',
    desc: 'Kontrol laptop Windows jarak jauh (cari file, screenshot, cek sistem, dll)',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, platform }) => {
        const { chatId } = chatInfo;
        const taskClean = args.join(' ').trim();

        if (!taskClean) {
            setMode(platform, chatId, 'god');
            return conn.sendMessage(chatId, {
                text: `💻 *Laptop God Mode Aktif!*\nKetik perintah langsung (tanpa prefix) buat kontrol laptop, atau pakai *${prefix}god [perintah]*.\nKetik *${prefix}menu* buat keluar dari mode ini.`,
            }, { quoted: msg });
        }

        try {
            await conn.sendMessage(chatId, { text: '💻 [GOD MODE] Menyambungkan ke Laptop Windows...' }, { quoted: msg });
            const { message, imageB64 } = await executeGodAgent(taskClean);

            if (imageB64) {
                const buffer = await prepScreenshot(Buffer.from(imageB64, 'base64'));
                await conn.sendMessage(chatId, { image: buffer, caption: message.slice(0, 1024) }, { quoted: msg });
            } else {
                await conn.sendMessage(chatId, { text: message }, { quoted: msg });
            }
            console.log(`[GOD] ✅ Selesai untuk ${chatId}`);
        } catch (e) {
            console.error(`[GOD] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error God Mode: ${e.message}` }, { quoted: msg });
        }
    },

    // Dipanggil dari aiChatHandler kalau chat lagi dalam mode 'god' persistent
    // (pesan tanpa prefix, langsung dianggap perintah ke laptop).
    runPersistent: async (conn, msg, { chatId, text }) => {
        try {
            const { message, imageB64 } = await executeGodAgent(text);
            if (imageB64) {
                const buffer = await prepScreenshot(Buffer.from(imageB64, 'base64'));
                await conn.sendMessage(chatId, { image: buffer, caption: message.slice(0, 1024) }, { quoted: msg });
            } else {
                await conn.sendMessage(chatId, { text: message }, { quoted: msg });
            }
        } catch (e) {
            console.error(`[GOD-PERSIST] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error God Mode: ${e.message}` }, { quoted: msg });
        }
    },
};
