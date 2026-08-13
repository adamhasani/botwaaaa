/* ╔══════════════════════════════════════════╗
   ║  SIMPANAN DB — dipakai bareng WA & Telegram ║
   ║  Port dari bot.py (sqlite3) -> better-sqlite3 ║
   ║  [MIGRASI CPU] -> sql.js (WASM). better-sqlite3 ║
   ║  itu native binary, crash "Illegal instruction"  ║
   ║  di CPU virtual tanpa AVX/SSE4.2 (VPS murah/       ║
   ║  QEMU lama). sql.js = SQLite via WebAssembly,       ║
   ║  jalan di CPU manapun. Lihat toolkit/sqliteWasm.js.  ║
   ╚══════════════════════════════════════════╝ */
import { openDb } from './sqliteWasm.js';
import path from 'path';
import stg from './setting.js';
import fs from 'fs';

if (!fs.existsSync(stg.dbDir)) fs.mkdirSync(stg.dbDir, { recursive: true });

const db = await openDb(path.join(stg.dbDir, 'simpenan.db'));
db.pragma('journal_mode = WAL'); // no-op di wrapper WASM, dipertahankan biar baris di bawah gak perlu diubah

db.exec(`
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT, type TEXT, tag TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT DEFAULT 'wa',
    chat_id TEXT,
    text TEXT,
    remind_at TEXT,
    done INTEGER DEFAULT 0,
    is_recurring TEXT DEFAULT 'none'
);
CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT DEFAULT 'wa',
    chat_id TEXT,
    role TEXT,
    content TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
    platform TEXT,
    chat_id TEXT,
    PRIMARY KEY (platform, chat_id)
);
CREATE TABLE IF NOT EXISTS daily_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT DEFAULT 'wa',
    chat_id TEXT,
    content TEXT,
    mood TEXT,
    created_at TEXT
);
`);

// ── USERS ──
export function registerUser(platform, chatId) {
    db.prepare('INSERT OR IGNORE INTO users (platform, chat_id) VALUES (?, ?)').run(platform, String(chatId));
}
export function getAllUsers() {
    return db.prepare('SELECT platform, chat_id FROM users').all();
}

