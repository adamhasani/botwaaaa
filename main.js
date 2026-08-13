/* ╔══════════════════════════════════════════╗
   ║  THE ARCHIVE LITE - VPS EDITION         ║
   ║  Bot WA murni — data dari sync.js       ║
   ╚══════════════════════════════════════════╝ */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import pino from 'pino';
import chalk from 'chalk';
import readline from 'readline';
import qrcode from 'qrcode-terminal';

import {
    makeWASocket,
    proto,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    getContentType,
    Browsers,
    jidNormalizedUser,
    delay
} from '@whiskeysockets/baileys';

import stg from './toolkit/setting.js';
import { logSentMessage } from './toolkit/msgLog.js';
import { loadPlugins, plugins } from './toolkit/loader.js';
import { runScheduler } from './scheduler/deadline_reminder.js';
import { runDailySchedule, sendScheduleOnStartup } from './scheduler/daily_schedule.js';
import { runEdlinkAutoSync, runEdlinkQuickPoll } from './scheduler/edlink_auto_sync.js';
import { runDueRemindersOnce, runMorningBriefingOnce } from './scheduler/simpanan_scheduler.js';
import { handleFreeformMessage } from './toolkit/aiChatHandler.js';
import * as simpananDb from './toolkit/simpananDb.js';
import { parseCommand } from './toolkit/commandParser.js';

const __dirname = global.__dirname;
const sessionDir = path.join(__dirname, 'session');
const dbDir      = path.join(__dirname, 'toolkit/db');

if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
if (!fs.existsSync(dbDir))      fs.mkdirSync(dbDir, { recursive: true });

// ─────────────────────────────────────────────
// HELPER: CEK OWNER
// ─────────────────────────────────────────────
function checkIsOwner(jid) {
    const clean = jid.replace(/[^0-9]/g, '');
    const owner = stg.ownerNumber.replace(/[^0-9]/g, '');
    return clean === owner || clean.endsWith(owner) || owner.endsWith(clean);
}

// ─────────────────────────────────────────────
// HELPER: PARSE MESSAGE
// ─────────────────────────────────────────────
function parseMessage(msg) {
    const type = getContentType(msg.message);
    let text = '';
    if (type === 'conversation') text = msg.message.conversation;
    else if (type === 'extendedTextMessage') text = msg.message.extendedTextMessage.text;
    else if (type === 'imageMessage') text = msg.message.imageMessage?.caption || '';
    else if (type === 'videoMessage') text = msg.message.videoMessage?.caption || '';
    else if (type === 'documentMessage') text = msg.message.documentMessage?.caption || ''; // [FIX] caption dokumen (PDF/DOCX/XLSX) belum kebaca sebelumnya -> command lewat caption dokumen ga pernah kepicu
    else if (type === 'buttonsResponseMessage') text = msg.message.buttonsResponseMessage.selectedButtonId;
    else if (type === 'listResponseMessage') text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
    return { type, text: text.trim() };
}

// ─────────────────────────────────────────────
// HELPER: PARSE COMMAND
// ─────────────────────────────────────────────
// [FIX] Dulu pakai fungsi lokal yang cuma cek 1 prefix (gak ada fallback "/"),
// beda perilaku sama Telegram. Sekarang pakai commandParser.js yang shared,
// biar WA juga terima gaya "/command" konsisten sama Telegram.

// ─────────────────────────────────────────────
// HELPER: SEND WITH LOG
// ─────────────────────────────────────────────
async function sendWithLog(conn, jid, content, options = {}) {
    try {
        const result = await conn.sendMessage(jid, content, options);
        const preview = typeof content.text === 'string'
            ? content.text.substring(0, 50).replace(/\n/g, ' ') + '...'
            : '[media/react]';
        console.log(chalk.green(`[SEND ✓] → ${jid.split('@')[0]} | ${preview}`));
        logSentMessage(result?.key, content, jid);
        return result;
    } catch (e) {
        console.log(chalk.red(`[SEND ✗] → ${jid.split('@')[0]} | GAGAL: ${e.message}`));
        throw e;
    }
}

