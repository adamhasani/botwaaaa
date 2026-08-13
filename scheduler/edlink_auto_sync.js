/* ╔══════════════════════════════════════════╗
   ║  EDLINK AUTO SYNC                       ║
   ║  Tugas · Jadwal · Materi · Pengumuman   ║
   ╚══════════════════════════════════════════╝ */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import moment from 'moment-timezone';
import stg from '../toolkit/setting.js';
import { readDb, saveDb } from './deadline_reminder.js';
import { claimDailyQuests, readQuestLog, saveQuestLog } from './edlink_quest.js';
import { refreshEdlinkToken } from '../toolkit/tokenRefresher.js';
import { sendScheduleOnStartup } from './daily_schedule.js';

// ─────────────────────────────────────────────
// EDLINK API — Sesuaikan endpoint kalau beda
// ─────────────────────────────────────────────
const API_BASE      = 'https://api.edlink.id/api/v1.4';
const EP_TASKS      = '/home/openassignmentsandquizes';
const EP_SCHEDULE   = '/account/weekly-schedules';
const EP_NOTIF      = '/notification/all';

const NOTIF_LOG_PATH  = path.join(stg.dbDir, 'edlink_notif_log.json');
const SYNC_STATE_PATH = path.join(stg.dbDir, 'edlink_sync_state.json');
const WEEKLY_DB       = path.join(stg.dbDir, 'weekly_schedule.json');