// ── CHAT HISTORY (dipakai buat context AI chat) ──
export function saveChat(platform, chatId, role, content) {
    db.prepare('INSERT INTO chat_history (platform, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(platform, String(chatId), role, content, new Date().toISOString());
}
export function getChatHistory(platform, chatId, limit = 8) {
    const rows = db.prepare('SELECT role, content FROM chat_history WHERE platform=? AND chat_id=? ORDER BY id DESC LIMIT ?')
        .all(platform, String(chatId), limit);
    return rows.reverse();
}
export function clearChatHistory(platform, chatId) {
    db.prepare('DELETE FROM chat_history WHERE platform=? AND chat_id=?').run(platform, String(chatId));
}

// ── ITEMS (simpanan) ──
export function saveItem(content, type, tag = '') {
    db.prepare('INSERT INTO items (content, type, tag, created_at) VALUES (?, ?, ?, ?)')
      .run(content, type, tag, new Date().toISOString());
}
export function deleteItem(id) {
    db.prepare('DELETE FROM items WHERE id=?').run(id);
}
export function searchItems(keyword) {
    return db.prepare('SELECT id, content, type, tag, created_at FROM items WHERE content LIKE ? OR tag LIKE ? ORDER BY created_at DESC')
        .all(`%${keyword}%`, `%${keyword}%`);
}
export function getItemsByType(type) {
    if (type === 'link') {
        return db.prepare("SELECT id, content, type, tag, created_at FROM items WHERE type='link' OR content LIKE '%http%' ORDER BY created_at DESC").all();
    }
    return db.prepare('SELECT id, content, type, tag, created_at FROM items WHERE type=? ORDER BY created_at DESC').all(type);
}
export function getAllItems() {
    return db.prepare('SELECT id, content, type, tag, created_at FROM items ORDER BY created_at DESC').all();
}
export function countItems() {
    return db.prepare('SELECT type, COUNT(*) as total FROM items GROUP BY type').all();
}
export function deleteAllItems() {
    db.prepare('DELETE FROM items').run();
}

// ── SIMILARITY (v2) ──
// [FIX] Similarity lama cuma hitung "berapa karakter shorter yang ada di longer"
// -> gampang false-positive (dua kalimat pendek beda topik tapi sama-sama pakai
// huruf umum bisa kehitung "mirip"). Diganti Dice coefficient berbasis bigram,
// setara sama difflib.SequenceMatcher.ratio() yang dipakai di versi Python.
function diceCoefficient(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramMap = (s) => {
        const map = new Map();
        for (let i = 0; i < s.length - 1; i++) {
            const bg = s.substring(i, i + 2);
            map.set(bg, (map.get(bg) || 0) + 1);
        }
        return map;
    };

    const aBigrams = bigramMap(a);
    const bBigrams = bigramMap(b);
    let intersection = 0;
    for (const [bg, count] of aBigrams) {
        if (bBigrams.has(bg)) intersection += Math.min(count, bBigrams.get(bg));
    }
    return (2 * intersection) / ((a.length - 1) + (b.length - 1));
}

// Duplikat / near-duplicate (kemiripan tinggi, >= 0.6)
export function checkSimilarItem(content) {
    const all = getAllItems();
    let best = null, bestScore = 0;
    for (const item of all) {
        const score = diceCoefficient(item.content, content);
        if (score >= 0.6 && score > bestScore) { best = item; bestScore = score; }
    }
    return best;
}

// [FITUR BARU] Item yang MIRIP-TAPI-BEDA (0.3 - 0.6) — bukan duplikat, tapi
// temanya nyambung. Dipakai buat kasih saran "btw ini terkait sama simpenan lama".
export function getRelatedItems(content, excludeContent = null, maxResults = 3) {
    const all = getAllItems().filter(i => i.content !== excludeContent);
    const scored = [];
    for (const item of all) {
        const score = diceCoefficient(item.content, content);
        if (score >= 0.3 && score < 0.6) scored.push({ score, item });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.item);
}

// ── REMINDERS ──
export function saveReminder(platform, chatId, text, remindAtISO, recurring = 'none') {
    db.prepare('INSERT INTO reminders (platform, chat_id, text, remind_at, is_recurring) VALUES (?, ?, ?, ?, ?)')
      .run(platform, String(chatId), text, remindAtISO, recurring);
}
export function getActiveReminders(platform, chatId) {
    return db.prepare('SELECT text, remind_at, is_recurring FROM reminders WHERE platform=? AND chat_id=? AND done=0')
        .all(platform, String(chatId));
}
export function getDueReminders() {
    return db.prepare('SELECT id, platform, chat_id, text, remind_at, is_recurring FROM reminders WHERE done=0 AND remind_at<=?')
        .all(new Date().toISOString());
}
export function markReminderDone(id, isRecurring, currentRemindAtISO) {
    if (isRecurring === 'daily') {
        const next = new Date(currentRemindAtISO);
        next.setDate(next.getDate() + 1);
        db.prepare('UPDATE reminders SET remind_at=? WHERE id=?').run(next.toISOString(), id);
    } else {
        db.prepare('UPDATE reminders SET done=1 WHERE id=?').run(id);
    }
}

// ── JOURNAL ──
export function saveJournal(platform, chatId, content, mood = '') {
    db.prepare('INSERT INTO daily_journal (platform, chat_id, content, mood, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(platform, String(chatId), content, mood, new Date().toISOString());
}
export function getJournal(platform, chatId, limit = 10) {
    return db.prepare('SELECT content, mood, created_at FROM daily_journal WHERE platform=? AND chat_id=? ORDER BY created_at DESC LIMIT ?')
        .all(platform, String(chatId), limit);
}

// [FITUR BARU] Ambil entri jurnal sejak tanggal tertentu — dipakai buat laporan mingguan.
export function getJournalSince(platform, chatId, sinceISO) {
    return db.prepare('SELECT content, mood, created_at FROM daily_journal WHERE platform=? AND chat_id=? AND created_at>=? ORDER BY created_at ASC')
        .all(platform, String(chatId), sinceISO);
}

export default db;
