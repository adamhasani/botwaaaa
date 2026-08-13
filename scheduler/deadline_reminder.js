import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../toolkit/setting.js';

const deadlinePath = path.join(stg.dbDir, 'deadlines.json');

export function formatSisa(ms) {
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

export function readDb() {
    try {
        if (!fs.existsSync(deadlinePath)) return {};
        return JSON.parse(fs.readFileSync(deadlinePath, 'utf-8'));
    } catch { return {}; }
}

export function saveDb(data) {
    fs.writeFileSync(deadlinePath, JSON.stringify(data, null, 2));
}

function formatNama(nama) {
    let clean = nama.replace(/^\[Edlink\]\s*/, '').trim();
    if (clean.length > 35) clean = clean.substring(0, 32) + '...';
    return clean;
}

function formatMatkul(description) {
    if (!description) return '';
    const match = description.match(/Mata Kuliah:\s*(.+?)\s*\|/);
    if (match) return match[1].trim();
    return '';
}

function getIndikator(diffMs) {
    if (diffMs <= 86400000) return '🔴';
    if (diffMs <= 259200000) return '🟡';
    return '🟢';
}

function buildMessage(tasks, label, emoji, catatan) {
    const now = moment().tz(stg.timezone);

    let msg = `${emoji} *${label}*\n`;
    msg += `_${tasks.length} tugas perlu diselesaikan_\n`;
    msg += `───────────────────\n\n`;

    tasks.forEach(t => {
        const dl = moment(t.deadline).tz(stg.timezone);
        const sisa = dl.diff(now);
        const indikator = getIndikator(sisa);
        const nama = formatNama(t.name);
        const matkul = formatMatkul(t.description);

        msg += `${indikator} *${nama}*\n`;
        if (matkul) msg += `   📚 ${matkul}\n`;
        msg += `   📅 ${dl.format('dddd, DD MMM YYYY')}\n`;
        msg += `   🕐 ${dl.format('HH.mm')} WIB\n`;
        msg += `   ⏳ ${formatSisa(sisa)}\n\n`;
    });

    msg += `───────────────────\n`;
    msg += `_${catatan}_`;

    return msg;
}

async function sendReminder(conn, tasks, label, emoji, catatan) {
    if (tasks.length === 0) return false;

    const msg = buildMessage(tasks, label, emoji, catatan);
    const targets = (process.env.REMINDER_TARGET || '')
        .split(',').map(t => t.trim()).filter(Boolean);

    let anySuccess = false;
    for (const target of targets) {
        try {
            await conn.sendMessage(target, { text: msg });
            anySuccess = true;
        } catch (e) {
            console.error(`[SCHEDULER] Gagal kirim ke ${target}: ${e.message}`);
        }
    }
    return anySuccess;
}

export async function runScheduler(conn) {
    const db = readDb();
    const now = moment().tz(stg.timezone);
    const h = now.hours();
    const m = now.minutes();
    let changed = false;

    const tasks = Object.entries(db).map(([name, data]) => ({ name, ...data }));

    // Bersihkan tugas lewat > 1 hari
    for (const [name, data] of Object.entries(db)) {
        if (now.diff(moment(data.deadline), 'hours') > 24) {
            delete db[name];
            changed = true;
        }
    }

    // H-7: jam 08.00
    if (h === 8 && m === 0) {
        const toRemind = tasks.filter(t => {
            const diff = moment(t.deadline).diff(now, 'days');
            return diff <= 7 && diff > 3 && !t.reminded_h7;
        });
        if (toRemind.length > 0) {
            const ok = await sendReminder(conn, toRemind, 'Deadline Minggu Ini', '📌', 'Yuk mulai cicil dari sekarang! 💪');
            if (ok) {
                toRemind.forEach(t => { db[t.name].reminded_h7 = true; });
                changed = true;
                console.log(`[SCHEDULER] ✅ H-7 reminder: ${toRemind.length} tugas`);
            }
        }
    }

    // H-3: cek tiap menit
    const h3Tasks = tasks.filter(t => {
        const diffHours = moment(t.deadline).diff(now, 'hours');
        return diffHours <= 72 && diffHours > 24 && !t.reminded_h3;
    });
    if (h3Tasks.length > 0) {
        const ok = await sendReminder(conn, h3Tasks, 'Deadline 3 Hari Lagi!', '⚠️', 'Segera selesaikan sebelum terlambat! ⏰');
        if (ok) {
            h3Tasks.forEach(t => { db[t.name].reminded_h3 = true; });
            changed = true;
            console.log(`[SCHEDULER] ✅ H-3 reminder: ${h3Tasks.map(t => formatNama(t.name)).join(', ')}`);
        } else {
            console.log(`[SCHEDULER] ⚠️ H-3 reminder gagal kirim — akan retry menit berikutnya`);
        }
    }

    // H-1: cek tiap menit
    const h1Tasks = tasks.filter(t => {
        const diffHours = moment(t.deadline).diff(now, 'hours');
        return diffHours <= 24 && diffHours > 0 && !t.reminded_h1;
    });
    if (h1Tasks.length > 0) {
        const ok = await sendReminder(conn, h1Tasks, 'Deadline Besok!', '🚨', 'Kerjakan sekarang juga! 🔥');
        if (ok) {
            h1Tasks.forEach(t => { db[t.name].reminded_h1 = true; });
            changed = true;
            console.log(`[SCHEDULER] ✅ H-1 reminder: ${h1Tasks.map(t => formatNama(t.name)).join(', ')}`);
        } else {
            console.log(`[SCHEDULER] ⚠️ H-1 reminder gagal kirim — akan retry menit berikutnya`);
        }
    }

    // Deadline sekarang
    const dueTasks = tasks.filter(t => {
        return Math.abs(moment(t.deadline).diff(now, 'minutes')) <= 1 && !t.reminded_due;
    });
    if (dueTasks.length > 0) {
        const ok = await sendReminder(conn, dueTasks, 'Deadline Sekarang!', '🚨🚨', 'Ini adalah pengingat terakhir!');
        if (ok) {
            dueTasks.forEach(t => { db[t.name].reminded_due = true; });
            changed = true;
            console.log(`[SCHEDULER] ✅ Due reminder: ${dueTasks.map(t => formatNama(t.name)).join(', ')}`);
        } else {
            console.log(`[SCHEDULER] ⚠️ Due reminder gagal kirim — akan retry menit berikutnya`);
        }
    }

    if (changed) saveDb(db);
}