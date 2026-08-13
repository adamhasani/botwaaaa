/* ╔══════════════════════════════════════════╗
   ║  ADDSTIKER PLUGIN                       ║
   ║  Reply stiker + .addstiker → simpan DB  ║
   ║  Stiker disimpan sebagai file .webp     ║
   ╚══════════════════════════════════════════╝ */

import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from 'baileys';
import stg from '../../toolkit/setting.js';

const STIKER_DB  = path.join(stg.dbDir, 'stiker.json');
const STIKER_DIR = path.join(stg.dbDir, 'stiker_files');

if (!fs.existsSync(STIKER_DIR)) fs.mkdirSync(STIKER_DIR, { recursive: true });

function readDb() {
    try {
        if (!fs.existsSync(STIKER_DB)) return [];
        return JSON.parse(fs.readFileSync(STIKER_DB, 'utf-8'));
    } catch { return []; }
}

function saveDb(data) {
    fs.writeFileSync(STIKER_DB, JSON.stringify(data, null, 2));
}

export default {
    name: 'addstiker',
    command: ['addstiker', 'tambahstiker'],
    tags: 'Tools',
    desc: 'Tambah stiker ke koleksi random harian. Cara: reply stiker lalu kirim .addstiker',
    owner: true,
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        // Cek apakah reply ke stiker
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.stickerMessage) {
            return conn.sendMessage(chatId, {
                text: '❌ Reply ke stiker dulu baru ketik .addstiker'
            }, { quoted: msg });
        }

        const stickerMsg = quoted.stickerMessage;
        const directPath = stickerMsg.directPath;

        if (!stickerMsg.mediaKey || !directPath) {
            return conn.sendMessage(chatId, {
                text: '❌ Gagal baca data stiker. Coba reply stiker lain.'
            }, { quoted: msg });
        }

        const db = readDb();

        // Cek duplikat berdasarkan directPath
        const exists = db.find(s => s.directPath === directPath);
        if (exists) {
            return conn.sendMessage(chatId, {
                text: `ℹ️ Stiker ini sudah ada di koleksi (total: ${db.length} stiker)`
            }, { quoted: msg });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        // Download stiker sebagai buffer webp
        let buffer;
        try {
            const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
        } catch (e) {
            await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return conn.sendMessage(chatId, {
                text: `❌ Gagal download stiker: ${e.message}`
            }, { quoted: msg });
        }

        // Simpan file .webp
        const id = Date.now();
        const filePath = path.join(STIKER_DIR, `${id}.webp`);
        fs.writeFileSync(filePath, buffer);

        // Simpan ke DB
        db.push({
            id,
            filePath,
            directPath,
            addedAt: new Date().toISOString()
        });

        saveDb(db);

        await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await conn.sendMessage(chatId, {
            text: `✅ Stiker berhasil ditambahkan!\n📦 Total koleksi: *${db.length} stiker*`
        }, { quoted: msg });
    }
};