// ─────────────────────────────────────────────
// STARTUP CHECK
// ─────────────────────────────────────────────
async function runStartupCheck(conn) {
    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan('   STARTUP CHECK'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    // Plugin
    console.log(plugins.size > 0
        ? chalk.green(`[✓] Plugin     : ${plugins.size} plugin aktif`)
        : chalk.red(`[✗] Plugin     : Tidak ada plugin!`));

    // Owner
    console.log(stg.ownerNumber
        ? chalk.green(`[✓] Owner      : ${stg.ownerNumber}`)
        : chalk.red(`[✗] Owner      : OWNER_NUMBER belum diset!`));

    // Target
    console.log(stg.reminderTarget
        ? chalk.green(`[✓] Target     : ${stg.reminderTarget}`)
        : chalk.yellow(`[!] Target     : REMINDER_TARGET kosong`));

    // Token (cek ada ga di .env, ga perlu hit API)
    const token = process.env.EDLINK_TOKEN;
    if (token) {
        const preview = token.substring(0, 8) + '...' + token.substring(token.length - 4);
        console.log(chalk.green(`[✓] Token      : Ada (${preview})`));
    } else {
        console.log(chalk.yellow(`[!] Token      : Belum diset — fitur Edlink nonaktif`));
    }

    // Jadwal DB
    try {
        const weeklyPath = path.join(dbDir, 'weekly_schedule.json');
        if (fs.existsSync(weeklyPath)) {
            const db = JSON.parse(fs.readFileSync(weeklyPath, 'utf-8'));
            const hariAda = db?.data?.filter(d => d.sections?.length > 0).length || 0;
            const fetchedAt = db?.fetchedAt ? new Date(db.fetchedAt).toLocaleDateString('id-ID') : '?';
            console.log(chalk.green(`[✓] Jadwal DB  : Minggu ${db?.weekOf || '?'} — ${hariAda} hari ada kelas (diambil ${fetchedAt})`));
        } else {
            console.log(chalk.yellow(`[!] Jadwal DB  : Belum ada — jalankan sync.js di PC`));
        }
    } catch (e) {
        console.log(chalk.yellow(`[!] Jadwal DB  : Gagal baca — ${e.message}`));
    }

    // Deadlines DB
    try {
        const deadlinesPath = path.join(dbDir, 'deadlines.json');
        if (fs.existsSync(deadlinesPath)) {
            const db = JSON.parse(fs.readFileSync(deadlinesPath, 'utf-8'));
            const count = Object.keys(db).length;
            console.log(chalk.green(`[✓] Deadline DB: ${count} tugas tersimpan`));
        } else {
            console.log(chalk.yellow(`[!] Deadline DB: Belum ada — jalankan sync.js di PC`));
        }
    } catch (e) {
        console.log(chalk.yellow(`[!] Deadline DB: Gagal baca — ${e.message}`));
    }

    // Kirim jadwal hari ini
    console.log(chalk.gray(`[~] Jadwal     : Mengirim jadwal hari ini...`));
    try {
        // Beri waktu socket "settle" dulu — kirim langsung pas connection.open
        // sering timeout karena Baileys belum sepenuhnya siap (apalagi target grup).
        await delay(5000);
        await sendScheduleOnStartup(conn);
        console.log(chalk.green(`[✓] Jadwal     : Jadwal hari ini terkirim`));
    } catch (e) {
        console.log(chalk.yellow(`[!] Jadwal     : Gagal saat startup — ${e.message} (akan dicoba lagi tiap menit)`));
    }

    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// ─────────────────────────────────────────────
// SYNC SERVER (terima data dari sync.js di PC)
// ─────────────────────────────────────────────
function startSyncServer() {
    const port   = process.env.SYNC_PORT || 2667;
    const secret = process.env.SYNC_SECRET || '';

    http.createServer((req, res) => {
        if (req.method !== 'POST') {
            res.writeHead(405); res.end('Method Not Allowed'); return;
        }

        if (secret && req.headers['x-sync-secret'] !== secret) {
            res.writeHead(401); res.end('Unauthorized'); return;
        }

        // GET — ambil data DB dari VPS
        if (req.method === 'GET') {
            const type = req.url?.replace('/', '') || '';
            const files = { deadlines: 'deadlines.json', weekly_schedule: 'weekly_schedule.json' };
            if (!files[type]) { res.writeHead(400); res.end('Unknown type'); return; }
            const filePath = path.join(dbDir, files[type]);
            if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{}'); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(filePath, 'utf-8'));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { type, data } = JSON.parse(body);
                const files = {
                    deadlines:       'deadlines.json',
                    weekly_schedule: 'weekly_schedule.json'
                };

                if (!files[type]) {
                    res.writeHead(400); res.end(JSON.stringify({ ok: false, message: 'Unknown type' })); return;
                }

                const filePath = path.join(dbDir, files[type]);

                // Merge deadlines — jaga field reminded_* yang udah true
                if (type === 'deadlines' && fs.existsSync(filePath)) {
                    try {
                        const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                        for (const [key, val] of Object.entries(data)) {
                            if (existing[key]) {
                                // Pertahankan field reminded dari data VPS
                                data[key].reminded_h7   = existing[key].reminded_h7   || val.reminded_h7;
                                data[key].reminded_h3   = existing[key].reminded_h3   || val.reminded_h3;
                                data[key].reminded_h1   = existing[key].reminded_h1   || val.reminded_h1;
                                data[key].reminded_due  = existing[key].reminded_due  || val.reminded_due;
                            }
                        }
                    } catch {}
                }

                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                console.log(chalk.green(`[SYNC] ✅ ${files[type]} diperbarui dari PC`));
                res.writeHead(200); res.end(JSON.stringify({ ok: true }));

            } catch (e) {
                console.error(chalk.red(`[SYNC] ❌ ${e.message}`));
                res.writeHead(500); res.end(JSON.stringify({ ok: false, message: e.message }));
            }
        });
    }).on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(chalk.yellow(`[SYNC] Port ${port} sudah dipakai, sync server skip.`));
        } else {
            console.error(chalk.red(`[SYNC] Error: ${e.message}`));
        }
    }).listen(port, () => {
        console.log(chalk.cyan(`[SYNC] 🔌 Sync server aktif di port ${port}`));
    });
}

