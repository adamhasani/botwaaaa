/* ╔══════════════════════════════════════════════════════╗
   ║  AI CHAT HANDLER — dipakai bareng WA & Telegram         ║
   ║  Port ringkas dari process_message() di bot.py.         ║
   ║  Dipanggil saat pesan masuk BUKAN command (tanpa prefix) ║
   ╚══════════════════════════════════════════════════════╝ */
import stg from './setting.js';
import * as db from './simpananDb.js';
import { classifyIntent, askGroq, askGroqSimple } from './groqAI.js';
import { performWebSearch } from './webSearch.js';
import { getInfoCuaca } from './weather.js';
import { scrapePageContent, extractUrl } from './scrape.js';
import { getRelevantContext } from './contextRecall.js';
import { getMode } from './floraAgent.js';
import godPlugin from '../plugins/flora/god.js';
import hermesPlugin from '../plugins/flora/hermes.js';
import chalk from 'chalk';

function parseSimpleDuration(text) {
    // "5 menit", "2 jam", "1 hari" -> ms
    const m = text.match(/(\d+)\s*(menit|jam|hari|detik)/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult = { detik: 1000, menit: 60000, jam: 3600000, hari: 86400000 }[unit];
    return n * mult;
}

export async function handleFreeformMessage(conn, msg, { platform, chatId, senderId, text }) {
    // [FITUR] Mode persistent God/Hermes — kalau chat lagi "masuk mode" ini,
    // pesan bebas (tanpa prefix) langsung dianggap perintah buat mode itu,
    // BUKAN diproses sebagai chat AI biasa. Keluar mode lewat .menu.
    const activeMode = getMode(platform, chatId);
    if (activeMode === 'god') {
        return godPlugin.runPersistent(conn, msg, { chatId, text });
    }
    if (activeMode === 'hermes') {
        return hermesPlugin.runPersistent(conn, msg, { chatId, text });
    }

    if (!stg.groqApiKey) {
        // Groq belum dikonfigurasi — diam aja, jangan spam error tiap chat biasa
        return;
    }

    db.registerUser(platform, chatId);
    db.saveChat(platform, chatId, 'user', text);

    let intent = 'CHAT';
    try {
        intent = await classifyIntent(text);
    } catch (e) {
        console.error(chalk.red(`[AI] classify gagal: ${e.message}`));
    }

    let reply = '';

    try {
        switch (intent) {
            case 'DB_CARI': {
                const items = db.getAllItems().slice(0, 15);
                if (!items.length) { reply = '📭 Belum ada apa-apa yang tersimpan di database.'; break; }
                reply = '🗂️ *Isi database kamu (15 terbaru):*\n\n' + items.map(i => `• [${i.type}] ${i.content}`).join('\n');
                break;
            }
            case 'RESEARCH': {
                const searchResult = await performWebSearch(text);
                reply = await askGroq([
                    { role: 'system', content: 'Kamu asisten yang merangkum hasil pencarian web jadi jawaban singkat, jelas, dan pakai bahasa santai Indonesia.' },
                    { role: 'user', content: `Pertanyaan: ${text}\n\nHasil pencarian:\n${searchResult}\n\nRangkum jadi jawaban yang enak dibaca.` },
                ]);
                break;
            }
            case 'SIMPAN': {
                const dup = db.checkSimilarItem(text);
                if (dup) { reply = `⚠️ Sepertinya udah pernah disimpan sebelumnya:\n"${dup.content}"`; break; }
                // [FITUR BARU] related items — item lama yang temanya nyambung (bukan duplikat)
                const related = db.getRelatedItems(text, text);
                const type = /https?:\/\//.test(text) ? 'link' : 'catatan';
                db.saveItem(text, type);
                reply = '✅ Oke, sudah aku simpan!';
                if (related.length) {
                    reply += '\n\n🔗 Btw ini terkait sama simpenan lama kamu:\n'
                        + related.map(r => `- ${r.content.slice(0, 70)}...`).join('\n');
                }
                break;
            }
            case 'SCRAPE': {
                const url = extractUrl(text);
                if (!url) { reply = '🔗 Kirim URL yang mau di-scrape ya.'; break; }
                const scraped = await scrapePageContent(url);
                if (scraped.error) { reply = `⚠️ ${scraped.error}`; break; }
                const ringkasan = await askGroqSimple(
                    `Ringkas isi halaman '${scraped.title}' berikut jadi poin-poin penting:\n${scraped.text}\nPermintaan user: ${text}`,
                    500
                );
                reply = `📄 *${scraped.title}*\n\n${ringkasan}`;
                break;
            }
            case 'REMINDER': {
                const ms = parseSimpleDuration(text);
                if (!ms) {
                    reply = '⏰ Mau diingetin kapan? Contoh: "ingetin aku minum obat 30 menit lagi"';
                    break;
                }
                const remindAt = new Date(Date.now() + ms).toISOString();
                db.saveReminder(platform, chatId, text, remindAt);
                reply = `⏰ Siap, aku ingetin nanti ya!`;
                break;
            }
            case 'CUACA': {
                reply = await getInfoCuaca();
                break;
            }
            case 'JOURNAL': {
                db.saveJournal(platform, chatId, text);
                reply = '📔 Dicatat di jurnal harian kamu. Makasih udah cerita.';
                break;
            }
            default: {
                const history = db.getChatHistory(platform, chatId, 8);
                // [FITUR/FIX] Smart Context Recall v2 — narik data lama yang RELEVAN
                // (dengan scoring, bukan sekadar keyword match longgar) supaya bot
                // tidak "nyambung-nyambungin" konteks yang sebenarnya tidak nyambung.
                const contextSnippet = getRelevantContext(platform, chatId, text);
                let systemContent = 'Kamu adalah asisten AI pribadi yang ramah, santai, dan pakai Bahasa Indonesia. Jawab singkat dan jelas.';
                if (contextSnippet) {
                    systemContent += `\n\nKonteks tambahan dari data/histori lama user:\n${contextSnippet}\n\n`
                        + 'PENTING: Konteks di atas HANYA referensi opsional. Kalau tidak nyambung '
                        + 'sama sekali dengan pesan user saat ini, ABAIKAN TOTAL — jangan dipaksakan '
                        + 'jadi analogi atau dikait-kaitkan.';
                }
                const messages = [
                    { role: 'system', content: systemContent },
                    ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: 'user', content: text },
                ];
                reply = await askGroq(messages);
            }
        }
    } catch (e) {
        console.error(chalk.red(`[AI] error: ${e.message}`));
        reply = '⚠️ Ada error pas mikir jawabannya, coba lagi ya.';
    }

    if (reply) {
        db.saveChat(platform, chatId, 'assistant', reply);
        await conn.sendMessage(chatId, { text: reply }, { quoted: msg });
    }
}
