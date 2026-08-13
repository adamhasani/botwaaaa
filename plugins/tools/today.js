import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import { readDb as readDeadlines, formatSisa } from '../../scheduler/deadline_reminder.js';

const WEEKLY_DB         = path.join(stg.dbDir, 'weekly_schedule.json');
const MATERIAL_LOG_PATH = path.join(stg.dbDir, 'edlink_material_log.json');
const QUEST_LOG_PATH    = path.join(stg.dbDir, 'edlink_quest_log.json');

function readJson(p, fallback = {}) {
    try {
        if (!fs.existsSync(p)) return fallback;
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return fallback; }
}

// ─────────────────────────────────────────────
// 1. JADWAL HARI INI
// ─────────────────────────────────────────────
function buildJadwal(todayStr) {
    const db = readJson(WEEKLY_DB, null);
    if (!db) return `🗓️ *Jadwal Hari Ini*\n   ❌ Data belum ada — jalankan _.syncjadwal_\n`;

    const today = (db.data || []).find(d => d.date === todayStr);
    if (!today || !today.sections?.length) {
        return `🗓️ *Jadwal Hari Ini*\n   ✅ Gak ada kelas hari ini\n`;
    }

    let msg = `🗓️ *Jadwal Hari Ini* (${today.sections.length} kelas)\n`;
    today.sections.forEach((s, i) => {
        // startedAt/endedAt udah string WIB polos — parse SEBAGAI Asia/Jakarta
        const start  = moment.tz(s.startedAt, stg.timezone).format('HH:mm');
        const end    = moment.tz(s.endedAt, stg.timezone).format('HH:mm');
        const method = s.learningMethod === 'Offline' ? '🏫' : '💻';

        msg += `   ${i + 1}. *${s.group?.name || 'Kelas'}*`;
        if (s.group?.className) msg += ` (${s.group.className})`;
        msg += `\n      ⏰ ${start}–${end} WIB  ${method} ${s.room || '-'}\n`;
    });
    return msg;
}

// ─────────────────────────────────────────────
// 2. TUGAS DEADLINE HARI INI / BESOK
// ─────────────────────────────────────────────
function buildTugas(now, todayStr, besokStr) {
    const db = readDeadlines();

    const tasks = Object.entries(db)
        .map(([name, data]) => ({ name, ...data }))
        .filter(t => {
            const dStr = moment(t.deadline).tz(stg.timezone).format('YYYY-MM-DD');
            return dStr === todayStr || dStr === besokStr;
        })
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (tasks.length === 0) {
        return `📚 *Tugas Deadline Hari Ini / Besok*\n   ✅ Gak ada yang mepet, aman!\n`;
    }

    let msg = `📚 *Tugas Deadline Hari Ini / Besok*\n`;
    tasks.forEach(t => {
        const dl      = moment(t.deadline).tz(stg.timezone);
        const isToday = dl.format('YYYY-MM-DD') === todayStr;
        const sisa    = formatSisa(dl.diff(now));

        let nama = t.name.replace(/^\[Edlink\]\s*/, '').trim();
        if (nama.length > 38) nama = nama.substring(0, 35) + '...';

        const matkulMatch = (t.description || '').match(/Mata Kuliah:\s*(.+?)\s*\|/);
        const matkul = matkulMatch ? matkulMatch[1].trim() : '';

        msg += `   ${isToday ? '🔴' : '🟡'} *${nama}*\n`;
        if (matkul) msg += `      📖 ${matkul}\n`;
        msg += `      📅 ${isToday ? 'Hari ini' : 'Besok'}, ${dl.format('HH:mm')} WIB — sisa ${sisa}\n`;
    });
    return msg;
}

// ─────────────────────────────────────────────
// 3. MATERI TERBARU (3 hari terakhir)
// ─────────────────────────────────────────────
function buildMateri(now) {
    const log = readJson(MATERIAL_LOG_PATH, {});

    const entries = Object.values(log)
        .filter(m => m?.sentAt && now.diff(moment(m.sentAt), 'days') <= 3)
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        .slice(0, 5);

    if (entries.length === 0) {
        return `📖 *Materi Terbaru (3 hari terakhir)*\n   ✅ Gak ada materi baru\n`;
    }

    let msg = `📖 *Materi Terbaru (3 hari terakhir)*\n`;
    entries.forEach(m => {
        const t = moment(m.sentAt).tz(stg.timezone).format('ddd, HH:mm');
        let judul = m.judul || 'Materi';
        if (judul.length > 45) judul = judul.substring(0, 42) + '...';
        msg += `   • ${judul}\n      _${t} WIB_\n`;
    });
    return msg;
}

// ─────────────────────────────────────────────
// 4. PROGRESS QUEST HARI INI
// ─────────────────────────────────────────────
function buildQuest(todayStr) {
    const log  = readJson(QUEST_LOG_PATH, {});
    const last = log.lastResult;

    if (!last || log.date !== todayStr) {
        return `🎯 *Progress Quest Hari Ini*\n   ⏳ Belum ada data — tunggu sync berikutnya\n`;
    }

    let msg = `🎯 *Progress Quest Hari Ini*\n`;
    const claimed = last.claimed || [];
    const skipped = last.skipped || [];

    if (claimed.length > 0) {
        msg += `   ✅ Selesai: ${claimed.map(c => c.label).join(', ')} (+${last.poinTotal || 0} poin)\n`;
    }
    if (skipped.length > 0) {
        msg += `   ⬜ Belum: ${skipped.map(s => s.label).join(', ')}\n`;
    }
    if (claimed.length === 0 && skipped.length === 0) {
        msg += `   — gak ada data quest hari ini\n`;
    }
    return msg;
}

// ─────────────────────────────────────────────
// PLUGIN
// ─────────────────────────────────────────────
export default {
    name: 'today',
    command: ['today', 'hariini', 'ringkasan'],
    tags: 'Jadwal',
    desc: 'Ringkasan lengkap hari ini: jadwal, deadline tugas, materi terbaru, progress quest',
    owner: false,
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        await conn.sendMessage(chatId, { react: { text: '📋', key: msg.key } });

        const now      = moment().tz(stg.timezone);
        const todayStr = now.format('YYYY-MM-DD');
        const besokStr = now.clone().add(1, 'day').format('YYYY-MM-DD');

        let text = `📋 *RINGKASAN HARI INI*\n`;
        text += `_${now.format('dddd, DD MMMM YYYY')}_\n`;
        text += `${'━'.repeat(22)}\n\n`;

        text += buildJadwal(todayStr) + '\n';
        text += buildTugas(now, todayStr, besokStr) + '\n';
        text += buildMateri(now) + '\n';
        text += buildQuest(todayStr);

        await conn.sendMessage(chatId, { text: text.trim() }, { quoted: msg });
        await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