// ─────────────────────────────────────────────
// MAIN BOT
// ─────────────────────────────────────────────
export default async function main(usePairing = false, pilihMetode = null) {
    await loadPlugins(__dirname);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version }          = await fetchLatestBaileysVersion();

    // ── PILIH METODE PAIRING (sebelum socket dibuat) ──

    if (!state.creds.registered && pilihMetode === null) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        pilihMetode = await new Promise((resolve) => {
            console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(chalk.cyan('   PILIH METODE LOGIN'));
            console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(chalk.yellow('  1. Pairing Code'));
            console.log(chalk.yellow('  2. QR Code'));
            console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            rl.question(chalk.white('Pilih (1/2): '), (ans) => { rl.close(); resolve(ans.trim()); });
        });
    }

    if (!pilihMetode) pilihMetode = '1';
    const conn = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari'),
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        // Wajib di Baileys v7+ — dipakai untuk retry decrypt pesan yang di-reply/quote.
        // Bot ini tidak simpan history pesan lama, jadi return undefined (fallback aman).
        getMessage: async () => undefined,
    });

    conn.ev.on('creds.update', saveCreds);

    // ── QR listener (aktif sebelum apapun kalau pilih 2) ──
    if (pilihMetode === '2') {
        conn.ev.on('connection.update', ({ qr }) => {
            if (qr) {
                console.log(chalk.cyan('\n📷 QR CODE — scan dengan WhatsApp:'));
                qrcode.generate(qr, { small: true });
            }
        });
    }

    if (!conn.authState.creds.registered) {
        if (pilihMetode === '1') {
            // ── PAIRING CODE ──
            const num = (process.env.BOT_NUMBER || '').replace(/\D/g, '');
            if (!num) {
                console.log(chalk.red('[PAIRING] ❌ BOT_NUMBER belum diset di .env!'));
                process.exit(1);
            }
            console.log(chalk.cyan(`[PAIRING] 📱 Pairing otomatis ke nomor: ${num}`));

        // Retry pairing code tanpa crash
        let code = null;
        let retryCount = 0;
        while (!code) {
            try {
                retryCount++;
                console.log(chalk.gray(`[PAIRING] Meminta pairing code... (percobaan ${retryCount})`));
                await delay(2000);
                code = await conn.requestPairingCode(num);
            } catch (e) {
                console.log(chalk.yellow(`[PAIRING] Gagal: ${e.message} — coba lagi dalam 5 detik...`));
                await delay(5000);
                // Reconnect kalau koneksi drop
                if (e.message?.includes('Connection Closed') || e.message?.includes('connection')) {
                    console.log(chalk.yellow('[PAIRING] Reconnect dan coba ulang...'));
                    return main(usePairing, pilihMetode); // restart fungsi, bukan process
                }
            }
        }

            console.log(chalk.green(`\n🔑 PAIRING CODE: ${chalk.bold(code)}\n`));
            console.log(chalk.gray('WhatsApp > Linked Devices > Link a Device > Link with phone number'));
        }
    }

    // ── CONNECTION UPDATE ──
    conn.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            global.__waConn = conn; // dipakai scheduler/telegram.js buat kirim reminder cross-platform
            console.log(chalk.green('\n✅ Bot terhubung ke WhatsApp!\n'));
            console.log(chalk.cyan('📦 Plugin loaded :'), plugins.size);
            console.log(chalk.cyan('⚙️  Prefix        :'), stg.prefix);
            console.log(chalk.cyan('👤 Owner         :'), stg.ownerNumber || chalk.red('BELUM DISET!'));
            console.log(chalk.cyan('🕐 Timezone      :'), stg.timezone);

            // Startup check
            await runStartupCheck(conn);

            // Sync server
            startSyncServer();

            // Scheduler tiap menit
            setInterval(() => {
                runScheduler(conn);
                runDailySchedule(conn);
                runEdlinkAutoSync(conn);
                runDueRemindersOnce({ telegramConn: global.__tgConn || null, waConn: conn });
                runMorningBriefingOnce({ telegramConn: global.__tgConn || null, waConn: conn });
            }, 60 * 1000);

            // Poll materi, pengumuman & quest tiap 5 menit
            runEdlinkQuickPoll(conn); // langsung cek sekali saat connect
            setInterval(() => {
                runEdlinkQuickPoll(conn);
            }, 5 * 60 * 1000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log(chalk.yellow(`[RECONNECT] code: ${code}, reconnecting...`));
                setTimeout(() => main(usePairing, pilihMetode), 5000);
            } else {
                console.log(chalk.red('[LOGOUT] Hapus folder session/ dan jalankan ulang.'));
                process.exit(0);
            }
        }
    });

    // ── MESSAGE HANDLER ──
    // Handler retry decrypt — fix "Decrypted message with closed session"
    conn.ev.on('messages.retry', ({ key }) => {
        console.log(chalk.gray('[RETRY] Decrypt retry untuk:', key.id));
    });

    conn.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;

                const isGroup  = msg.key.remoteJid?.endsWith('@g.us');
                const chatId   = msg.key.remoteJid;
                const senderId = isGroup ? msg.key.participant || msg.key.remoteJid : msg.key.remoteJid;
                const senderJid = jidNormalizedUser(senderId || '');
                const isOwner  = checkIsOwner(senderJid);

                const { text } = parseMessage(msg);
                if (!text) continue;

                const parsed = parseCommand(text, stg.prefix, '/');

                // Bukan command (ga diawali prefix) -> lempar ke AI chat bebas (kayak bot Telegram)
                // Cuma di chat pribadi biar ga spam auto-reply di grup.
                if (!parsed) {
                    if (!isGroup) {
                        simpananDb.registerUser('wa', chatId);
                        await handleFreeformMessage(conn, msg, { platform: 'wa', chatId, senderId: senderJid, text });
                    }
                    continue;
                }

                const { commandText: rawCommandText, args, usedPrefix } = parsed;

                // [FITUR] .menu vs /menu isinya beda, ditentukan PREFIX yang dipakai,
                // bukan platform. ".menu" (atau prefix WA) -> menu Archive.
                // "/menu" -> menu Flora, walau diketik dari WA.
                let commandText = rawCommandText;
                if (rawCommandText === 'menu' && usedPrefix === '/' && usedPrefix !== stg.prefix) {
                    commandText = 'menuflora';
                }

                const plugin = plugins.get(commandText);
                if (!plugin) continue;

                console.log(chalk.magenta(`[CMD] ${isOwner ? '👑' : '👤'} ${senderJid.split('@')[0]} → ${usedPrefix}${rawCommandText}`));

                if (plugin.owner && !isOwner) {
                    await sendWithLog(conn, chatId, { text: '❌ Command ini khusus owner!' }, { quoted: msg });
                    continue;
                }

                await plugin.run(conn, msg, {
                    chatInfo: { chatId, senderId: senderJid, isGroup, isOwner },
                    args,
                    prefix: stg.prefix,
                    platform: 'whatsapp',
                    commandText,
                    command: commandText,
                    text,
                });

            } catch (e) {
                console.error(chalk.red(`[ERROR] ${e.message}`));
            }
        }
    });
}