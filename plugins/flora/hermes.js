import { executeHermesAgent, setMode } from '../../toolkit/floraAgent.js';

export default {
    name: 'hermes',
    command: ['hermes'],
    tags: 'Flora',
    desc: 'Cek spesifikasi VPS atau riset web (AI otomatis pilih mana yang cocok)',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, platform }) => {
        const { chatId } = chatInfo;
        const taskClean = args.join(' ').trim();

        if (!taskClean) {
            setMode(platform, chatId, 'hermes');
            return conn.sendMessage(chatId, {
                text: `⚡ *Hermes Mode Aktif!*\nKetik perintah riset web / cek VPS langsung (tanpa prefix), atau pakai *${prefix}hermes [perintah]*.\nKetik *${prefix}menu* buat keluar dari mode ini.`,
            }, { quoted: msg });
        }

        try {
            await conn.sendMessage(chatId, { text: '⚡ [HERMES] Memproses permintaan...' }, { quoted: msg });
            const result = await executeHermesAgent(taskClean);
            await conn.sendMessage(chatId, { text: formatHermesResult(result, taskClean) }, { quoted: msg });
            console.log(`[HERMES] ✅ Selesai untuk ${chatId}`);
        } catch (e) {
            console.error(`[HERMES] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Hermes Mode: ${e.message}` }, { quoted: msg });
        }
    },

    runPersistent: async (conn, msg, { chatId, text }) => {
        try {
            const result = await executeHermesAgent(text);
            await conn.sendMessage(chatId, { text: formatHermesResult(result, text) }, { quoted: msg });
        } catch (e) {
            console.error(`[HERMES-PERSIST] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Hermes Mode: ${e.message}` }, { quoted: msg });
        }
    },
};

// executeHermesAgent return object { intent, narrative, table?, searchQuery? }.
// Format jadi teks WA biasa — gak pakai bx.rich/AIRich (fitur @isaxn/bailyes,
// gak dipakai di versi ini karena butuh sharp yang gak kompatibel CPU tanpa AVX).
function formatHermesResult(result, taskPrompt) {
    const { intent, narrative, table } = result;
    let text = intent === 'vps_info' ? '🖥️ *Hermes — VPS Report*\n\n' : '⚡ *Hermes — Web Research*\n\n';
    if (table) {
        text += table.map(row => row.join(' : ')).join('\n') + '\n\n';
    }
    text += narrative || 'Tidak ada hasil.';
    text += `\n\n_Perintah: ${taskPrompt}_`;
    return text;
}
