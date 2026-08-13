import * as db from '../../toolkit/simpananDb.js';
import { bx } from '@isaxn/bailyes';

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
        const recent = items.slice(0, 20);

        // [FITUR] bx.rich — tabel simpanan, fallback ke format teks lama kalau gagal render.
        const table = [['#', 'Tipe', 'Isi']];
        for (const i of recent) {
            table.push([String(i.id), i.type, i.content.length > 40 ? i.content.slice(0, 40) + '...' : i.content]);
        }

        try {
            await bx.rich(conn, chatId, {
                title: `🗂️ Simpanan (${items.length} total)`,
                table,
                tip: `${summary} — menampilkan 20 terbaru`,
                options: { quoted: msg },
            });
        } catch (e) {
            const list = recent.map(i => `#${i.id} [${i.type}] ${i.content}`).join('\n');
            await conn.sendMessage(chatId, { text: `🗂️ *Simpanan (${items.length} total — ${summary})*\n_20 terbaru:_\n\n${list}` }, { quoted: msg });
        }
    }
};
