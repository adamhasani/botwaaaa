/* ╔══════════════════════════════════════════╗
   ║  EDLINK DAILY QUEST AUTO-CLAIMER        ║
   ║  Axios only — no browser needed         ║
   ╚══════════════════════════════════════════╝ */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../toolkit/setting.js';

const QUEST_LOG_PATH = path.join(stg.dbDir, 'edlink_quest_log.json');

export function readQuestLog() {
    try {
        if (!fs.existsSync(QUEST_LOG_PATH)) return {};
        return JSON.parse(fs.readFileSync(QUEST_LOG_PATH, 'utf-8'));
    } catch { return {}; }
}

export function saveQuestLog(data) {
    try { fs.writeFileSync(QUEST_LOG_PATH, JSON.stringify(data, null, 2)); } catch {}
}

// ─────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────
function api() {
    const token = process.env.EDLINK_TOKEN;
    if (!token) throw new Error('EDLINK_TOKEN belum diset di .env');
    return axios.create({
        baseURL: 'https://api.edlink.id/api/v1.4',
        timeout: 15000,
        validateStatus: () => true,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://edlink.id/',
            'Origin': 'https://edlink.id',
        },
    });
}

// ─────────────────────────────────────────────
// CORE — ambil daftar quest lalu klaim yang aktif
//
// CATATAN: endpoint /quest milik Edlink ga selalu update status
// is_claimed/status setelah di-claim, jadi kalau cuma andelin
// response API, quest yang sama bisa "berhasil diklaim" lagi
// terus tiap polling (5 menit) → log kebanjiran & kelihatan
// klaim ulang terus.
//
// Makanya dipasang cache harian lokal (edlink_quest_log.json):
// sekali sebuah criteria berhasil diklaim hari ini, ga akan
// dicoba/di-log lagi sampai gantI hari (zona waktu stg.timezone).
// ─────────────────────────────────────────────
export async function claimDailyQuests() {
    const result = { claimed: [], skipped: [], poinTotal: 0, error: null };

    const today = moment().tz(stg.timezone).format('YYYY-MM-DD');
    const prevLog = readQuestLog();

    // Reset cache kalau ganti hari
    let claimedToday = prevLog.date === today ? (prevLog.claimedToday || []) : [];
    let allCriteria  = prevLog.date === today ? (prevLog.allCriteria  || []) : [];

    // ── Short-circuit: semua quest hari ini udah pernah sukses diklaim ──
    // Ga perlu hit API /quest & /quest/claim lagi, ga ada log baru.
    if (allCriteria.length > 0 && allCriteria.every(c => claimedToday.includes(c))) {
        return result;
    }

    const client = api();

    // ── 1. Ambil daftar quest ──
    const listRes = await client.get('/quest');

    if (listRes.status === 401 || listRes.status === 403) {
        result.error = `Token ditolak (HTTP ${listRes.status}) — gunakan .updatetoken`;
        return result;
    }
    if (listRes.status >= 400) {
        result.error = `Endpoint quest error (HTTP ${listRes.status})`;
        return result;
    }

    const raw = listRes.data?.data || listRes.data || [];
    const questList = (Array.isArray(raw) ? raw : Object.values(raw)).filter(Boolean);

    if (!questList.length) {
        result.error = 'Format response quest tidak dikenali atau kosong';
        return result;
    }

    allCriteria = questList.map(q => q.criteria || q.type || q.code).filter(Boolean);

    // ── 2. Klaim satu per satu pakai { criteria } ──
    for (const q of questList) {
        const criteria = q.criteria || q.type || q.code;
        const label    = q.title || q.name || q.label || criteria || 'Quest';
        const poin     = Number(q.point || q.points || q.reward || 0) || 0;

        const isClaimed = q.is_claimed || q.claimed || q.completed
            || q.status === 'claimed' || q.status === 'done';
        const isActive  = q.is_active !== false && q.status !== 'inactive';

        // Skip kalau: kriteria invalid, API bilang udah claimed, quest non-aktif,
        // ATAU cache lokal bilang udah sukses diklaim hari ini.
        if (!criteria || isClaimed || !isActive || claimedToday.includes(criteria)) {
            result.skipped.push({ label, poin });
            continue;
        }

        try {
            const claimRes = await client.post('/quest/claim', { criteria });

            if (claimRes.status >= 200 && claimRes.status < 300) {
                result.claimed.push({ label, poin });
                result.poinTotal += poin;
                claimedToday.push(criteria);
                console.log(`[DailyQuest] ✅ Klaim: ${label} (+${poin} poin)`);
            } else {
                result.skipped.push({ label, poin });
            }
        } catch (e) {
            result.skipped.push({ label, poin });
        }
    }

    if (result.claimed.length > 0) {
        console.log(`[DailyQuest] ✅ ${result.claimed.length} diklaim, +${result.poinTotal} poin`);
    }

    saveQuestLog({
        date: today,
        claimedToday,
        allCriteria,
        lastResult: result,
        updatedAt: new Date().toISOString(),
    });

    return result;
}