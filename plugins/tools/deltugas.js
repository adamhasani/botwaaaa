import fs from 'fs';
import stg from '../../toolkit/setting.js';
import path from 'path';

const dbPath = path.join(stg.dbDir, 'deadlines.json');

export default {
    name: 'deltugas',
    command: ['deltugas', 'hapustugas', 'removetugas'],
    tags: 'Tugas',
    desc: 'Hapus tugas dari daftar',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const nama = args.join(' ').trim();

        if (!nama) {
            return conn.sendMessage(chatId, {
                text: `❌ Masukkan nama tugas!\n\nContoh:\n*${prefix}${commandText} UTS Statistika*\n\nLihat daftar: *${prefix}listtugas*`
            }, { quoted: msg });
        }

        if (!fs.existsSync(dbPath)) {
            return conn.sendMessage(chatId, { text: '📭 Database kosong.' }, { quoted: msg });
        }

        let db;
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); }
        catch { return conn.sendMessage(chatId, { text: '❌ Database error.' }, { quoted: msg }); }

        if (!db[nama]) {
            // Cari yang mirip
            const mirip = Object.keys(db).filter(k => k.toLowerCase().includes(nama.toLowerCase()));
            if (mirip.length > 0) {
                return conn.sendMessage(chatId, {
                    text: `❓ Tugas *"${nama}"* tidak ditemukan.\n\nMungkin maksud kamu:\n${mirip.map(m => `• ${m}`).join('\n')}\n\n_Nama harus persis sama._`
                }, { quoted: msg });
            }
            return conn.sendMessage(chatId, { text: `❌ Tugas *"${nama}"* tidak ditemukan.` }, { quoted: msg });
        }

        delete db[nama];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        await conn.sendMessage(chatId, {
            text: `🗑️ Tugas *"${nama}"* berhasil dihapus!`
        }, { quoted: msg });
    }
};
