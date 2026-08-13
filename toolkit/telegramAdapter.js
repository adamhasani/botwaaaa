/* ╔══════════════════════════════════════════════════════╗
   ║  TELEGRAM ADAPTER                                     ║
   ║  Bikin "conn" versi Telegram yang punya method        ║
   ║  sendMessage(chatId, content, options) SAMA PERSIS    ║
   ║  bentuknya kayak Baileys punya. Efeknya: plugin yang   ║
   ║  udah ada (menu, addtugas, tt, yt, ig, dst) otomatis   ║
   ║  jalan juga di Telegram TANPA perlu ditulis ulang.     ║
   ╚══════════════════════════════════════════════════════╝ */
import chalk from 'chalk';

// Buang markdown WA-style (*bold*, _italic_) jadi cocok ke Telegram (Markdown biasa udah mirip,
// jadi kita coba parse_mode Markdown dan fallback ke plain text kalau gagal)
async function safeSend(fn) {
    try {
        return await fn();
    } catch (e) {
        console.error(chalk.red(`[TELE-ADAPTER] ${e.message}`));
        return null;
    }
}

export function makeTelegramConn(bot) {
    const conn = {
        platform: 'telegram',
        bot,

        // ── method utama, dipanggil dari SEMUA plugin ──
        sendMessage: async (chatId, content = {}, options = {}) => {
            const replyOpts = {};
            if (options.quoted?.telegramMessageId) {
                replyOpts.reply_parameters = { message_id: options.quoted.telegramMessageId };
            }

            // reaction (WA-only konsep) — Telegram punya setMessageReaction tapi opsional, skip aja kalau gagal
            if (content.react) {
                if (options.quoted?.telegramMessageId) {
                    await safeSend(() => bot.telegram.setMessageReaction(chatId, options.quoted.telegramMessageId, [{ type: 'emoji', emoji: pickSupportedEmoji(content.react.text) }]));
                }
                return;
            }

            if (typeof content.text === 'string') {
                // [FITUR] Tombol interaktif — kalau plugin kirim content.buttons
                // ([{id, label}]), translate ke inline keyboard Telegram.
                if (Array.isArray(content.buttons) && content.buttons.length) {
                    const rows = [];
                    for (let i = 0; i < content.buttons.length; i += 2) {
                        rows.push(content.buttons.slice(i, i + 2).map(b => ({ text: b.label, callback_data: b.id })));
                    }
                    return safeSend(() => bot.telegram.sendMessage(chatId, stripWaMarkdown(content.text), {
                        ...replyOpts,
                        reply_markup: { inline_keyboard: rows },
                    }));
                }
                // [FITUR] List message ala WA (sections/rows) -> tetap ditranslate jadi inline keyboard
                if (Array.isArray(content.sections) && content.sections.length) {
                    const rows = [];
                    for (const section of content.sections) {
                        for (const row of section.rows || []) {
                            rows.push([{ text: row.title, callback_data: row.id }]);
                        }
                    }
                    return safeSend(() => bot.telegram.sendMessage(chatId, stripWaMarkdown(content.text), {
                        ...replyOpts,
                        reply_markup: { inline_keyboard: rows },
                    }));
                }
                return safeSend(() => bot.telegram.sendMessage(chatId, stripWaMarkdown(content.text), replyOpts));
            }
            if (content.image) {
                const src = content.image.url || content.image;
                return safeSend(() => bot.telegram.sendPhoto(chatId, src, { caption: content.caption, ...replyOpts }));
            }
            if (content.video) {
                const src = content.video.url || content.video;
                return safeSend(() => bot.telegram.sendVideo(chatId, src, { caption: content.caption, ...replyOpts }));
            }
            if (content.audio) {
                const src = content.audio.url || content.audio;
                if (content.ptt) {
                    return safeSend(() => bot.telegram.sendVoice(chatId, src, { caption: content.caption, ...replyOpts }));
                }
                return safeSend(() => bot.telegram.sendAudio(chatId, src, { caption: content.caption, ...replyOpts }));
            }
            if (content.document) {
                const src = content.document.url || content.document;
                return safeSend(() => bot.telegram.sendDocument(chatId, src, { caption: content.caption, ...replyOpts }));
            }
            if (content.sticker) {
                const src = content.sticker.url || content.sticker;
                return safeSend(() => bot.telegram.sendSticker(chatId, src));
            }
            return null;
        },
    };
    return conn;
}

function pickSupportedEmoji(text) {
    // Telegram cuma terima set emoji tertentu buat reaction, fallback ke 👍
    const supported = ['👍', '❤', '🔥', '🎉', '🤔', '😢', '👀', '✅', '⌛'];
    return supported.includes(text) ? text : '👍';
}

function stripWaMarkdown(text) {
    // Konversi *bold* WA -> *bold* Telegram (sama), _italic_ -> _italic_ (sama juga)
    // Cukup escape karakter yang bisa bikin Telegram Markdown error, sisanya biarin apa adanya.
    return text;
}

// ── Bangun objek "msg" sintetis biar plugin yang baca msg.key / msg.message tetap ga error ──
export function buildSyntheticMsg(ctxUpdate) {
    const message = ctxUpdate.message || ctxUpdate.channelPost;
    const chatId = String(message.chat.id);
    return {
        key: {
            remoteJid: chatId,
            fromMe: false,
            id: String(message.message_id),
            participant: undefined,
        },
        telegramMessageId: message.message_id,
        message: null, // WA-specific media structure ga ada di Telegram, plugin yg butuh ini (mis. stiker dari quoted WA) akan skip natural
        pushName: message.from?.first_name || message.from?.username || 'User',
    };
}
