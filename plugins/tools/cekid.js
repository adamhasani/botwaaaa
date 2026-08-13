export default {
    name: 'cekid',
    command: ['cekid', 'id', 'jid'],
    tags: 'Info',
    desc: 'Cek JID chat/grup ini',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, commandText, args }) => {
        const { chatId, isGroup } = chatInfo;

        // Kalau ada invite link, ekstrak group ID
        const link = args[0];
        if (link && link.includes('chat.whatsapp.com/')) {
            const code = link.split('chat.whatsapp.com/')[1]?.split('?')[0];
            if (code) {
                try {
                    const result = await conn.groupGetInviteInfo(code);
                    return conn.sendMessage(chatId, {
                        text: `✅ *Info Grup dari Link*\n\n📌 Nama: *${result.subject}*\n🆔 JID: \`${result.id}\`\n👥 Member: ${result.size}\n\n_Copy JID di atas untuk REMINDER_TARGET di .env_`
                    }, { quoted: msg });
                } catch (e) {
                    return conn.sendMessage(chatId, {
                        text: `❌ Gagal ambil info grup: ${e.message}\n\nPastikan link valid dan bot sudah bergabung atau punya akses.`
                    }, { quoted: msg });
                }
            }
        }

        // Kalau tidak ada link, tampilkan JID chat saat ini
        const type = isGroup ? '👥 Grup' : '👤 Personal';
        await conn.sendMessage(chatId, {
            text: `🆔 *JID Chat Ini*\n\n${type}\n\`${chatId}\`\n\n_Copy JID di atas untuk REMINDER_TARGET di .env_\n_Pisah dengan koma kalau mau beberapa grup_`
        }, { quoted: msg });
    }
};
