/* ╔════════════════════════════════════════════════════════╗
   ║  SMART CONTEXT RECALL v2                                  ║
   ║  Port dari perbaikan get_relevant_context() di bot.py.     ║
   ║  [FIX] Versi lama (kalau ada) rawan false-positive: 1 kata  ║
   ║  umum ("sistem", "mesin") bisa sendirian nge-trigger recall ║
   ║  yang salah nyambung. Sekarang pakai scoring + threshold.   ║
   ╚════════════════════════════════════════════════════════╝ */
import db from './simpananDb.js';

const STOPWORDS_ID = new Set([
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'aku', 'kamu', 'gue', 'lo', 'untuk',
    'dengan', 'apa', 'ga', 'gak', 'nggak', 'deh', 'sih', 'dong', 'ya', 'nya', 'kok', 'kan',
    'aja', 'banget', 'gimana', 'kalo', 'kalau', 'lebih', 'memilih', 'adalah', 'atau',
    'juga', 'saja', 'masih', 'sudah', 'belum', 'akan', 'bisa', 'ada', 'tidak', 'jadi',
]);

// Kata generik yang sering muncul di banyak konteks berbeda -> gampang bikin
// false-positive kalau dipakai sendirian tanpa kata spesifik pendamping.
const GENERIC_LOW_SIGNAL = new Set([
    'sistem', 'mesin', 'informasi', 'data', 'cara', 'hal', 'orang', 'waktu',
    'hari', 'tempat', 'kerja', 'buat', 'punya', 'tahu', 'lihat', 'pakai',
]);

export function extractKeywords(text, maxKw = 6, minLen = 4) {
    const words = (text.toLowerCase().match(/\w+/g) || []);
    let kw = words.filter(w => !STOPWORDS_ID.has(w) && w.length >= minLen);
    if (!kw.length) kw = words.filter(w => w.length >= 3);
    return kw.slice(0, maxKw);
}

/**
 * Narik data lama (items + jurnal) yang relevan sama pesan sekarang, dengan
 * syarat minimal skor overlap tertentu:
 * - kata spesifik yang match = 2 poin
 * - kata generik yang match  = 1 poin
 * Kalau skor total di bawah minScore, hasil dianggap noise dan diabaikan.
 */
export function getRelevantContext(platform, chatId, query, { limit = 4, minScore = 2 } = {}) {
    const keywords = extractKeywords(query);
    if (!keywords.length) return '';

    const specificKw = keywords.filter(k => !GENERIC_LOW_SIGNAL.has(k));
    const genericKw = keywords.filter(k => GENERIC_LOW_SIGNAL.has(k));

    // Semua keyword generik -> risiko salah nyambung terlalu tinggi, skip recall.
    if (!specificKw.length) return '';

    const searchKw = [...specificKw, ...genericKw];
    const cond = searchKw.map(() => 'content LIKE ?').join(' OR ');
    const params = searchKw.map(k => `%${k}%`);

    let items = [];
    let journals = [];
    try {
        items = db.prepare(`SELECT content, created_at FROM items WHERE ${cond} ORDER BY created_at DESC LIMIT 20`).all(...params);
        journals = db.prepare(`SELECT content, mood, created_at FROM daily_journal WHERE platform=? AND chat_id=? AND (${cond}) ORDER BY created_at DESC LIMIT 20`)
            .all(platform, String(chatId), ...params);
    } catch {
        return '';
    }

    const scoreRow = (content) => {
        const low = content.toLowerCase();
        let s = 0;
        for (const k of specificKw) if (low.includes(k)) s += 2;
        for (const k of genericKw) if (low.includes(k)) s += 1;
        return s;
    };

    const scoredItems = items
        .map(i => ({ score: scoreRow(i.content), row: i }))
        .filter(x => x.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    const scoredJournals = journals
        .map(j => ({ score: scoreRow(j.content), row: j }))
        .filter(x => x.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    const parts = [];
    if (scoredItems.length) {
        parts.push('Data tersimpan yang relevan:\n' + scoredItems.map(x => `- ${x.row.content.slice(0, 120)}`).join('\n'));
    }
    if (scoredJournals.length) {
        parts.push('Jurnal lama yang relevan:\n' + scoredJournals.map(x =>
            `- (${x.row.created_at.slice(0, 10)}, mood: ${x.row.mood || '-'}) ${x.row.content.slice(0, 120)}`
        ).join('\n'));
    }
    return parts.join('\n\n');
}
