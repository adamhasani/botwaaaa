/* ╔══════════════════════════════════════════╗
   ║  THE ARCHIVE LITE - VPS EDITION         ║
   ║  Bot WA murni — data dari sync.js       ║
   ║  [MIGRASI] Sekarang pakai @isaxn/bailyes  ║
   ║  buat koneksi (reconnect stabil, tombol   ║
   ║  native bx.button/bx.list). Command       ║
   ║  routing & 33 plugin lama TETAP dipakai   ║
   ║  apa adanya lewat bot.on('messages.upsert')║
   ║  — cuma socket-nya yang berubah sumbernya. ║
   ╚══════════════════════════════════════════╝ */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import chalk from 'chalk';

import { Bailyes } from '@isaxn/bailyes';
// [CATATAN TESTING] Paket ini didesain jalan lewat require() (CJS) menurut
// README-nya. Project kita "type": "module" (ESM murni) — kalau baris import
// di atas gagal resolve pas dijalankan ("Bailyes is not a function" atau
// "does not provide an export named 'Bailyes'"), ganti jadi:
//   import bailyesPkg from '@isaxn/bailyes';
//   const { Bailyes } = bailyesPkg;
// (Node ESM default-import dari modul CJS, lalu destructure manual.)

// getContentType & jidNormalizedUser tetap dari paket "baileys" (nama baru,
// bukan "@whiskeysockets/baileys") — ini dependency yang dimuat @isaxn/bailyes
// di dalamnya (lihat README-nya), jadi otomatis ke-install, gak perlu ditambah manual.
import { getContentType, jidNormalizedUser } from 'baileys';

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
import { getContactName } from './toolkit/waStore.js';

const __dirname = global.__dirname;
const sessionDir = path.join(__dirname, 'auth'); // [FIX] @isaxn/bailyes pakai opsi "auth" sebagai nama folder default
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
// HELPER: PARSE MESSAGE (sama seperti sebelumnya, cuma sumber msg-nya dari Bailyes)
// ─────────────────────────────────────────────
function parseMessage(msg) {
    const type = getContentType(msg.message);
    let text = '';
    if (type === 'conversation') text = msg.message.conversation;
    else if (type === 'extendedTextMessage') text = msg.message.extendedTextMessage.text;
    else if (type === 'imageMessage') text = msg.message.imageMessage?.caption || '';
    else if (type === 'videoMessage') text = msg.message.videoMessage?.caption || '';
    else if (type === 'documentMessage') text = msg.message.documentMessage?.caption || '';
    else if (type === 'buttonsResponseMessage') text = msg.message.buttonsResponseMessage.selectedButtonId;
    else if (type === 'listResponseMessage') text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
    return { type, text: (text || '').trim() };
}

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

    console.log(plugins.size > 0
        ? chalk.green(`[✓] Plugin     : ${plugins.size} plugin aktif`)
        : chalk.red(`[✗] Plugin     : Tidak ada plugin!`));

    console.log(stg.ownerNumber
        ? chalk.green(`[✓] Owner      : ${stg.ownerNumber}`)
        : chalk.red(`[✗] Owner      : OWNER_NUMBER belum diset!`));

    console.log(stg.reminderTarget
        ? chalk.green(`[✓] Target     : ${stg.reminderTarget}`)
        : chalk.yellow(`[!] Target     : REMINDER_TARGET kosong`));

    const token = process.env.EDLINK_TOKEN;
    if (token) {
        const preview = token.substring(0, 8) + '...' + token.substring(token.length - 4);
        console.log(chalk.green(`[✓] Token      : Ada (${preview})`));
    } else {
        console.log(chalk.yellow(`[!] Token      : Belum diset — fitur Edlink nonaktif`));
    }

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

    console.log(chalk.gray(`[~] Jadwal     : Mengirim jadwal hari ini...`));
    try {
        await new Promise(r => setTimeout(r, 5000));
        await sendScheduleOnStartup(conn);
        console.log(chalk.green(`[✓] Jadwal     : Jadwal hari ini terkirim`));
    } catch (e) {
        console.log(chalk.yellow(`[!] Jadwal     : Gagal saat startup — ${e.message} (akan dicoba lagi tiap menit)`));
    }

    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// ─────────────────────────────────────────────
