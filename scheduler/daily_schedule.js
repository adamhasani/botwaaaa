// ╔══════════════════════════════════════════╗
//   ║  DAILY SCHEDULE — VPS EDITION           ║
   //║  Baca dari DB lokal, NO Edlink fetch    ║
  // ║  Data diisi via edlink_auto_sync.js     ║
  // ╚══════════════════════════════════════════╝ 

import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../toolkit/setting.js';

const SENT_LOG   = path.join(stg.dbDir, 'schedule_sent.json');
const WEEKLY_DB  = path.join(stg.dbDir, 'weekly_schedule.json');
const STIKER_DB  = path.join(stg.dbDir, 'stiker.json');
const STIKER_LOG = path.join(stg.dbDir, 'stiker_sent.json');

// ─────────────────────────────────────────────
// STIKER: RANDOM JAM & KIRIM HARIAN
// ─────────────────────────────────────────────
function getStikerDb() {
    try {
        if (!fs.existsSync(STIKER_DB)) return [];
        return JSON.parse(fs.readFileSync(STIKER_DB, 'utf-8'));
    } catch { return []; }
}

function getStikerLog() {
    try {
        if (!fs.existsSync(STIKER_LOG)) return {};
        return JSON.parse(fs.readFileSync(STIKER_LOG, 'utf-8'));
    } catch { return {}; }
}

function saveStikerLog(data) {
    try { fs.writeFileSync(STIKER_LOG, JSON.stringify(data)); } catch {}
}

// Generate jam random antara 08.00 - 21.00
function randomJam() {
    const jam = Math.floor(Math.random() * (21 - 8 + 1)) + 8;
    const menit = Math.floor(Math.random() * 60);
    return { jam, menit };
}

let stikerJadwal = null; // { jam, menit } — di-generate sekali per hari

async function runStikerHarian(conn) {
    const stickers = getStikerDb();
    if (stickers.length === 0) return;

    const target = process.env.REMINDER_TARGET;
    if (!target) return;

    const now = moment().tz(stg.timezone);
    const todayStr = now.format('YYYY-MM-DD');
    const log = getStikerLog();

    if (log.lastSentDate === todayStr) return;

    if (!stikerJadwal || stikerJadwal.date !== todayStr) {
        const { jam, menit } = randomJam();
        stikerJadwal = { date: todayStr, jam, menit };

        const jadwalMoment = now.clone().hour(jam).minute(menit).second(0);
        if (jadwalMoment.isBefore(now)) {
            console.log(`[StikerHarian] ⚡ Jam ${String(jam).padStart(2,'0')}.${String(menit).padStart(2,'0')} sudah lewat, kirim sekarang`);
            stikerJadwal.kirimSekarang = true;
        } else {
            console.log(`[StikerHarian] 🎲 Jam stiker hari ini: ${String(jam).padStart(2,'0')}.${String(menit).padStart(2,'0')}`);
        }
    }

    const tepatWaktu = now.hour() === stikerJadwal.jam && now.minute() === stikerJadwal.menit;
    if (!tepatWaktu && !stikerJadwal.kirimSekarang) return;
    stikerJadwal.kirimSekarang = false;

    const stiker = stickers[Math.floor(Math.random() * stickers.length)];

    if (!stiker.filePath || !fs.existsSync(stiker.filePath)) {
        console.error('[StikerHarian] ❌ File stiker tidak ditemukan:', stiker.filePath);
        return;
    }
    const stikerBuffer = fs.readFileSync(stiker.filePath);

    try {
        await conn.sendMessage(target, { sticker: stikerBuffer });
        saveStikerLog({ lastSentDate: todayStr, jam: stikerJadwal.jam, menit: stikerJadwal.menit });
        console.log(`[StikerHarian] ✅ Stiker terkirim jam ${stikerJadwal.jam}.${stikerJadwal.menit}`);
    } catch (e) {
        console.error('[StikerHarian] ❌ Gagal kirim stiker:', e.message);
    }
}

// ─────────────────────────────────────────────
// PERSIST: LAST SENT DATE
// ─────────────────────────────────────────────
function getLastSentDate() {
    try {
        if (!fs.existsSync(SENT_LOG)) return null;
        return JSON.parse(fs.readFileSync(SENT_LOG, 'utf-8')).lastSentDate || null;
    } catch { return null; }
}

function saveLastSentDate(date) {
    try {
        fs.writeFileSync(SENT_LOG, JSON.stringify({ lastSentDate: date }));
    } catch (e) {
        console.error('[DailySchedule] Gagal simpan lastSentDate:', e.message);
    }
}

// ─────────────────────────────────────────────
// AMBIL JADWAL HARI INI DARI DB LOKAL
// ─────────────────────────────────────────────
function getTodayFromDb(todayStr) {
    try {
        if (!fs.existsSync(WEEKLY_DB)) return null;
        const db = JSON.parse(fs.readFileSync(WEEKLY_DB, 'utf-8'));
        return db?.data?.find(d => d.date === todayStr) || null;
    } catch { return null; }
}

