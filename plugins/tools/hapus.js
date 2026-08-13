/* ╔══════════════════════════════════════════╗
   ║  HAPUS — lihat & hapus pesan bot        ║
   ╚══════════════════════════════════════════╝ */

import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import { getRecentMessages } from '../../toolkit/msgLog.js';

export default {
    name: 'hapus',
    command: ['hapus', 'delete', 'del'],
    tags: 'Owner',
    desc: '.hapus → list pesan 5 jam terakhir | reply pesan + .delete → hapus pesan itu',
    prefix: true,
    owner: true,

    run: async (conn, msg, { chatInfo, args, prefix, command }) => {
        const { chatId } = chatInfo;

        // ── .delete / .del — hapus pesan yang di-reply ──
        if (command === 'delete' || command === 'del') {
            const ctx = msg.message?.extendedTextMessage?.contextInfo;

            if (!ctx?.stanzaId) {
                return conn.sendMessage(chatId, {
                    text: `❌ *Reply dulu pesan yang mau dihapus, lalu ketik* \`${prefix}delete\``
                }, { quoted: msg });
            }

            const key = {
                remoteJid: chatId,
                id:        ctx.stanzaId,
                fromMe:    true,
                ...(ctx.participant ? { participant: ctx.participant } : {}),
            };

            try {
                await conn.sendMessage(chatId, { delete: key });
                // Hapus notif sukses setelah 3 detik supaya rapi
                const notif = await conn.sendMessage(chatId, {
                    text: '🗑️ _Pesan berhasil dihapus._'
                }, { quoted: msg });
                setTimeout(async () => {
                    try {
                        await conn.sendMessage(chatId, {
                            delete: { remoteJid: chatId, id: notif.key.id, fromMe: true }
                        });
                    } catch {}
                }, 3000);
            } catch (e) {
                await conn.sendMessage(chatId, {
                    text: `❌ Gagal hapus pesan.\n_Pastikan pesan itu dikirim oleh bot._`
                }, { quoted: msg });
            }

            return;
        }

        // ── .hapus — tampilkan log 5 jam terakhir ──
        const jam    = parseInt(args[0]) || 5;
        const recent = getRecentMessages(chatId, jam);

        if (!recent.length) {
            return conn.sendMessage(chatId, {
                text: `📭 _Tidak ada pesan bot dalam ${jam} jam terakhir di chat ini._`
            }, { quoted: msg });
        }

        const lines = recent.map((m, i) => {
            const waktu   = moment(m.ts).tz(stg.timezone).format('HH:mm');
            const preview = m.text.length > 60
                ? m.text.substring(0, 60).replace(/\n/g, ' ') + '...'
                : m.text.replace(/\n/g, ' ');
            return `${i + 1}. [${waktu}] ${preview}`;
        });

        const text = `🗑️ *PESAN BOT — ${jam} JAM TERAKHIR*\n`
            + `${'─'.repeat(28)}\n\n`
            + lines.join('\n\n')
            + `\n\n${'─'.repeat(28)}\n`
            + `_Reply pesan yang ingin dihapus, lalu ketik_ \`${prefix}delete\``;

        await conn.sendMessage(chatId, { text }, { quoted: msg });
    }
};
