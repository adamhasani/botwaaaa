/* ╔══════════════════════════════════════════╗
   ║  SYNC TO VPS                            ║
   ║  Kirim deadlines + jadwal ke VPS        ║
   ║  Jalankan di PC: node sync-to-vps.js    ║
   ╚══════════════════════════════════════════╝ */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────
// CONFIG — edit sesuai VPS kamu
// ─────────────────────────────────────────────
const VPS_HOST   = process.env.VPS_HOST   || '20/02/2029';   // hostname dari panel
const VPS_PORT   = process.env.VPS_PORT   || 2667;           // port dari panel
const VPS_SECRET = process.env.SYNC_SECRET || '';             // opsional, isi di .env

// ─────────────────────────────────────────────
// KIRIM DATA KE VPS
// ─────────────────────────────────────────────
async function sendToVps(type, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ type, data });

        const options = {
            hostname: VPS_HOST,
            port: VPS_PORT,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-sync-secret': VPS_SECRET
            }
        };

        const req = http.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(raw);
                    resolve({ status: res.statusCode, ...result });
                } catch {
                    resolve({ status: res.statusCode, raw });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
    console.log('🔄 Mulai sync ke VPS...\n');

    const dbDir = path.join(__dirname, 'toolkit/db');
    let success = 0;
    let failed = 0;

    // ── 1. SYNC DEADLINES ──
    const deadlinesPath = path.join(dbDir, 'deadlines.json');
    if (fs.existsSync(deadlinesPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(deadlinesPath, 'utf-8'));
            const result = await sendToVps('deadlines', data);
            if (result.ok) {
                console.log('✅ deadlines.json berhasil dikirim ke VPS');
                success++;
            } else {
                console.log('❌ deadlines.json gagal:', result.message);
                failed++;
            }
        } catch (e) {
            console.log('❌ deadlines.json error:', e.message);
            failed++;
        }
    } else {
        console.log('⚠️  deadlines.json tidak ditemukan, skip');
    }

    // ── 2. SYNC WEEKLY SCHEDULE ──
    const weeklyPath = path.join(dbDir, 'weekly_schedule.json');
    if (fs.existsSync(weeklyPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(weeklyPath, 'utf-8'));
            const result = await sendToVps('weekly_schedule', data);
            if (result.ok) {
                console.log('✅ weekly_schedule.json berhasil dikirim ke VPS');
                success++;
            } else {
                console.log('❌ weekly_schedule.json gagal:', result.message);
                failed++;
            }
        } catch (e) {
            console.log('❌ weekly_schedule.json error:', e.message);
            failed++;
        }
    } else {
        console.log('⚠️  weekly_schedule.json tidak ditemukan, skip');
    }

    console.log(`\n📊 Hasil: ${success} berhasil, ${failed} gagal`);

    if (failed > 0) {
        console.log('\n💡 Tips:');
        console.log('   - Pastiin bot di VPS udah nyala');
        console.log('   - Cek VPS_HOST dan VPS_PORT di .env');
        console.log('   - Cek SYNC_SECRET sama antara PC dan VPS');
    }
}

main().catch(console.error);