// SYNC SERVER (terima data dari sync.js di PC) — TIDAK BERUBAH
// ─────────────────────────────────────────────
function startSyncServer() {
    const port   = process.env.SYNC_PORT || 2667;
    const secret = process.env.SYNC_SECRET || '';

    http.createServer((req, res) => {
        if (req.method !== 'POST' && req.method !== 'GET') {
            res.writeHead(405); res.end('Method Not Allowed'); return;
        }

        if (secret && req.headers['x-sync-secret'] !== secret) {
            res.writeHead(401); res.end('Unauthorized'); return;
        }

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

                if (type === 'deadlines' && fs.existsSync(filePath)) {
                    try {
                        const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                        for (const [key, val] of Object.entries(data)) {
                            if (existing[key]) {
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
export default async function main() {
    await loadPlugins(__dirname);

    const num = (process.env.BOT_NUMBER || '').replace(/\D/g, '');
    const usePairingCode = !!num;

    const bot = new Bailyes({
        auth: sessionDir,
        prefix: [stg.prefix, '/'],
        pairingCode: usePairingCode,
        phoneNumber: usePairingCode ? num : undefined,
        reconnectDelay: 3000,
        maxReconnectDelay: 30000,
        maxReconnectAttempts: 0,
    });

    bot.onFramework('qr', () => {
        console.log(chalk.cyan('\n📷 QR CODE ditampilkan di atas — scan dengan WhatsApp.'));
    });

    bot.onFramework('pairing-code', (code) => {
        console.log(chalk.green(`\n🔑 PAIRING CODE: ${chalk.bold(code)}\n`));
        console.log(chalk.gray('WhatsApp > Linked Devices > Link a Device > Link with phone number'));
    });

    bot.onFramework('close', ({ message }) => {
        console.log(chalk.yellow(`[RECONNECT] ${message}`));
    });

    bot.onFramework('logged-out', () => {
        console.log(chalk.red('[LOGOUT] Sesi WA logout. Hapus folder auth/ dan jalankan ulang.'));
        process.exit(0);
    });

    bot.onFramework('error', (err) => {
        console.error(chalk.red(`[BAILYES][ERROR] ${err?.message || err}`));
    });

    bot.onFramework('ready', async () => {
        const conn = bot.sock;
        global.__waConn = conn; // dipakai scheduler/telegram.js buat kirim reminder cross-platform
        global.__waStore = bot.store; // [FITUR] Store bawaan @isaxn/bailyes — nama kontak, chat, dll
        console.log(chalk.green('\n✅ Bot terhubung ke WhatsApp!\n'));
        console.log(chalk.cyan('📦 Plugin loaded :'), plugins.size);
        console.log(chalk.cyan('⚙️  Prefix        :'), stg.prefix);
        console.log(chalk.cyan('👤 Owner         :'), stg.ownerNumber || chalk.red('BELUM DISET!'));
        console.log(chalk.cyan('🕐 Timezone      :'), stg.timezone);

        await runStartupCheck(conn);
        startSyncServer();

        setInterval(() => {
            runScheduler(conn);
            runDailySchedule(conn);
            runEdlinkAutoSync(conn);
            runDueRemindersOnce({ telegramConn: global.__tgConn || null, waConn: conn });
            runMorningBriefingOnce({ telegramConn: global.__tgConn || null, waConn: conn });
        }, 60 * 1000);

        runEdlinkQuickPoll(conn);
        setInterval(() => {
            runEdlinkQuickPoll(conn);
        }, 5 * 60 * 1000);
    });

    // ── MESSAGE HANDLER ──
    // Tetap pakai raw event 'messages.upsert' (diteruskan WAClient di dalam
    // @isaxn/bailyes, stabil lintas reconnect) supaya loader plugin lama
    // (Map command -> plugin.run) jalan tanpa perlu ditulis ulang ke bot.command().
    bot.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const conn = bot.sock;
        if (!conn) return;

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

                if (!parsed) {
                    if (!isGroup) {
                        simpananDb.registerUser('wa', chatId);
                        await handleFreeformMessage(conn, msg, { platform: 'wa', chatId, senderId: senderJid, text });
                    }
                    continue;
                }

                const { commandText: rawCommandText, args, usedPrefix } = parsed;

                let commandText = rawCommandText;
                if (rawCommandText === 'menu' && usedPrefix === '/' && usedPrefix !== stg.prefix) {
                    commandText = 'menuflora';
                }

                const plugin = plugins.get(commandText);
                if (!plugin) continue;

                console.log(chalk.magenta(`[CMD] ${isOwner ? '👑' : '👤'} ${getContactName(senderJid)} (${senderJid.split('@')[0]}) → ${usedPrefix}${rawCommandText}`));

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

    await bot.start();
    return bot;
}
