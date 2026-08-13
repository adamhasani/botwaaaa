import { runEdlinkSync } from '../../scheduler/edlink_auto_sync.js';

export default {
    name: 'syncjadwal',
    command: ['syncjadwal', 'jadwalsync'],
    tags: 'Jadwal',
    desc: 'Sync jadwal kuliah dari Edlink ke database lokal',
    owner: true,
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;

        await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
        await conn.sendMessage(chatId, { text: '🔄 Mengambil jadwal dari Edlink...' }, { quoted: msg });

        const result = await runEdlinkSync();

        if (result.errors.length && !result.jadwal) {
            await conn.sendMessage(chatId, {
                text: `❌ *Gagal sync jadwal*\n\n${result.errors.join('\n')}`
            }, { quoted: msg });
            await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return;
        }

        const { weekOf, hariAda } = result.jadwal;
        let text = `✅ *SYNC JADWAL SELESAI*\n\n`;
        text += `📅 Minggu: *${weekOf}*\n`;
        text += `📚 Hari ada kelas: *${hariAda} hari*\n`;
        if (result.errors.length) text += `\n⚠️ _${result.errors.join(' | ')}_`;

        await conn.sendMessage(chatId, { text }, { quoted: msg });
        await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
