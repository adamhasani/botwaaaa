import * as db from '../../toolkit/simpananDb.js';

export default {
    name: 'listsimpanan',
    command: ['listsimpanan', 'simpenan', 'database'],
    tags: 'AI & Simpanan',
    desc: 'Lihat semua yang tersimpan',
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;
        const items = db.getAllItems();
        if (!items.length) {
            return conn.sendMessage(chatId, { text: '📭 Database masih kosong.' }, { quoted: msg });
        }
        const counts = db.countItems();
        const summary = counts.map(c => `${c.type}: ${c.total}`).join(' | ');
        const list = items.slice(0, 20).map(i => `#${i.id} [${i.type}] ${i.content}`).join('\n');
        await conn.sendMessage(chatId, { text: `🗂️ *Simpanan (${items.length} total — ${summary})*\n_20 terbaru:_\n\n${list}` }, { quoted: msg });
    }
};
