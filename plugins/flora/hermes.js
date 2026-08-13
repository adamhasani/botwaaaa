import { executeHermesAgent, setMode } from '../../toolkit/floraAgent.js';
import { AIRich } from '@isaxn/bailyes';

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
            await sendHermesReply(conn, chatId, msg, taskClean, result, prefix);
            console.log(`[HERMES] ✅ Selesai untuk ${chatId}`);
        } catch (e) {
            console.error(`[HERMES] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Hermes Mode: ${e.message}` }, { quoted: msg });
        }
    },

    runPersistent: async (conn, msg, { chatId, text }) => {
        try {
            const result = await executeHermesAgent(text);
            await sendHermesReply(conn, chatId, msg, text, result, '.');
        } catch (e) {
            console.error(`[HERMES-PERSIST] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Hermes Mode: ${e.message}` }, { quoted: msg });
        }
    },
};

// [FITUR] AIRich terstruktur — vps_info dapat tabel metrik, web_research dapat
// tombol lanjutan (addSuggest). Tiga lapis fallback: AIRich+table+suggest ->
// AIRich teks polos -> conn.sendMessage teks biasa. Command TIDAK PERNAH gagal
// total walau salah satu fitur AIRich yang lebih baru gak kesupport di device tertentu.
async function sendHermesReply(conn, chatId, msg, taskPrompt, result, prefix) {
    const { intent, narrative, table, searchQuery } = result;

    // Lapis 1: AIRich penuh (tabel untuk vps_info, tombol lanjutan untuk web_research)
    try {
        const rich = new AIRich(conn).setTitle(intent === 'vps_info' ? '🖥️ Hermes — VPS Report' : '⚡ Hermes — Web Research');

        if (table) rich.addTable(table);
        if (narrative) rich.addText(narrative);

        if (intent === 'web_research' && searchQuery) {
            try {
                // addSuggest belum ada contoh parameter resmi di dokumentasi paket —
                // dibungkus try/catch sendiri (terpisah dari lapis luar) supaya kalau
                // signature-nya beda dari dugaan, sisa pesan (judul+tabel+teks) tetap terkirim.
                rich.addSuggest([
                    { text: '🔍 Riset lebih dalam', prompt: `${prefix}hermes riset lebih detail soal ${searchQuery}` },
                    { text: '💾 Simpan hasil ini', prompt: `${prefix}simpan ${narrative.slice(0, 200)}` },
                ]);
            } catch { /* addSuggest gagal — lanjut tanpa tombol, bukan gagal total */ }
        }

        rich.addTip(`Perintah: ${taskPrompt}`);
        await rich.send(chatId, { quoted: msg });
        return;
    } catch (e) {
        console.log(`[HERMES] AIRich penuh gagal (${e.message}), coba versi sederhana...`);
    }

    // Lapis 2: AIRich sederhana (judul + teks doang, tanpa tabel/tombol)
    try {
        const rich = new AIRich(conn)
            .setTitle('⚡ Hermes Report')
            .addText(narrative || 'Tidak ada hasil.')
            .addTip(`Perintah: ${taskPrompt}`);
        await rich.send(chatId, { quoted: msg });
        return;
    } catch (e) {
        console.log(`[HERMES] AIRich sederhana juga gagal (${e.message}), fallback teks polos.`);
    }

    // Lapis 3: teks polos — selalu jalan, gak bergantung fitur bailyes apapun
    let text = narrative || 'Tidak ada hasil.';
    if (table) {
        text = table.map(row => row.join(' | ')).join('\n') + '\n\n' + text;
    }
    await conn.sendMessage(chatId, { text }, { quoted: msg });
}
