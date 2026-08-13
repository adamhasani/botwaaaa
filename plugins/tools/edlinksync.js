import axios from 'axios';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import { refreshEdlinkToken } from '../../toolkit/tokenRefresher.js';

const dbPath = path.join(stg.dbDir, 'deadlines.json');
const API_URL = 'https://api.edlink.id/api/v1.4/home/openassignmentsandquizes';

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

async function fetchEdlinkTasks(token) {
    const { data } = await axios.post(API_URL,
        { limit: 20, page: 1, ao: 0 },
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-app-locale': 'id',
                'origin': 'https://edlink.id',
                'referer': 'https://edlink.id/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        }
    );

    // Edlink selalu HTTP 200 — error dideteksi dari code di body
    if (data?.applicationSystem?.code === 2) {
        const err = new Error('Token expired');
        err.status = 401;
        throw err;
    }

    const tasks = data?.data?.data || data?.data || [];
    if (!Array.isArray(tasks)) throw new Error('Response tidak valid dari Edlink');
    return tasks;
}

// ─────────────────────────────────────────────
// CORE SYNC LOGIC (dipakai command & scheduler)
// ─────────────────────────────────────────────
export async function doEdlinkSync(conn, chatId, msg = null) {
    let token = process.env.EDLINK_TOKEN;

    if (!token) {
        // Tidak ada token sama sekali — coba auto-refresh dulu
        const canAutoRefresh = process.env.EDLINK_EMAIL && process.env.EDLINK_PASSWORD;
        if (!canAutoRefresh) {
            const text = `❌ *EDLINK_TOKEN belum diset!*\n\nTambahkan di *.env*:\n\`EDLINK_TOKEN=xxxxx\`\n\nAtau set \`EDLINK_EMAIL\` & \`EDLINK_PASSWORD\` untuk auto-refresh.`;
            return conn.sendMessage(chatId, { text }, { quoted: msg });
        }
    }

    try {
        const tasks = await fetchEdlinkTasks(token);
        return await processTasks(conn, chatId, msg, tasks);

    } catch (e) {
        // ── AUTO REFRESH KALAU TOKEN EXPIRED ──
        const isTokenExpired = e.response?.status === 401 || e.status === 401 || e.message === 'Token expired';
        if (isTokenExpired) {
            const canAutoRefresh = process.env.EDLINK_EMAIL && process.env.EDLINK_PASSWORD;

            if (canAutoRefresh) {
                if (msg) await conn.sendMessage(chatId, { text: '🔄 Token expired, mencoba auto-refresh...' }, { quoted: msg });
                console.log('[EdlinkSync] Token expired, menjalankan auto-refresh...');

                try {
                    const newToken = await refreshEdlinkToken();

                    // Coba lagi dengan token baru
                    const tasks = await fetchEdlinkTasks(newToken);
                    if (msg) await conn.sendMessage(chatId, { text: '✅ Token berhasil diperbarui! Melanjutkan sync...' }, { quoted: msg });
                    return await processTasks(conn, chatId, msg, tasks);

                } catch (refreshErr) {
                    const text = `❌ *Auto-refresh token gagal!*\n\nDetail: ${refreshErr.message}\n\nCek apakah EDLINK_EMAIL & EDLINK_PASSWORD di .env sudah benar.`;
                    return conn.sendMessage(chatId, { text }, { quoted: msg });
                }
            } else {
                // Ga ada kredensial, minta update manual
                const text = `❌ *Token Edlink expired!*\n\nPerbarui manual:\n1. Login edlink.id\n2. F12 → Network → Fetch/XHR\n3. Klik request apapun → Headers\n4. Copy value *authorization*\n5. Kirim: \`.updatetoken <token>\`\n\n💡 *Tip:* Set \`EDLINK_EMAIL\` & \`EDLINK_PASSWORD\` di .env agar token auto-refresh!`;
                return conn.sendMessage(chatId, { text }, { quoted: msg });
            }
        }

        // Error lainnya
        const text = `❌ *Gagal sync Edlink*\n\nDetail: ${e.message}`;
        return conn.sendMessage(chatId, { text }, { quoted: msg });
    }
}

// ─────────────────────────────────────────────
// PROSES & SIMPAN TASKS KE DB
// ─────────────────────────────────────────────
async function processTasks(conn, chatId, msg, tasks) {
    if (tasks.length === 0) {
        return conn.sendMessage(chatId, {
            text: '🎉 Tidak ada tugas yang perlu dikerjakan di Edlink!'
        }, { quoted: msg });
    }

    const db = readDb();
    const now = moment().tz(stg.timezone);
    let newCount = 0;
    let skipCount = 0;

    for (const task of tasks) {
        const nama = `[Edlink] ${task.title} - ${task.group?.name || ''} ${task.group?.className || ''}`.trim();
        const deadline = moment.tz(task.dueAt, 'YYYY-MM-DD HH:mm:ss', stg.timezone);

        if (deadline.isBefore(now)) { skipCount++; continue; }
        if (db[nama]) { skipCount++; continue; }

        db[nama] = {
            deadline: deadline.toISOString(),
            description: `Mata Kuliah: ${task.group?.name} ${task.group?.className} | ID: ${task.id}`,
            chatId,
            createdAt: now.toISOString(),
            source: 'edlink',
            reminded_h7: false,
            reminded_h1: false,
            reminded_due: false
        };
        newCount++;
    }

    saveDb(db);

    let report = `✅ *SYNC EDLINK SELESAI*\n\n`;
    report += `📥 Tugas baru: *${newCount}*\n`;
    report += `⏭️ Dilewati: *${skipCount}* (sudah ada/lewat)\n\n`;

    if (newCount > 0) {
        report += `📋 *Tugas yang ditambahkan:*\n`;
        let i = 1;
        for (const task of tasks) {
            const deadline = moment.tz(task.dueAt, 'YYYY-MM-DD HH:mm:ss', stg.timezone);
            if (deadline.isAfter(now)) {
                const sisa = deadline.diff(now, 'days');
                report += `${i}. *${task.title}*\n`;
                report += `   📚 ${task.group?.name} ${task.group?.className}\n`;
                report += `   📅 ${deadline.format('ddd, DD MMM YYYY HH:mm')} WIB\n`;
                report += `   ⏳ Sisa: ${sisa} hari\n\n`;
                i++;
            }
        }
    }

    report += `_Gunakan .listtugas untuk melihat semua deadline_`;

    return conn.sendMessage(chatId, { text: report }, { quoted: msg });
}

// ─────────────────────────────────────────────
// PLUGIN DEFINITION
// ─────────────────────────────────────────────
export default {
    name: 'edlinksync',
    command: ['edlinksync', 'synkedlink', 'synctugas'],
    tags: 'Tugas',
    desc: 'Sync tugas dari Edlink ke database deadline bot',
    owner: true,
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;
        await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
        await conn.sendMessage(chatId, { text: '🔄 Mengambil data tugas dari Edlink...' }, { quoted: msg });
        await doEdlinkSync(conn, chatId, msg);
        await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};