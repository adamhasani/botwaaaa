/* ╔══════════════════════════════════════════════════════╗
   ║  FLORA AGENT — God Mode, Hermes Mode, Agentic Planner  ║
   ║  Port dari bot.py (execute_god_agent, execute_hermes_  ║
   ║  agent, plan_and_execute_agentic_task) -> Node.js.     ║
   ║  Dipakai bareng WA & Telegram lewat plugin masing2.    ║
   ╚══════════════════════════════════════════════════════╝ */
import axios from 'axios';
import os from 'os';
import stg from './setting.js';
import { askGroq, askGroqSimple } from './groqAI.js';
import { performWebSearch } from './webSearch.js';
import * as db from './simpananDb.js';

// ─────────────────────────────────────────────
// STATE: mode persistent per chat (God / Hermes)
// key: `${platform}:${chatId}` -> 'god' | 'hermes' | null
// ─────────────────────────────────────────────
const persistentMode = new Map();

export function setMode(platform, chatId, mode) {
    const key = `${platform}:${chatId}`;
    if (!mode) persistentMode.delete(key);
    else persistentMode.set(key, mode);
}
export function getMode(platform, chatId) {
    return persistentMode.get(`${platform}:${chatId}`) || null;
}

// ─────────────────────────────────────────────
// GOD MODE — kontrol laptop Windows lewat Cloudflare tunnel
// ─────────────────────────────────────────────
function parseJsonFromGroq(raw) {
    try {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

export async function executeGodAgent(taskPrompt) {
    if (!stg.laptopAgentUrl) {
        return { message: '⚠️ LAPTOP_AGENT_URL belum diset di .env — God Mode tidak bisa dipakai.', imageB64: null };
    }

    const systemRouter = `Kamu adalah Router GOD MODE. Tugas: Kontrol Laptop/PC Windows User.
Pilih action yang tepat lalu kembalikan JSON MURNI: {"action": "...", "target": "..."}
Contoh action:
- Cari file: {"action": "search_file", "target": "pdf/docx/jpg/nama_file"}
- Cek sistem laptop: {"action": "system_info"}
- Screenshot: {"action": "screenshot"}
- Matikan proses: {"action": "kill_task", "target": "chrome"}
- Kunci layar: {"action": "lock_pc"}
- Buka web/app: {"action": "open_url", "target": "link/nama"}
JAWAB HANYA JSON, TANPA TEKS LAIN.`;

    let payload;
    try {
        const raw = await askGroq([
            { role: 'system', content: systemRouter },
            { role: 'user', content: taskPrompt },
        ], 300);
        payload = parseJsonFromGroq(raw);
        if (!payload?.action) payload = { action: 'search_file', target: 'pdf' };
    } catch (e) {
        return { message: `⚠️ Gagal bikin rencana action: ${e.message}`, imageB64: null };
    }

    try {
        const res = await axios.post(stg.laptopAgentUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        const data = res.data;
        return {
            message: data?.message || data?.output || '⚡ Akses ke laptop berhasil!',
            imageB64: data?.image_b64 || null,
        };
    } catch (e) {
        if (e.response) {
            return { message: `⚠️ Gagal akses Laptop Agent: HTTP ${e.response.status}`, imageB64: null };
        }
        return { message: `⚠️ Laptop Agent sedang offline / terputus: ${e.message}`, imageB64: null };
    }
}

// ─────────────────────────────────────────────
// HERMES MODE — VPS info & web research
// ─────────────────────────────────────────────
export function getVpsSpecsRaw() {
    const cpus = os.cpus();
    const totalMemGB = (os.totalmem() / 1024 ** 3).toFixed(2);
    const freeMemGB = (os.freemem() / 1024 ** 3).toFixed(2);
    const usedMemGB = (totalMemGB - freeMemGB).toFixed(2);
    const uptimeSec = os.uptime();
    const uptimeStr = `${Math.floor(uptimeSec / 3600)}j ${Math.floor((uptimeSec % 3600) / 60)}m`;
    const load = os.loadavg();

    return {
        os: `${os.type()} ${os.release()}`,
        uptime: uptimeStr,
        cpu: cpus[0]?.model || 'unknown',
        cores: cpus.length,
        loadAvg: load.map(n => n.toFixed(2)).join(', '),
        ramUsed: usedMemGB,
        ramTotal: totalMemGB,
        ramFree: freeMemGB,
        hostname: os.hostname(),
    };
}

/** @deprecated pakai getVpsSpecsRaw() untuk data terstruktur — ini cuma dipertahankan untuk kompatibilitas lama. */
export function getVpsSpecsInfo() {
    const s = getVpsSpecsRaw();
    return `🖥️ *HERMES SYSTEM REPORT - VPS SPECS REAL-TIME*
📌 *Sistem Operasi*: ${s.os}
⏰ *Uptime VPS*: ${s.uptime}
🧠 *CPU*: ${s.cpu} (${s.cores} core)
📊 *Load Average*: ${s.loadAvg}
💾 *RAM*: ${s.ramUsed} GB / ${s.ramTotal} GB terpakai (${s.ramFree} GB bebas)
🏠 *Hostname*: ${s.hostname}`;
}

// Object hasil executeHermesAgent sekarang terstruktur:
// { intent: 'vps_info'|'web_research', narrative: string, table?: string[][], searchQuery?: string }
// Plugin (hermes.js) pilih cara render (tabel vs teks) berdasarkan field ini,
// tanpa perlu parsing ulang string.
export async function executeHermesAgent(taskPrompt) {
    const systemRouter = `Kamu adalah Router HERMES AI. Analisis perintah user.
Pilihan intent HANYA 2:
1. "vps_info": Jika user ingin mengecek spesifikasi server/vps (ram, cpu, disk vps).
2. "web_research": Jika user ingin riset info internet, cari link, tren, dll.

KEMBALIKAN JSON MURNI DENGAN STRUKTUR:
{"intent": "...", "search_query": "..."}

PENTING: Isi "search_query" dengan KATA KUNCI GOOGLE YANG OPTIMAL. Hilangkan kata-kata perintah seperti 'carikan', 'tolong', dll.
JAWAB HANYA JSON, TANPA TEKS LAIN.`;

    try {
        const raw = await askGroq([
            { role: 'system', content: systemRouter },
            { role: 'user', content: taskPrompt },
        ], 300);
        const parsed = parseJsonFromGroq(raw) || {};
        const intent = parsed.intent || 'web_research';
        const searchQuery = parsed.search_query || taskPrompt;

        if (intent === 'vps_info') {
            const s = getVpsSpecsRaw();
            const narrative = await askGroqSimple(`Buat laporan teknis VPS singkat (2-3 kalimat) dari data berikut:\n${JSON.stringify(s)}\nUser: ${taskPrompt}`, 400);
            const table = [
                ['Metrik', 'Nilai'],
                ['OS', s.os],
                ['Uptime', s.uptime],
                ['CPU', `${s.cpu} (${s.cores} core)`],
                ['Load avg', s.loadAvg],
                ['RAM', `${s.ramUsed} / ${s.ramTotal} GB`],
                ['Hostname', s.hostname],
            ];
            return { intent: 'vps_info', narrative, table };
        }

        const searchResults = await performWebSearch(searchQuery);
        const narrative = await askGroqSimple(
            `Buat laporan riset rapi dari hasil web pencarian keyword '${searchQuery}':\n${searchResults}\nUser: ${taskPrompt}`,
            600
        );
        return { intent: 'web_research', narrative, searchQuery };
    } catch (e) {
        return { intent: 'error', narrative: `⚠️ [HERMES AGENT ERROR]: ${e.message}` };
    }
}

// ─────────────────────────────────────────────
// AGENTIC PLANNER — pecah 1 perintah jadi beberapa langkah
// ─────────────────────────────────────────────
function autoTag(content) {
    const lower = content.toLowerCase();
    if (/https?:\/\//.test(content)) return 'link';
    if (/tugas|deadline|kumpul/.test(lower)) return 'tugas';
    if (/jadwal|kelas/.test(lower)) return 'jadwal';
    return 'catatan';
}

function parseDurationToMs(text) {
    const m = text.match(/(\d+)\s*(detik|menit|jam|hari)/i);
    if (!m) return { ms: 60 * 60 * 1000, recurring: 'none' }; // default 1 jam
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult = { detik: 1000, menit: 60000, jam: 3600000, hari: 86400000 }[unit];
    return { ms: n * mult, recurring: /tiap hari|setiap hari|harian/i.test(text) ? 'daily' : 'none' };
}

export async function planAndExecuteAgenticTask(text, platform, chatId) {
    const systemPlanner = `Kamu adalah PERENCANA TUGAS. Pecah perintah user jadi maksimal 4 langkah berurutan.
Setiap langkah punya "action" salah satu dari:
- "research": riset web. field "query": kata kunci pencarian.
- "save": simpan ke database. field "content": isi yang disimpan (boleh pakai placeholder {research_result} kalau mau isi hasil riset sebelumnya).
- "remind": bikin reminder. field "text": isi reminder, field "duration": contoh '1 jam', '30 menit'.

KEMBALIKAN JSON MURNI: {"steps": [{"action": "...", ...}]}. Maksimal 4 langkah. JAWAB HANYA JSON.`;

    let plan;
    try {
        const raw = await askGroq([
            { role: 'system', content: systemPlanner },
            { role: 'user', content: text },
        ], 500);
        const parsed = parseJsonFromGroq(raw);
        plan = parsed?.steps || [];
    } catch (e) {
        return { ok: false, error: `Gagal bikin rencana langkah: ${e.message}` };
    }

    if (!plan.length) {
        return { ok: false, error: 'Nggak berhasil mecah ini jadi langkah-langkah, coba diperjelas lagi ya.' };
    }

    // steps: array terstruktur, tiap item {icon, label, detail, status: 'ok'|'error'}
    // — plugin (agentic.js) render ini jadi tabel bx.rich/AIRich, bukan parsing string.
    const steps = [];
    let lastResearchResult = '';

    for (const step of plan.slice(0, 4)) {
        const action = step.action;
        try {
            if (action === 'research') {
                const q = step.query || text;
                const raw = await performWebSearch(q);
                lastResearchResult = await askGroqSimple(`Ringkas hasil riset ini jadi poin-poin singkat:\n${raw}`, 400);
                steps.push({ icon: '🔍', label: `Riset: ${q}`, detail: lastResearchResult, status: 'ok' });
            } else if (action === 'save') {
                const content = (step.content || lastResearchResult || text).replace('{research_result}', lastResearchResult);
                const tag = autoTag(content);
                const mirip = db.checkSimilarItem(content);
                db.saveItem(content, /https?:\/\//.test(content) ? 'link' : 'text', tag);
                const extra = mirip ? `Mirip simpanan lama: "${mirip.content.slice(0, 60)}..."` : `Tersimpan sebagai ${tag}`;
                steps.push({ icon: '💾', label: `Disimpan [${tag.toUpperCase()}]`, detail: extra, status: 'ok' });
            } else if (action === 'remind') {
                const rText = step.text || text;
                const { ms, recurring } = parseDurationToMs(step.duration || '1 jam');
                const remindAt = new Date(Date.now() + ms).toISOString();
                db.saveReminder(platform, chatId, rText, remindAt, recurring);
                steps.push({ icon: '⏰', label: 'Reminder dibuat', detail: `${rText} (${step.duration || '1 jam'} lagi)`, status: 'ok' });
            } else {
                steps.push({ icon: '⚠️', label: `Langkah '${action}' tidak dikenali`, detail: 'Dilewati', status: 'error' });
            }
        } catch (e) {
            steps.push({ icon: '⚠️', label: `Langkah '${action}' gagal`, detail: e.message, status: 'error' });
        }
    }

    return { ok: true, steps, plan, originalText: text };
}
