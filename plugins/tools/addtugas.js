import fs from 'fs';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import path from 'path';

const dbPath = path.join(stg.dbDir, 'deadlines.json');

function readDb() {
    try {
        if (!fs.existsSync(dbPath)) return {};
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch { return {}; }
}

function saveDb(data) {
    if (!fs.existsSync(stg.dbDir)) fs.mkdirSync(stg.dbDir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export default {
    name: 'addtugas',
    command: ['addtugas', 'task', 'tambahtugas'],
    tags: 'Tugas',
    desc: 'Tambah tugas/deadline baru',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const text = args.join(' ');

        const contoh = `📌 *Format:*\n*${prefix}${commandText} Nama Tugas | YYYY-MM-DD | HH:mm | Deskripsi*\n\n*Contoh:*\n*${prefix}${commandText} UTS Statistika | 2025-06-15 | 08:00 | Bab 3-5 halaman 120*`;

        if (!text.includes('|')) {
            return conn.sendMessage(chatId, { text: `❌ Format salah!\n\n${contoh}` }, { quoted: msg });
        }

        const parts = text.split('|').map(p => p.trim());
        if (parts.length < 3) {
            return conn.sendMessage(chatId, { text: `❌ Data kurang!\n\n${contoh}` }, { quoted: msg });
        }

        const [nama, tglStr, jamStr, ...descParts] = parts;
        const desc = descParts.join('|').trim() || '-';

        // Parse tanggal
        const dtStr = `${tglStr} ${jamStr}`;
        let dl = moment.tz(dtStr, 'YYYY-MM-DD HH:mm', stg.timezone);
        if (!dl.isValid()) dl = moment.tz(dtStr, 'DD-MM-YYYY HH:mm', stg.timezone);
        if (!dl.isValid()) {
            return conn.sendMessage(chatId, {
                text: `❌ Format tanggal/jam tidak valid!\n\nGunakan:\nTanggal: *YYYY-MM-DD* (contoh: 2025-06-15)\nJam: *HH:mm* (contoh: 08:00)`
            }, { quoted: msg });
        }

        const now = moment().tz(stg.timezone);
        if (dl.isBefore(now)) {
            return conn.sendMessage(chatId, {
                text: `❌ Tanggal sudah lewat!\n\nSekarang: ${now.format('DD MMM YYYY HH:mm')} WIB\nInput: ${dl.format('DD MMM YYYY HH:mm')} WIB`
            }, { quoted: msg });
        }

        const db = readDb();
        db[nama] = {
            deadline: dl.toISOString(),
            description: desc,
            chatId: chatId,
            createdAt: now.toISOString(),
            reminded_h7: false,
            reminded_h1: false,
            reminded_due: false
        };
        saveDb(db);

        const sisa = dl.diff(now, 'days');
        await conn.sendMessage(chatId, {
            text: `✅ *TUGAS BERHASIL DISIMPAN*\n\n📌 *Nama:* ${nama}\n📅 *Deadline:* ${dl.format('dddd, DD MMMM YYYY')}\n🕐 *Pukul:* ${dl.format('HH:mm')} WIB\n📝 *Ket:* ${desc}\n⏳ *Sisa:* ${sisa} hari\n\n_Bot akan mengingatkan H-7, H-1, dan saat deadline._`
        }, { quoted: msg });
    }
};
