import * as db from '../../toolkit/simpananDb.js';

export default {
    name: 'hapussimpanan',
    command: ['hapussimpanan', 'delitem', 'delsimpan'],
    tags: 'AI & Simpanan',
    desc: 'Hapus item simpanan berdasarkan ID (lihat ID dari .listsimpanan)',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const id = parseInt(args[0], 10);
        if (!id) {
            return conn.sendMessage(chatId, { text: `❌ Masukkan ID item.\nContoh: *${prefix}${commandText} 5*\n(lihat ID lewat *${prefix}listsimpanan*)` }, { quoted: msg });
        }
        db.deleteItem(id);
        await conn.sendMessage(chatId, { text: `🗑️ Item #${id} dihapus (kalau memang ada).` }, { quoted: msg });
    }
};
