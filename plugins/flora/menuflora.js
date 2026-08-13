import stg from '../../toolkit/setting.js';
import moment from 'moment-timezone';
import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menuflora',
    command: ['menuflora'],
    tags: 'Info',
    desc: 'Tampilkan menu Flora dalam bentuk tombol (God Mode, Hermes, Simpanan, Journal, dll)',
    prefix: true,

    run: async (conn, msg, { chatInfo, platform }) => {
        const { chatId } = chatInfo;
        const now = moment().tz(stg.timezone).format('HH:mm • DD MMM YYYY');

        const text = `🌸 *Halo! Aku Flora*\n🕐 ${now} WIB\n\n👇 Pilih menu utama di bawah:`;

        // 2 tombol per baris (ditangani otomatis sama sendWithButtons/telegramAdapter)
        const buttons = [
            { id: '/god', label: '💻 Mode God (Laptop)' },
            { id: '/hermes', label: '⚡ Mode Hermes (VPS)' },
            { id: '/menusimpanan', label: '💾 Simpanan' },
            { id: '/menujurnal', label: '📔 Journal' },
            { id: '/menutugas', label: '📋 Tugas & Edlink' },
            { id: '/menudownload', label: '📥 Downloader' },
            { id: '/menutools', label: '🛠️ Tools' },
            { id: '/menureminder', label: '⏰ Reminder' },
            { id: '.menu', label: '🗂️ Menu Archive Lite' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
            console.log(`[MENUFLORA] ✅ Terkirim ke ${chatId}`);
        } catch (e) {
            console.error(`[MENUFLORA] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
