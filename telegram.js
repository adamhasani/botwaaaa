/* ╔══════════════════════════════════════════════════════╗
   ║  THE ARCHIVE — TELEGRAM ENTRY POINT                    ║
   ║  Pakai plugin map YANG SAMA dengan bot WA (main.js)    ║
   ║  jadi command apapun yang ada di /plugins otomatis     ║
   ║  bisa dipanggil dari Telegram juga.                     ║
   ╚══════════════════════════════════════════════════════╝ */
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import chalk from 'chalk';

import stg from './toolkit/setting.js';
import { plugins } from './toolkit/loader.js';
import { parseCommand } from './toolkit/commandParser.js';
import { makeTelegramConn, buildSyntheticMsg } from './toolkit/telegramAdapter.js';
import { handleFreeformMessage } from './toolkit/aiChatHandler.js';
import { processDocumentBuffer } from './toolkit/documentHandler.js';
import * as db from './toolkit/simpananDb.js';
import { runDueRemindersOnce } from './scheduler/simpanan_scheduler.js';

function checkIsOwner(chatId) {
    if (!stg.telegramOwnerId) return false;
    return String(chatId) === String(stg.telegramOwnerId);
}

export default async function startTelegram() {
    if (!stg.telegramToken) {
        console.log(chalk.yellow('[TELEGRAM] TELEGRAM_BOT_TOKEN belum diset di .env — bot Telegram tidak dijalankan.'));
        return null;
    }

    const bot = new Telegraf(stg.telegramToken);
    const conn = makeTelegramConn(bot);

    bot.on('message', async (ctx) => {
        try {
            const message = ctx.message;
            const chatId = String(message.chat.id);
            const isOwner = checkIsOwner(chatId);
            const msg = buildSyntheticMsg(ctx);

            db.registerUser('telegram', chatId);

            // ── Voice note -> transkrip -> lanjut kayak pesan teks ──
            if (message.voice) {
                let text = '';
                try {
                    const { transcribeAudio } = await import('./toolkit/groqAI.js');
                    const fileLink = await ctx.telegram.getFileLink(message.voice.file_id);
                    const res = await fetch(fileLink.href);
                    const buf = Buffer.from(await res.arrayBuffer());
                    text = await transcribeAudio(buf, 'voice.ogg');
                } catch (e) {
                    return conn.sendMessage(chatId, { text: `⚠️ Gagal transkrip voice note: ${e.message}` }, { quoted: msg });
                }
                if (!text) return conn.sendMessage(chatId, { text: '⚠️ Nggak kedengeran apa-apa di voice note-nya.' }, { quoted: msg });
                return handleFreeformMessage(conn, msg, { platform: 'telegram', chatId, senderId: chatId, text });
            }

            // [FITUR BARU] Dokumen (PDF/DOCX/XLSX/dll) & foto -> baca isinya.
            // Butuh caption yang isinya command (.bacadokumen / .baca / /bacadokumen),
            // sama kayak konvensi di WA — biar ga auto-proses tiap foto yang dikirim orang.
            if (message.document || message.photo) {
                const caption = (message.caption || '').trim();
                const parsedCaption = caption ? parseCommand(caption, stg.prefix) : null;
                const isReadDocCommand = parsedCaption && ['bacadokumen', 'baca', 'readdoc'].includes(parsedCaption.commandText);

                if (!isReadDocCommand) {
                    // Bukan command baca dokumen -> biarin lewat kayak biasa (jangan proses berat diam-diam)
                    return;
                }

                try {
                    let fileId, filename;
                    if (message.document) {
                        fileId = message.document.file_id;
                        filename = message.document.file_name || `dokumen_${Date.now()}`;
                    } else {
                        // Telegram kirim beberapa resolusi foto, ambil yang paling besar
                        const largest = message.photo[message.photo.length - 1];
                        fileId = largest.file_id;
                        filename = `foto_${Date.now()}.jpg`;
                    }

                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    const res = await fetch(fileLink.href);
                    const buffer = Buffer.from(await res.arrayBuffer());

                    const wantSave = parsedCaption.args.some(a => a.toLowerCase() === 'simpan');
                    await processDocumentBuffer(conn, msg, { chatId, buffer, filename, save: wantSave });
                } catch (e) {
                    await conn.sendMessage(chatId, { text: `⚠️ Gagal memproses file: ${e.message}` }, { quoted: msg });
                }
                return;
            }

            const text = (message.text || message.caption || '').trim();
            if (!text) return;

            const parsed = parseCommand(text, stg.prefix);

            if (parsed) {
                const plugin = plugins.get(parsed.commandText);
                if (plugin) {
                    console.log(chalk.magenta(`[CMD-TG] ${isOwner ? '👑' : '👤'} ${chatId} → ${parsed.commandText}`));
                    if (plugin.owner && !isOwner) {
                        return conn.sendMessage(chatId, { text: '❌ Command ini khusus owner!' }, { quoted: msg });
                    }
                    try {
                        return await plugin.run(conn, msg, {
                            chatInfo: { chatId, senderId: chatId, isGroup: message.chat.type !== 'private', isOwner },
                            args: parsed.args,
                            prefix: stg.prefix,
                            commandText: parsed.commandText,
                            command: parsed.commandText,
                            text,
                        });
                    } catch (e) {
                        console.error(chalk.red(`[CMD-TG][ERROR] ${e.message}`));
                        return conn.sendMessage(chatId, { text: `⚠️ Terjadi error: ${e.message}` }, { quoted: msg });
                    }
                }
                // Command diketik tapi ga ketemu plugin-nya -> jangan dianggap chat biasa
                if (text.startsWith('/')) return;
            }

            // ── Bukan command sama sekali -> chat AI bebas (kayak bot.py) ──
            // Cuma di chat pribadi biar ga spam auto-reply kalau bot ada di grup Telegram.
            if (message.chat.type === 'private') {
                await handleFreeformMessage(conn, msg, { platform: 'telegram', chatId, senderId: chatId, text });
            }

        } catch (e) {
            console.error(chalk.red(`[TELEGRAM][ERROR] ${e.message}`));
        }
    });

    bot.catch((err) => console.error(chalk.red(`[TELEGRAM][FATAL] ${err.message}`)));

    await bot.launch();
    global.__tgConn = conn; // dipakai main.js (WA) buat kirim reminder cross-platform
    console.log(chalk.green('\n✅ Bot terhubung ke Telegram!\n'));

    // Scheduler reminder generik (items yang ditambah lewat "reminder"/chat AI)
    setInterval(() => runDueRemindersOnce({ telegramConn: conn, waConn: global.__waConn || null }), 60 * 1000);

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return conn;
}
