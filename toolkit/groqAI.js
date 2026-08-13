/* ╔══════════════════════════════════════════╗
   ║  GROQ AI — chat, intent classify, transcribe ║
   ║  Port dari bot.py                            ║
   ╚══════════════════════════════════════════╝ */
import Groq from 'groq-sdk';
import stg from './setting.js';

let client = null;
function getClient() {
    if (!stg.groqApiKey) throw new Error('GROQ_API_KEY belum diset di .env');
    if (!client) client = new Groq({ apiKey: stg.groqApiKey });
    return client;
}

// ── KATA KUNCI INTENT (persis dari bot.py) ──
export const KEYWORDS = {
    DB_CARI: ['database', 'yang pernah aku save', 'yang aku save', 'yang udah disimpan', 'aku simpen apa', 'aku save apa', 'list simpenan', 'daftar simpenan', 'isi database', 'data tersimpan', 'apa aja', 'apa saja', 'ada apa aja'],
    RESEARCH: ['search', 'carikan', 'cariin', 'riset', 'cari tahu', 'browsing', 'tren', 'harga', 'analisis', 'rekomendasi', 'link youtube', 'cari link'],
    SIMPAN: ['simpan ini', 'simpen ini', 'catat ini', 'save ini', 'tolong simpan'],
    REMINDER: ['ingetin', 'ingatkan', 'reminder', 'jangan lupa ingetin'],
    CUACA: ['cuaca', 'info cuaca', 'hujan ga', 'prakiraan cuaca', 'cuaca hari ini'],
    JOURNAL: ['jurnal', 'journal', 'catatan harian', 'hari ini aku ngerasa', 'mood aku', 'diary', 'curhat dikit'],
};

// [FITUR BARU] kata kunci buat deteksi permintaan scrape URL
export const SCRAPE_KEYWORDS = ['scrape', 'ambil isi', 'baca halaman', 'isi halaman', 'buka link ini', 'rangkum halaman', 'rangkum link'];

export function classifyIntentKeywords(text) {
    const t = text.toLowerCase();

    // [FITUR BARU] SCRAPE: kalau ada URL + kata kunci scrape eksplisit -> langsung SCRAPE,
    // dicek duluan sebelum keyword lain biar ga ketangkep RESEARCH/SIMPAN.
    const hasUrl = /https?:\/\/\S+/.test(text);
    if (hasUrl && SCRAPE_KEYWORDS.some(k => t.includes(k))) return 'SCRAPE';

    for (const [intent, kws] of Object.entries(KEYWORDS)) {
        if (kws.some(k => t.includes(k))) return intent;
    }
    return null;
}

// [FIX] Prompt classifier fallback diperjelas: pertanyaan pengetahuan umum yang
// tidak butuh data real-time sekarang jatuh ke CHAT, bukan RESEARCH. Ini benerin
// bug "bot riset sendiri padahal user cuma nanya hal umum / kasih tanggapan biasa".
const FEWSHOT_INTENT = `Kamu classifier intent buat asisten personal bernama Flora. Balas HANYA dengan 1 kata kategori dari daftar ini: SIMPAN, DB_CARI, REMINDER, CUACA, RESEARCH, SCRAPE, JOURNAL, CHAT.

Definisi tiap kategori:
- SIMPAN: user minta simpan sesuatu ke database bot.
- DB_CARI: user nanya isi data yang PERNAH disimpan di bot (database lokal).
- RESEARCH: user butuh info yang SPESIFIK, TERKINI, atau FAKTUAL dari internet (harga sekarang,
  berita terbaru, tren saat ini, rekomendasi produk spesifik). BUKAN untuk pertanyaan pengetahuan
  umum yang bisa dijawab langsung tanpa perlu data real-time.
- SCRAPE: user kasih URL spesifik dan minta isi/rangkuman dari halaman itu.
- REMINDER: user minta diingetin sesuatu di waktu tertentu.
- CUACA: nanya cuaca/prakiraan cuaca.
- JOURNAL: lagi curhat/cerita perasaan/mood harian, bukan sekadar nanya sesuatu.
- CHAT: ngobrol biasa, TERMASUK pertanyaan pengetahuan umum/opini/penjelasan konsep yang tidak
  butuh data internet real-time (misal "kenapa X begini", "jelasin soal Y", tanggapan santai
  atas jawaban sebelumnya, opini, curhat ringan, obrolan lanjutan).

ATURAN PENTING: Kalau ragu antara RESEARCH dan CHAT, dan pertanyaannya adalah pertanyaan
pengetahuan umum / "kenapa" / "jelasin" / opini yang bisa dijawab dari pengetahuan umum AI
TANPA perlu data terkini -> pilih CHAT, bukan RESEARCH.

Contoh:
"simpen link ini ya" -> SIMPAN
"aku pernah save resep apa aja ya?" -> DB_CARI
"cariin promo hp murah bulan ini" -> RESEARCH
"kenapa harga bawang mahal ya sekarang" -> RESEARCH
"kenapa sains data sedikit peminatnya?" -> CHAT
"jelasin dong bedanya AI sama machine learning" -> CHAT
"rangkum isi artikel ini: https://contoh.com/artikel" -> SCRAPE
"ingetin aku minum obat jam 8 malem" -> REMINDER
"cuaca jakarta gimana besok" -> CUACA
"hari ini capek banget rasanya pengen nangis" -> JOURNAL
"eh tau ga tadi aku ketemu temen lama" -> CHAT

Pesan user: "{msg}"`;

