import * as db from '../../toolkit/simpananDb.js';

export default {
    name: 'cari',
    command: ['cari', 'search', 'find'],
    tags: 'AI & Simpanan',
    desc: 'Cari catatan/link yang pernah disimpan',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const keyword = args.join(' ').trim();
        if (!keyword) {
            return conn.sendMessage(chatId, { text: `❌ Mau cari apa?\nContoh: *${prefix}${commandText} react tutorial*` }, { quoted: msg });
        }
        const items = db.searchItems(keyword);
        if (!items.length) {
            return conn.sendMessage(chatId, { text: `🔍 Nggak ketemu yang cocok sama "${keyword}".` }, { quoted: msg });
        }
        const list = items.slice(0, 15).map(i => `• [${i.type}] ${i.content}`).join('\n');
        await conn.sendMessage(chatId, { text: `🔍 *Hasil pencarian "${keyword}":*\n\n${list}` }, { quoted: msg });
    }
};
