import fs from 'fs';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import path from 'path';

const WEEKLY_DB = path.join(stg.dbDir, 'weekly_schedule.json');

function formatWeekSchedule() {
    if (!fs.existsSync(WEEKLY_DB)) return null;

    const db = JSON.parse(fs.readFileSync(WEEKLY_DB, 'utf-8'));
    const data = db?.data || [];

    if (!data.length) return null;

    const weekOf = db.weekOf ? moment(db.weekOf).format('DD MMM YYYY') : '?';
    const fetchedAt = db.fetchedAt ? moment(db.fetchedAt).tz(stg.timezone).format('DD MMM, HH:mm') : '?';

    let msg = `📅 *JADWAL MINGGU INI*\n`;
    msg += `🗓️ Minggu: *${weekOf}*\n`;
    msg += `🔄 _Diperbarui: ${fetchedAt} WIB_\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const today = moment().tz(stg.timezone).format('YYYY-MM-DD');

    for (const day of data) {
        const tanggal = moment(day.date).format('ddd, DD MMM');
        const isToday = day.date === today;
        const label = isToday ? `*${tanggal}* ◀ hari ini` : `*${tanggal}*`;

        if (!day.sections || day.sections.length === 0) {
            msg += `${label}\n   ✅ Tidak ada kelas\n\n`;
            continue;
        }

        msg += `${label}\n`;
        for (const s of day.sections) {
            // startedAt/endedAt udah string WIB polos — parse SEBAGAI Asia/Jakarta,
            // jangan di-convert lagi (hindari double-shift +7 jam).
            const start  = moment.tz(s.startedAt, stg.timezone).format('HH:mm');
            const end    = moment.tz(s.endedAt, stg.timezone).format('HH:mm');
            const method = s.learningMethod === 'Offline' ? '🏫' : '💻';
            msg += `   • *${s.group.name}* (${s.group.className})\n`;
            msg += `     ⏰ ${start}–${end} ${method} ${s.room}\n`;
        }
        msg += `\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    const totalKelas = data.reduce((n, d) => n + (d.sections?.length || 0), 0);
    const hariAda    = data.filter(d => d.sections?.length > 0).length;
    msg += `📚 Total: *${totalKelas} kelas* di *${hariAda} hari*`;

    return msg;
}

export default {
    name: 'jadwalweek',
    command: ['jadwalweek', 'jadwalminggu', 'weekschedule'],
    tags: 'Jadwal',
    desc: 'Lihat jadwal kuliah seminggu penuh',
    owner: false,
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        await conn.sendMessage(chatId, { react: { text: '📅', key: msg.key } });

        const text = formatWeekSchedule();
        if (!text) {
            await conn.sendMessage(chatId, {
                text: '❌ Data jadwal belum ada. Gunakan *.syncjadwal* dulu ya!'
            }, { quoted: msg });
            await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return;
        }

        await conn.sendMessage(chatId, { text }, { quoted: msg });
        await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};