const VALID_INTENTS = ['SIMPAN', 'DB_CARI', 'REMINDER', 'CUACA', 'RESEARCH', 'SCRAPE', 'JOURNAL', 'CHAT'];

// Fallback ke Groq buat klasifikasi kalau keyword ga ketemu
export async function classifyIntentAI(text) {
    try {
        const g = getClient();
        const prompt = FEWSHOT_INTENT.replace('{msg}', text);
        const completion = await g.chat.completions.create({
            model: stg.groqTextModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
        });
        const out = completion.choices[0]?.message?.content?.trim().toUpperCase() || 'CHAT';
        const found = VALID_INTENTS.find(v => out.includes(v));
        return found || 'CHAT';
    } catch {
        return 'CHAT';
    }
}

export async function classifyIntent(text) {
    // [FIX] pesan pendek tanpa URL -> langsung CHAT, hemat 1 API call
    // (persis logika di bot.py: len(words) <= 4 -> CHAT)
    const hasUrl = /https?:\/\/\S+/.test(text);
    const wordCount = text.trim().split(/\s+/).length;

    const kw = classifyIntentKeywords(text);
    if (kw) return kw;

    if (wordCount <= 4 && !hasUrl) return 'CHAT';

    return classifyIntentAI(text);
}

// ── CHAT COMPLETION UMUM ──
export async function askGroq(messages, maxTokens = 700) {
    const g = getClient();
    const completion = await g.chat.completions.create({
        model: stg.groqTextModel,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content?.trim() || '';
}

export async function askGroqSimple(prompt, maxTokens = 500) {
    return askGroq([{ role: 'user', content: prompt }], maxTokens);
}

// [FITUR BARU] LAPORAN JURNAL MINGGUAN — port dari generate_journal_report() bot.py
export async function generateJournalReport(entries, days = 7) {
    if (!entries.length) return null;

    const entriesText = entries.map(e => `- (${e.created_at.slice(0, 16)}, mood: ${e.mood || '-'}) ${e.content}`).join('\n');
    const moodList = entries.map(e => e.mood).filter(Boolean);
    const moodSummary = moodList.length ? moodList.join(', ') : 'tidak tercatat';

    const prompt = `Berikut entri jurnal seorang user selama ${days} hari terakhir:

${entriesText}

Daftar mood mentah: ${moodSummary}

Buatkan laporan singkat (maks 250 kata) dengan format:
1. Ringkasan umum suasana hati minggu ini (1-2 kalimat, nada suportif bukan menghakimi)
2. Topik/hal yang paling sering muncul (bullet, maks 3)
3. Satu observasi lembut kalau ada pola yang berulang (opsional, hanya kalau memang terlihat jelas dari data, jangan mengada-ada)

Bahasa santai, hangat, seperti teman ngobrol bernama Flora. Jangan pakai istilah medis/diagnosis.`;

    return askGroqSimple(prompt, 500);
}

// ── TRANSCRIBE VOICE NOTE (Whisper via Groq) ──
export async function transcribeAudio(buffer, filename = 'voice.ogg') {
    const g = getClient();
    const file = await Groq.toFile ? Groq.toFile(buffer, filename) : buffer;
    const transcript = await g.audio.transcriptions.create({
        file,
        model: stg.groqSttModel,
        language: 'id',
    });
    return transcript.text?.trim() || '';
}
