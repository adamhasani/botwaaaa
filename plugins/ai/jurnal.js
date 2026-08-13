import * as db from '../../toolkit/simpananDb.js';

export default {
    name: 'jurnal',
    command: ['jurnal', 'journal'],
    tags: 'AI & Simpanan',
    desc: 'Catat jurnal harian / lihat riwayat jurnal',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const text = args.join(' ').trim();

        const platform = conn.platform === 'telegram' ? 'telegram' : 'wa';

        if (!text || text === 'list') {
            const entries = db.getJournal(platform, chatId, 10);
            if (!entries.length) {
                return conn.sendMessage(chatId, { text: `📔 Belum ada jurnal.\nTulis: *${prefix}${commandText} isi jurnal kamu hari ini*` }, { quoted: msg });
            }
            const list = entries.map(e => `• ${new Date(e.created_at).toLocaleDateString('id-ID')}: ${e.content}`).join('\n');
            return conn.sendMessage(chatId, { text: `📔 *Jurnal terakhir:*\n\n${list}` }, { quoted: msg });
        }

        db.saveJournal(platform, chatId, text);
        await conn.sendMessage(chatId, { text: '📔 Dicatat! Makasih udah cerita.' }, { quoted: msg });
    }
};
