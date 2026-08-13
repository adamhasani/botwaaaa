import * as db from '../../toolkit/simpananDb.js';

export default {
    name: 'simpan',
    command: ['simpan', 'save', 'catat'],
    tags: 'AI & Simpanan',
    desc: 'Simpan catatan/link ke database',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const text = args.join(' ').trim();
        if (!text) {
            return conn.sendMessage(chatId, { text: `❌ Isi apa yang mau disimpan!\nContoh: *${prefix}${commandText} link tutorial react https://youtu.be/xxxx*` }, { quoted: msg });
        }
        const dup = db.checkSimilarItem(text);
        if (dup) {
            return conn.sendMessage(chatId, { text: `⚠️ Kayaknya udah pernah disimpan:\n"${dup.content}"\n\nTetap mau simpan? Ketik lagi kalau yakin beda.` }, { quoted: msg });
        }
        // [FITUR BARU] related items — item lama yang temanya nyambung (bukan duplikat persis)
        const related = db.getRelatedItems(text, text);
        const type = /https?:\/\//.test(text) ? 'link' : 'catatan';
        db.saveItem(text, type);
        let out = `✅ Tersimpan sebagai *${type}*:\n${text}`;
        if (related.length) {
            out += '\n\n🔗 Btw ini terkait sama simpenan lama kamu:\n'
                + related.map(r => `- ${r.content.slice(0, 70)}...`).join('\n');
        }
        await conn.sendMessage(chatId, { text: out }, { quoted: msg });
    }
};
