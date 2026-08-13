import * as db from '../../toolkit/simpananDb.js';

function parseDuration(text) {
    const m = text.match(/(\d+)\s*(detik|menit|jam|hari)/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const mult = { detik: 1000, menit: 60000, jam: 3600000, hari: 86400000 }[m[2].toLowerCase()];
    return n * mult;
}

export default {
    name: 'reminder',
    command: ['reminder', 'ingetin'],
    tags: 'AI & Simpanan',
    desc: 'Pasang reminder generik. Contoh: .reminder 30 menit | minum obat',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const full = args.join(' ');
        const [durasiStr, ...rest] = full.split('|').map(s => s.trim());
        const teks = rest.join('|').trim();

        if (!durasiStr || !teks) {
            return conn.sendMessage(chatId, { text: `❌ Format: *${prefix}${commandText} 30 menit | minum obat*` }, { quoted: msg });
        }
        const ms = parseDuration(durasiStr);
        if (!ms) {
            return conn.sendMessage(chatId, { text: '❌ Durasi tidak dikenali. Pakai: detik/menit/jam/hari. Contoh: "30 menit"' }, { quoted: msg });
        }
        const platform = conn.platform === 'telegram' ? 'telegram' : 'wa';
        const remindAt = new Date(Date.now() + ms).toISOString();
        db.saveReminder(platform, chatId, teks, remindAt);
        await conn.sendMessage(chatId, { text: `⏰ Oke, nanti aku ingetin: "${teks}"` }, { quoted: msg });
    }
};
