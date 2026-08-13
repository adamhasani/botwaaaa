import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';

const WEEKLY_DB = path.join(stg.dbDir, 'weekly_schedule.json');

const HARI_ALIAS = {
    senin:   0, sen: 0, mon: 0,
    selasa:  1, sel: 1, tue: 1,
    rabu:    2, rab: 2, wed: 2,
    kamis:   3, kam: 3, thu: 3,
    jumat:   4, jum: 4, fri: 4,
    sabtu:   5, sab: 5, sat: 5,
    minggu:  6, min: 6, sun: 6,
};

// ─────────────────────────────────────────────
// BACA DB
// ─────────────────────────────────────────────
function readWeeklyDb() {
    try {
        if (!fs.existsSync(WEEKLY_DB)) return null;
        return JSON.parse(fs.readFileSync(WEEKLY_DB, 'utf-8'));
    } catch { return null; }
}

// ─────────────────────────────────────────────
// FORMAT SATU HARI
// ─────────────────────────────────────────────
function formatHari(dayData, isToday = false) {
    const { date, day, sections } = dayData;
    const tanggal = moment(date).format('DD MMMM YYYY');
    const todayTag = isToday ? ' _(hari ini)_' : '';

    if (!sections || sections.length === 0) {
        return `🗓️ *${day}, ${tanggal}*${todayTag}\n✅ Tidak ada kelas\n`;
    }

    let msg = `🗓️ *${day}, ${tanggal}*${todayTag}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    sections.forEach((s, i) => {
        // startedAt/endedAt udah string WIB polos — parse SEBAGAI Asia/Jakarta,
        // jangan di-convert lagi (hindari double-shift +7 jam).
        const start  = moment.tz(s.startedAt, stg.timezone).format('HH:mm');
        const end    = moment.tz(s.endedAt, stg.timezone).format('HH:mm');
        const method = s.learningMethod === 'Offline' ? '🏫' : '💻';
        const topic  = s.topic && s.topic !== '-' ? `\n   📖 _${s.topic}_` : '';

        msg += `${i + 1}. *${s.group.name}*`;
        if (s.group.className) msg += ` (${s.group.className})`;
        msg += `\n   ⏰ ${start} – ${end} WIB\n`;
        msg += `   ${method} ${s.room}${topic}\n`;
    });

    msg += `📚 ${sections.length} kelas`;
    return msg;
}

// ─────────────────────────────────────────────
// FORMAT SEMINGGU
// ─────────────────────────────────────────────
function formatMinggu(data, todayStr) {
    const hariAda = data.filter(d => d.sections?.length > 0);

    if (hariAda.length === 0) {
        return `📭 Tidak ada kelas minggu ini.`;
    }

    let msg = `📅 *JADWAL MINGGU INI*\n${'━'.repeat(22)}\n\n`;
    hariAda.forEach(d => {
        const isToday = d.date === todayStr;
        msg += formatHari(d, isToday) + '\n\n';
    });

    return msg.trim();
}

// ─────────────────────────────────────────────
// PLUGIN
// ─────────────────────────────────────────────
export default {
    name: 'edlinkjadwal',
    command: ['edlinkjadwal', 'jadwal', 'matkul'],
    tags: 'Jadwal',
    desc: 'Lihat jadwal kuliah dari database lokal',
    prefix: true,

    /*
     * Cara pakai:
     *   .jadwal           → jadwal hari ini
     *   .jadwal minggu    → jadwal seminggu penuh
     *   .jadwal senin     → jadwal hari tertentu
     *   .jadwal besok     → jadwal besok
     */
    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;

        const db = readWeeklyDb();
        if (!db) {
            return conn.sendMessage(chatId, {
                text: '❌ Data jadwal belum ada.\nJalankan sync dulu atau tunggu auto-sync malam ini.'
            }, { quoted: msg });
        }

        const now      = moment().tz(stg.timezone);
        const todayStr = now.format('YYYY-MM-DD');
        const arg      = (args[0] || '').toLowerCase();

        // ── SEMINGGU ──
        if (arg === 'minggu' || arg === 'week' || arg === 'semua') {
            const text = formatMinggu(db.data || [], todayStr);
            const fetchedAt = moment(db.fetchedAt).tz(stg.timezone).format('DD MMM HH:mm');
            return conn.sendMessage(chatId, {
                text: text + `\n\n_Data diambil: ${fetchedAt} WIB_`
            }, { quoted: msg });
        }

        // ── HARI TERTENTU (senin, selasa, dst) ──
        if (arg && HARI_ALIAS[arg] !== undefined) {
            const targetIdx  = HARI_ALIAS[arg]; // 0=Senin ... 6=Minggu
            const nowIsoDay  = now.isoWeekday() - 1; // 0=Senin ... 6=Minggu
            let diff = targetIdx - nowIsoDay;
            if (diff < 0) diff += 7; // ambil minggu depan kalau sudah lewat

            const targetDate = now.clone().add(diff, 'days').format('YYYY-MM-DD');
            const dayData    = (db.data || []).find(d => d.date === targetDate);

            if (!dayData) {
                return conn.sendMessage(chatId, {
                    text: `❌ Data untuk hari itu belum tersedia di DB.\nSync ulang dengan _.syncjadwal_`
                }, { quoted: msg });
            }

            return conn.sendMessage(chatId, {
                text: formatHari(dayData, targetDate === todayStr)
            }, { quoted: msg });
        }

        // ── BESOK ──
        if (arg === 'besok' || arg === 'tomorrow') {
            const besokStr  = now.clone().add(1, 'days').format('YYYY-MM-DD');
            const dayData   = (db.data || []).find(d => d.date === besokStr);

            if (!dayData) {
                return conn.sendMessage(chatId, {
                    text: `❌ Data besok belum ada di DB.`
                }, { quoted: msg });
            }

            return conn.sendMessage(chatId, {
                text: formatHari(dayData, false)
            }, { quoted: msg });
        }

        // ── HARI INI (default) ──
        const todayData = (db.data || []).find(d => d.date === todayStr);

        if (!todayData) {
            const fetchedAt = moment(db.fetchedAt).tz(stg.timezone).format('DD MMM YYYY HH:mm');
            return conn.sendMessage(chatId, {
                text: `❌ Tidak ada data untuk hari ini.\n_DB terakhir diupdate: ${fetchedAt} WIB_\n\nKetik _.syncjadwal_ untuk sync ulang.`
            }, { quoted: msg });
        }

        const fetchedAt = moment(db.fetchedAt).tz(stg.timezone).format('DD MMM HH:mm');
        return conn.sendMessage(chatId, {
            text: formatHari(todayData, true) + `\n\n_Data diambil: ${fetchedAt} WIB_`
        }, { quoted: msg });
    }
};