// ─────────────────────────────────────────────
// FORMAT PESAN JADWAL
// ─────────────────────────────────────────────
function formatScheduleMessage(todayData) {
    const { date, day, sections } = todayData;
    const tanggal = moment(date).format('DD MMMM YYYY');

    if (!sections || sections.length === 0) {
        return `🗓️ *Jadwal Kuliah — ${day}, ${tanggal}*\n\n✅ Tidak ada kelas hari ini!\nSantai dulu~ 😴`;
    }

    let msg = `🗓️ *Jadwal Kuliah — ${day}, ${tanggal}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    sections.forEach((s, i) => {
        // startedAt/endedAt dari API udah string WIB polos ("YYYY-MM-DD HH:mm:ss"),
        // jadi harus di-parse SEBAGAI Asia/Jakarta, bukan di-convert ke Asia/Jakarta
        // (kalau pakai moment(...).tz(), kena double-shift +7 jam).
        const start = moment.tz(s.startedAt, stg.timezone).format('HH:mm');
        const end   = moment.tz(s.endedAt, stg.timezone).format('HH:mm');
        const method = s.learningMethod === 'Offline' ? '🏫' : '💻';
        const topic  = s.topic && s.topic !== '-' ? `\n   📖 _${s.topic}_` : '';

        msg += `${i + 1}. *${s.group.name}* (${s.group.className})\n`;
        msg += `   ⏰ ${start} – ${end} WIB\n`;
        msg += `   ${method} ${s.room}${topic}\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📚 Total: *${sections.length} kelas* hari ini\n`;
    msg += `_Semangat kuliah! 💪_`;

    return msg;
}

// ─────────────────────────────────────────────
// REMINDER 10 MENIT SEBELUM KELAS
// ─────────────────────────────────────────────
const remindedSections = new Set();

async function runClassReminder(conn) {
    if (!stg.scheduleEnabled) return; // dimatikan manual lewat .env (SCHEDULE_ENABLED=false)

    const target = process.env.REMINDER_TARGET;
    if (!target) return;

    const now      = moment().tz(stg.timezone);
    const todayStr = now.format('YYYY-MM-DD');
    const todayData = getTodayFromDb(todayStr);

    if (!todayData?.sections?.length) return; // masa libur / tidak ada kelas — skip diam-diam

    for (const s of todayData.sections) {
        const startTime     = moment.tz(s.startedAt, stg.timezone);
        const minutesBefore = startTime.diff(now, 'minutes');
        const key           = `${s.id}_${todayStr}`;

        if (minutesBefore <= 10 && minutesBefore > 0 && !remindedSections.has(key)) {
            remindedSections.add(key);

            const method = s.learningMethod === 'Offline' ? '🏫' : '💻';
            const topic  = s.topic && s.topic !== '-' ? `\n📖 _${s.topic}_` : '';

            // Sama seperti formatScheduleMessage — parse SEBAGAI Asia/Jakarta,
            // jangan di-convert lagi (hindari double-shift +7 jam).
            const startFmt = moment.tz(s.startedAt, stg.timezone).format('HH:mm');
            const endFmt   = moment.tz(s.endedAt, stg.timezone).format('HH:mm');

            const msg = `⏰ *KELAS DIMULAI ${minutesBefore} MENIT LAGI!*\n\n`
                + `📚 *${s.group.name}* (${s.group.className})\n`
                + `${method} ${s.room}\n`
                + `🕐 ${startFmt} – ${endFmt} WIB`
                + `${topic}`;

            await conn.sendMessage(target, { text: msg });
            console.log(`[ClassReminder] ✅ Reminder: ${s.group.name}`);
        }
    }
}

// ─────────────────────────────────────────────
// KIRIM JADWAL HARI INI
// ─────────────────────────────────────────────
async function sendTodaySchedule(conn, todayStr) {
    if (!stg.scheduleEnabled) return; // dimatikan manual lewat .env (SCHEDULE_ENABLED=false)

    const target = process.env.REMINDER_TARGET;
    if (!target) return;

    const todayData = getTodayFromDb(todayStr);
    if (!todayData) {
        console.log('[DailySchedule] Data hari ini tidak ada di DB — tunggu auto sync...');
        return;
    }

    if (!todayData.sections || todayData.sections.length === 0) {
        console.log(`[DailySchedule] 🏖️ Tidak ada kelas hari ini (${todayStr}) — skip kirim (masa libur).`);
        saveLastSentDate(todayStr); // tandai sudah "diproses" biar ga dicoba ulang tiap menit
        return;
    }

    const message = formatScheduleMessage(todayData);
    await conn.sendMessage(target, { text: message });
    saveLastSentDate(todayStr);
    console.log(`[DailySchedule] ✅ Jadwal terkirim untuk ${todayStr}`);
}

// ─────────────────────────────────────────────
// STARTUP: KIRIM LANGSUNG KALAU BELUM TERKIRIM
// ─────────────────────────────────────────────
export async function sendScheduleOnStartup(conn) {
    const now      = moment().tz(stg.timezone);
    const todayStr = now.format('YYYY-MM-DD');

    if (now.hour() < 7) return;
    if (getLastSentDate() === todayStr) return;

    await sendTodaySchedule(conn, todayStr);
}

// ─────────────────────────────────────────────
// SCHEDULER UTAMA (dipanggil tiap menit)
// ─────────────────────────────────────────────
export async function runDailySchedule(conn) {
    const now      = moment().tz(stg.timezone);
    const todayStr = now.format('YYYY-MM-DD');

    // Kirim jadwal: tepat jam 07:00, ATAU "catch-up" tiap menit setelah 07:00
    // kalau belum terkirim hari ini (misal startup gagal karena socket
    // belum siap / timeout — minute berikutnya socket udah stabil).
    if (now.hour() >= 7 && getLastSentDate() !== todayStr) {
        await sendTodaySchedule(conn, todayStr);
    }

    // Reminder 10 menit sebelum kelas
    await runClassReminder(conn);

    // Stiker random harian
    // await runStikerHarian(conn); // DISABLED
}