// ─────────────────────────────────────────────
// AXIOS — validateStatus true biar ga throw di 4xx/5xx
// ─────────────────────────────────────────────
function api() {
    const token = process.env.EDLINK_TOKEN;
    if (!token) throw new Error('EDLINK_TOKEN belum diset di .env');
    return axios.create({
        baseURL: API_BASE,
        timeout: 15000,
        validateStatus: () => true,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-app-locale': 'id',
            'Origin': 'https://edlink.id',
            'Referer': 'https://edlink.id/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });
}

function readLog(p)      { try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {}; } catch { return {}; } }
function saveLog(p, d)   { try { fs.writeFileSync(p, JSON.stringify(d, null, 2)); } catch {} }
function readSyncState() { return readLog(SYNC_STATE_PATH); }
function saveSyncState(d){ saveLog(SYNC_STATE_PATH, { ...readSyncState(), ...d, updatedAt: new Date().toISOString() }); }

// ─────────────────────────────────────────────
// CEK: apakah weekly_schedule punya data minggu ini?
// ─────────────────────────────────────────────
function hasThisWeekData() {
    try {
        if (!fs.existsSync(WEEKLY_DB)) return false;
        const db = JSON.parse(fs.readFileSync(WEEKLY_DB, 'utf-8'));
        const now = moment().tz(stg.timezone);
        const todayStr = now.format('YYYY-MM-DD');
        return (db?.data || []).some(d => d.date === todayStr);
    } catch { return false; }
}

// ─────────────────────────────────────────────
// VALIDASI TOKEN
// ─────────────────────────────────────────────
async function validateToken(client) {
    const res = await client.get(EP_SCHEDULE);

    // Edlink selalu return HTTP 200, error dideteksi dari code di body
    // code: 0 = OK, code: 2 = token expired/invalid
    const code = res.data?.applicationSystem?.code;
    if (code === 2 || res.data?.data === null) {
        throw new Error(`Token expired atau tidak valid (code: ${code})`);
    }
    return true;
}

// ─────────────────────────────────────────────
// 1. TUGAS → deadlines.json
// ─────────────────────────────────────────────
async function syncTugas(client) {
    const res = await client.post(EP_TASKS, { limit: 50, page: 1, ao: 0 });

    if (res.data?.applicationSystem?.code === 2) throw new Error(`Token expired atau tidak valid`);
    if (res.status >= 400) throw new Error(`Endpoint tidak ditemukan (HTTP ${res.status})`);
    if (!Array.isArray(rawTasks)) throw new Error(`Format response tidak dikenali`);

    const now = moment().tz(stg.timezone);
    const db  = readDb();
    let synced = 0, skipped = 0;
    const newTasks = [];

    for (const task of rawTasks) {
        const nama       = task.title || '';
        const matkulNama = `${task.group?.name || ''} ${task.group?.className || ''}`.trim();
        const deadlineRaw= task.dueAt || '';

        if (!nama || !deadlineRaw) { skipped++; continue; }

        const deadline = moment.tz(deadlineRaw, 'YYYY-MM-DD HH:mm:ss', stg.timezone);
        if (deadline.isBefore(now)) { skipped++; continue; }

        const key      = `[Edlink] ${nama} - ${matkulNama}`.trim();
        const existing = db[key] || {};
        db[key] = {
            deadline:    deadline.toISOString(),
            description: matkulNama ? `Mata Kuliah: ${matkulNama} | ID: ${task.id}` : `ID: ${task.id}`,
            source:      'edlink',
            edlink_id:   String(task.id || ''),
            group_id:    String(task.group?.id || ''),
            reminded_h7:  existing.reminded_h7  || false,
            reminded_h3:  existing.reminded_h3  || false,
            reminded_h1:  existing.reminded_h1  || false,
            reminded_due: existing.reminded_due || false,
        };
        newTasks.push({ nama, matkulNama, deadline });
        synced++;
    }

    saveDb(db);
    return { synced, skipped, newTasks };
}

// ─────────────────────────────────────────────
// 2. JADWAL → weekly_schedule.json
//    Ambil minggu ini + minggu depan (untuk Jumat–Minggu)
//    supaya Senin pagi data sudah siap
// ─────────────────────────────────────────────
async function fetchWeekSchedule(client, dateParam = null) {
    const params = dateParam ? { date: dateParam } : {};
    const res = await client.get(EP_SCHEDULE, { params });

    if (res.data?.applicationSystem?.code === 2) throw new Error(`Token expired atau tidak valid`);
    if (res.status >= 400) throw new Error(`Endpoint tidak ditemukan (HTTP ${res.status})`);

    const days = res.data?.data || [];
    if (!Array.isArray(days)) throw new Error('Format response tidak dikenali');

    // Normalisasi tiap section ke struktur yang dipakai daily_schedule.js
    return days.map(d => ({
        date: d.date,
        day:  d.day,
        sections: (d.sections || []).map(s => ({
            id:             s.id,
            group: {
                name:      s.group?.name || '',
                className: s.group?.className || '',
            },
            startedAt:      s.startedAt,
            endedAt:        s.endedAt,
            room:           s.room || 'Online',
            learningMethod: s.learningMethod || 'Online',
            topic:          s.topic && s.topic !== '' ? s.topic : '-',
        })),
    }));
}

async function syncJadwal(client) {
    const now = moment().tz(stg.timezone);

    // Minggu ini — endpoint sudah balikin 7 hari (Senin-Minggu) lengkap
    let data = await fetchWeekSchedule(client);

    // Kalau Jumat/Sabtu/Minggu, coba ambil minggu depan juga
    // supaya Senin pagi data sudah siap (asumsi endpoint terima ?date=)
    const isEndOfWeek = [5, 6, 0].includes(now.day());
    if (isEndOfWeek) {
        try {
            const nextMonday = now.clone().startOf('isoWeek').add(7, 'days').format('YYYY-MM-DD');
            const nextWeek   = await fetchWeekSchedule(client, nextMonday);

            // Hanya gabung kalau benar-benar data minggu berbeda (cek tanggal pertama)
            if (nextWeek[0]?.date && nextWeek[0].date !== data[0]?.date) {
                data = [...data, ...nextWeek];
            }
        } catch (e) {
            console.log(`[EdlinkSync] ⚠️ Gagal fetch jadwal minggu depan: ${e.message}`);
        }
    }

    const weekOf = data[0]?.date || now.clone().startOf('isoWeek').format('YYYY-MM-DD');

    fs.writeFileSync(WEEKLY_DB, JSON.stringify({
        weekOf,
        fetchedAt: new Date().toISOString(),
        data,
    }, null, 2));

    return { weekOf, hariAda: data.filter(d => d.sections.length > 0).length };
}

// ─────────────────────────────────────────────
// 3. NOTIFIKASI — tugas & materi baru → kirim ke WA
//    Endpoint: POST /notification/all
//    Deteksi baru: status "SENT" (belum dibaca) & belum ada di log
// ─────────────────────────────────────────────
function decodeHtml(str) {
    return (str || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

async function syncNotifikasi(client, conn) {
    const res = await client.post(EP_NOTIF, { limit: 20, page: 1 });

    if (res.data?.applicationSystem?.code === 2) throw new Error('Token expired atau tidak valid');
    if (res.status >= 400) throw new Error(`Endpoint tidak ditemukan (HTTP ${res.status})`);

    const raw = res.data?.data?.data || [];
    if (!Array.isArray(raw)) throw new Error('Format response tidak dikenali');

    const log       = readLog(NOTIF_LOG_PATH);
    const isFirstRun = Object.keys(log).length === 0;
    const target    = process.env.REMINDER_TARGET;
    let tugas = 0, materi = 0;

    for (const n of raw) {
        const id = String(n.id || '');
        if (!id || log[id]) continue;

        log[id] = { sentAt: new Date().toISOString(), title: n.title, status: n.status };

        // Pertama kali run → isi log tanpa kirim WA (hindari spam notif lama)
        if (isFirstRun) continue;

        const judul  = decodeHtml(n.title || '');
        const desk   = decodeHtml(n.description || '');
        const matkul = n.group?.name || '';
        const kelas  = n.group?.type || '';
        const dari   = n.triggerUser?.name || n.sender?.name || '';
        const tgl    = moment(n.createdAt).tz(stg.timezone);
        const tipe   = n.post?.type; // "Q" = tugas, "M" = materi

        let msg = '';
        if (tipe === 'Q') {
            msg = `📋 *TUGAS BARU DI EDLINK*\n`
                + `━━━━━━━━━━━━━━━━━━━━\n`
                + `📌 *${desk}*\n`
                + `📚 ${matkul} (${kelas})\n`
                + `👤 ${dari}\n`
                + `🕐 ${tgl.format('DD MMM YYYY HH:mm')} WIB\n`
                + `━━━━━━━━━━━━━━━━━━━━\n`
                + `_Cek Edlink untuk detail & deadline_`;
            tugas++;
        } else if (tipe === 'M') {
            msg = `📚 *MATERI BARU DI EDLINK*\n`
                + `━━━━━━━━━━━━━━━━━━━━\n`
                + `📖 *${desk}*\n`
                + `📚 ${matkul} (${kelas})\n`
                + `👤 ${dari}\n`
                + `🕐 ${tgl.format('DD MMM YYYY HH:mm')} WIB\n`
                + `━━━━━━━━━━━━━━━━━━━━`;
            materi++;
        } else {
            // Tipe lain (komentar, dll) — log tapi tidak kirim WA
            console.log(`[EdlinkSync] 🔔 Notif (type ${tipe}): ${judul}`);
            continue;
        }

        console.log(`[EdlinkSync] 🔔 ${judul}`);

        if (conn && target && msg) {
            for (const t of target.split(',').map(x => x.trim()).filter(Boolean)) {
                try { await conn.sendMessage(t, { text: msg }); } catch (e) {
                    console.error(`[EdlinkSync] ⚠️ Gagal kirim notif: ${e.message}`);
                }
            }
        }
    }

    saveLog(NOTIF_LOG_PATH, log);
    return { tugas, materi };
}

// ─────────────────────────────────────────────
// MASTER SYNC
// ─────────────────────────────────────────────
async function doSync(client, conn) {
    const result = { tugas: null, jadwal: null, notifikasi: null, errors: [] };
    const jobs = [
        ['tugas',       () => syncTugas(client)],
        ['jadwal',      () => syncJadwal(client)],
        ['notifikasi',  () => syncNotifikasi(client, conn)],
    ];
    for (const [key, fn] of jobs) {
        try { result[key] = await fn(); }
        catch (e) { result.errors.push(`${key}: ${e.message}`); }
    }
    return result;
}

export async function runEdlinkSync(conn = null) {
    const canRefresh = process.env.EDLINK_EMAIL && process.env.EDLINK_PASSWORD;

    // ── Cek token dulu ──
    let client = api();
    try {
        await validateToken(client);
    } catch (e) {
        // Token expired → coba refresh dulu
        if (!canRefresh) throw e;
        console.log('[EdlinkSync] 🔁 Token expired — refresh otomatis...');
        await refreshEdlinkToken();
        console.log('[EdlinkSync] ✅ Token baru didapat, lanjut sync...');
        client = api(); // buat client baru dengan token baru
    }

    // ── Jalankan semua sync ──
    let result = await doSync(client, conn);

    // ── Kalau masih ada error token expired setelah sync, coba refresh sekali lagi ──
    const hasTokenError = result.errors.some(e =>
        e.includes('Token expired') || e.includes('tidak valid')
    );
    if (hasTokenError && canRefresh) {
        console.log('[EdlinkSync] 🔁 Token expired saat sync — refresh dan retry...');
        try {
            await refreshEdlinkToken();
            result = await doSync(api(), conn);
        } catch (e) {
            result.errors.push('token_refresh: ' + e.message);
        }
    }

    saveSyncState({ lastSync: new Date().toISOString() });
    return result;
}

// Alias untuk kompatibilitas dengan main.js
export const runEdlinkQuickPoll = runEdlinkAutoSync;
//
// Logika:
//   1. Cek apakah jam sekarang = SYNC_HOUR WIB
//   2. Cek apakah hari ini sudah pernah sync (pakai lastSyncDate)
//   3. Kalau belum → sync
//   4. Setelah sync jadwal berhasil → langsung kirim jadwal hari ini
//      (kalau sudah lewat jam 7, misal sync jam 23 malam → skip;
//       tapi berguna kalau bot restart tengah hari & belum sync)
//   5. Auto claim daily quest
//
// Tambahan: kalau bot baru start dan weekly_schedule tidak punya
//   data hari ini → langsung sync tanpa nunggu SYNC_HOUR
// ─────────────────────────────────────────────
// Cooldown: jangan sync lebih dari sekali tiap 10 menit kalau data masih kosong
let lastMissingSync = null;
let lastNotifPoll   = null; // polling notifikasi tiap 15 menit

export async function runEdlinkAutoSync(conn) {
    const token = process.env.EDLINK_TOKEN;
    if (!token) return;

    const now      = moment().tz(stg.timezone);
    const todayStr = now.format('YYYY-MM-DD');
    const syncHour = parseInt(process.env.SYNC_HOUR || '23', 10);

    // ── POLLING NOTIFIKASI — tiap 15 menit, terpisah dari sync malam ──
    const menitSejak = lastNotifPoll ? now.diff(lastNotifPoll, 'minutes') : 999;
    if (menitSejak >= 15) {
        lastNotifPoll = now;
        try {
            const client = api();
            // Validasi token dulu — kalau expired, refresh
            try {
                await validateToken(client);
            } catch {
                if (process.env.EDLINK_EMAIL && process.env.EDLINK_PASSWORD) {
                    await refreshEdlinkToken();
                }
            }
            const result = await syncNotifikasi(api(), conn);
            if (result.tugas > 0 || result.materi > 0) {
                console.log(`[EdlinkSync] 🔔 Notif baru — Tugas: ${result.tugas}, Materi: ${result.materi}`);
            }
        } catch (e) {
            console.error(`[EdlinkSync] ⚠️ Polling notif gagal: ${e.message}`);
        }
    }

    const state           = readSyncState();
    const lastSyncDate    = state.lastSyncDate || null;

    // ── Cek apakah perlu sync sekarang ──
    const isScheduledTime = now.hour() === syncHour && now.minute() === 0;
    const alreadySyncedToday = lastSyncDate === todayStr;
    const missingTodayData = !hasThisWeekData();

    // Cooldown 10 menit untuk missing data sync — biar tidak spam tiap menit
    if (missingTodayData && lastMissingSync) {
        const menitSejak = moment().diff(lastMissingSync, 'minutes');
        if (menitSejak < 10) return;
    }

    const shouldSync = (isScheduledTime && !alreadySyncedToday) || missingTodayData;
    if (!shouldSync) return;

    if (missingTodayData && !isScheduledTime) {
        console.log('[EdlinkSync] 📭 Data jadwal hari ini tidak ada — sync sekarang...');
        lastMissingSync = moment();
    } else {
        console.log(`[EdlinkSync] 🌙 Sync malam (jam ${syncHour}:00) dimulai...`);
    }

    try {
        const result = await runEdlinkSync(conn);

        const parts = [];
        if (result.tugas)      parts.push(`Tugas: ${result.tugas.synced} sync`);
        if (result.jadwal)     parts.push(`Jadwal: ${result.jadwal.hariAda} hari ada kelas`);
        if (result.notifikasi) parts.push(`Notif baru — Tugas: ${result.notifikasi.tugas}, Materi: ${result.notifikasi.materi}`);
        if (result.errors.length) parts.push(`⚠️ ${result.errors.join(' | ')}`);
        console.log('[EdlinkSync] ✅ ' + parts.join(' | '));

        // Simpan tanggal sync berhasil
        saveSyncState({ lastSyncDate: todayStr });

        // Kirim notif tugas baru ke REMINDER_TARGET
        const target = process.env.REMINDER_TARGET;
        if (conn && target && result.tugas?.newTasks?.length > 0) {
            const n = moment().tz(stg.timezone);
            let txt = `📋 *TUGAS BARU DI EDLINK*\n`;
            txt += `📅 ${n.format('DD MMM YYYY HH:mm')} WIB\n`;
            txt += `${'━'.repeat(22)}\n\n`;

            result.tugas.newTasks.forEach((t, i) => {
                const sisa = t.deadline.diff(n, 'days');
                txt += `${i + 1}. *${t.nama}*\n`;
                txt += `   📚 ${t.matkulNama}\n`;
                txt += `   📅 ${t.deadline.format('ddd, DD MMM YYYY HH:mm')} WIB\n`;
                txt += `   ⏳ Sisa ${sisa} hari\n\n`;
            });
            txt += `_Gunakan .listtugas untuk lihat semua deadline_`;

            for (const t of target.split(',').map(x => x.trim()).filter(Boolean)) {
                try { await conn.sendMessage(t, { text: txt }); } catch {}
            }
        }

        // Setelah jadwal berhasil di-sync, kirim jadwal hari ini
        // (sendScheduleOnStartup sudah handle cek jam > 7 & belum terkirim)
        if (result.jadwal && conn) {
            try {
                await sendScheduleOnStartup(conn);
            } catch (e) {
                console.error('[EdlinkSync] ⚠️ Gagal kirim jadwal setelah sync:', e.message);
            }
        }

    } catch (e) {
        console.error('[EdlinkSync] ❌ Gagal:', e.message);
        return; // Jangan lanjut ke quest kalau sync aja gagal
    }

    // ── AUTO CLAIM QUEST setelah sync berhasil ──
    console.log('[DailyQuest] 🎯 Sync selesai — cek & klaim daily quest...');
    try {
        const qResult = await claimDailyQuests();
        saveQuestLog({ lastResult: qResult, updatedAt: new Date().toISOString() });

        if (qResult.claimed.length > 0) {
            console.log(`[DailyQuest] 🎯 Quest diklaim: ${qResult.claimed.map(q => q.label).join(', ')}`);
        }

        if (qResult.error) {
            console.error('[DailyQuest] ❌ Gagal claim:', qResult.error);
        } else {
            console.log(`[DailyQuest] ✅ ${qResult.claimed.length} quest diklaim, +${qResult.poinTotal} poin`);
        }
    } catch (e) {
        console.error('[DailyQuest] ❌ Error:', e.message);
    }
}