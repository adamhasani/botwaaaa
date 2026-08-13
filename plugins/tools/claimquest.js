import { claimDailyQuests } from '../../scheduler/edlink_quest.js';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';

export default {
    name: 'claimquest',
    command: ['claimquest', 'quest', 'klaim'],
    tags: 'Owner',
    desc: 'Klaim semua Daily Quest Edlink sekarang',
    prefix: true,
    owner: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        if (!process.env.EDLINK_EMAIL || !process.env.EDLINK_PASSWORD) {
            return conn.sendMessage(chatId, {
                text: '❌ *EDLINK_EMAIL / EDLINK_PASSWORD belum diset di .env!*'
            }, { quoted: msg });
        }

        await conn.sendMessage(chatId, {
            text: '🤖 _Mengambil daftar quest dari Edlink..._\n\n⏳ Sebentar ya.'
        }, { quoted: msg });

        try {
            const result = await claimDailyQuests();
            const now    = moment().tz(stg.timezone);

            let text;

            if (result.error) {
                text = `❌ *Gagal klaim quest!*\n\n*Error:* ${result.error}\n\n`;
                if (result.error.includes('email') || result.error.includes('password')) {
                    text += `Cek \`EDLINK_EMAIL\` dan \`EDLINK_PASSWORD\` di .env.`;
                } else {
                    text += `Coba lagi atau cek \`.cekkoneksi\`.`;
                }
            } else {
                text = `🎯 *DAILY QUEST EDLINK*\n`;
                text += `📅 ${now.format('dddd, DD MMM YYYY — HH:mm')} WIB\n`;
                text += `${'─'.repeat(24)}\n\n`;

                if (result.claimed.length > 0) {
                    text += `✅ *Berhasil Diklaim:*\n`;
                    result.claimed.forEach(q => {
                        text += `   • ${q.label}${q.poin ? ` (+${q.poin} poin)` : ''}\n`;
                    });
                    text += `\n💰 *Total: +${result.poinTotal} poin*\n\n`;
                }

                if (result.skipped.length > 0) {
                    text += `⬜ *Belum Tersedia / Skip:*\n`;
                    result.skipped.forEach(q => {
                        text += `   • ${q.label}\n`;
                    });
                    text += '\n';
                }

                if (result.claimed.length === 0 && result.skipped.length === 0) {
                    text += `_Tidak ada tombol Klaim yang ditemukan._\n`;
                    text += `_Semua quest mungkin sudah diklaim hari ini._ ✅\n\n`;
                }

                text += `${'─'.repeat(24)}\n`;
                text += `_Auto-claim juga aktif jam 07:05 setiap hari._`;
            }

            await conn.sendMessage(chatId, { text }, { quoted: msg });

        } catch (e) {
            await conn.sendMessage(chatId, {
                text: `❌ *Error tidak terduga:*\n${e.message}`
            }, { quoted: msg });
        }
    }
};