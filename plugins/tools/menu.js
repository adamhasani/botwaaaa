import stg from '../../toolkit/setting.js';
import moment from 'moment-timezone';
import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menu',
    command: ['menu', 'help', 'bantuan'],
    tags: 'Info',
    desc: 'Tampilkan menu bot (Archive) dalam bentuk tombol',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;
        const now = moment().tz(stg.timezone).format('HH:mm • DD MMM YYYY');
        const isTelegram = platform === 'telegram';
        const header = isTelegram
            ? `╔══════════════════════════╗\n║   🗂️  THE ARCHIVE LITE    ║\n║  Telegram Bot by Adam H.  ║\n╚══════════════════════════╝`
            : `╔══════════════════════════╗\n║   🗂️  THE ARCHIVE LITE    ║\n║   WA Bot by Adam Hasani   ║\n╚══════════════════════════╝`;

        const text = `${header}\n🕐 ${now} WIB\n\n👇 Pilih kategori di bawah.\nMau fitur Flora (God/Hermes/Simpanan/Journal)? Ketik /menu.`;

        // Max 3 tombol per layar (limit tampilan WA) — kategori lain di-cascade ke submenu
        const buttons = [
            { id: '/menudl', label: '📥 Downloader' },
            { id: '/menutgsedlink', label: '📋 Tugas & Edlink' },
            { id: '/menutls', label: '🛠️ Tools & Info' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
            console.log(`[MENU] ✅ Terkirim ke ${chatId}`);
        } catch (e) {
            console.error(`[MENU] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    }
};
