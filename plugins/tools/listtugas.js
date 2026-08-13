import fs from 'fs';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import path from 'path';

const dbPath = path.join(stg.dbDir, 'deadlines.json');

function formatSisa(ms) {
    if (ms <= 0) return '⏰ Waktu habis!';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    let out = '';
    if (d > 0) out += `${d} hari `;
    if (h > 0) out += `${h} jam `;
    if (m > 0) out += `${m} menit`;
    return out.trim() || 'Kurang dari 1 menit';
}

export default {
    name: 'listtugas',
    command: ['listtugas', 'tugas', 'deadline', 'list'],
    tags: 'Tugas',
    desc: 'Lihat daftar tugas aktif',
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        if (!fs.existsSync(dbPath)) {
            return conn.sendMessage(chatId, { text: '📭 Belum ada tugas yang tersimpan.' }, { quoted: msg });
        }

        let db;
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); }
        catch { return conn.sendMessage(chatId, { text: '❌ Database error.' }, { quoted: msg }); }

        const now = moment().tz(stg.timezone);
        const tasks = Object.entries(db)
            .map(([name, data]) => ({ name, ...data, dl: moment(data.deadline).tz(stg.timezone) }))
            .filter(t => t.dl.isAfter(now))
            .sort((a, b) => a.dl.diff(b.dl));

        if (tasks.length === 0) {
            return conn.sendMessage(chatId, { text: '🎉 Tidak ada tugas aktif saat ini!' }, { quoted: msg });
        }

        let text = `📋 *DAFTAR TUGAS AKTIF*\n_${tasks.length} tugas ditemukan_\n${'─'.repeat(25)}\n`;

        tasks.forEach((t, i) => {
            const sisa = t.dl.diff(now);
            const urgent = sisa < 86400000 ? '🔴' : sisa < 259200000 ? '🟡' : '🟢';
            text += `\n${urgent} *${i + 1}. ${t.name}*\n`;
            text += `   📅 ${t.dl.format('ddd, DD MMM YYYY • HH:mm')} WIB\n`;
            text += `   ⏳ Sisa: _${formatSisa(sisa)}_\n`;
            if (t.description && t.description !== '-') text += `   📝 ${t.description}\n`;
        });

        text += `\n${'─'.repeat(25)}\n🟢 Aman  🟡 < 3 hari  🔴 < 1 hari`;

        await conn.sendMessage(chatId, { text }, { quoted: msg });
    }
};
