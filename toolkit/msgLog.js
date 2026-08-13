/* ╔══════════════════════════════════════════╗
   ║  MESSAGE LOG — simpan pesan terkirim    ║
   ╚══════════════════════════════════════════╝ */

import fs from 'fs';
import path from 'path';
import stg from './setting.js';

const LOG_PATH  = path.join(stg.dbDir, 'message_log.json');
const MAX_HOURS = 24; // simpan log 24 jam, hapus yang lebih lama

function readLog() {
    try {
        if (!fs.existsSync(LOG_PATH)) return [];
        return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
    } catch { return []; }
}

function saveLog(data) {
    try { fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2)); } catch {}
}

// ─────────────────────────────────────────────
// Simpan pesan terkirim ke log
// Dipanggil dari sendWithLog di main.js
// ─────────────────────────────────────────────
export function logSentMessage(msgKey, content, jid) {
    if (!msgKey?.id) return;

    const text = typeof content?.text === 'string' ? content.text : null;
    if (!text) return; // hanya log pesan teks

    const log  = readLog();
    const now  = Date.now();
    const cutoff = now - MAX_HOURS * 60 * 60 * 1000;

    // Buang yang sudah lebih dari MAX_HOURS
    const fresh = log.filter(m => m.ts > cutoff);

    fresh.push({
        id:   msgKey.id,
        jid:  jid,
        ts:   now,
        text: text.substring(0, 200),
    });

    saveLog(fresh);
}

// ─────────────────────────────────────────────
// Ambil pesan dari N jam terakhir untuk jid ini
// ─────────────────────────────────────────────
export function getRecentMessages(jid, hours = 5) {
    const log    = readLog();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return log
        .filter(m => m.jid === jid && m.ts > cutoff)
        .sort((a, b) => b.ts - a.ts); // terbaru dulu
}
