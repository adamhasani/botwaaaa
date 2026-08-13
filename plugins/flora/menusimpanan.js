import { sendWithButtons } from '../../toolkit/buttons.js';

export default {
    name: 'menusimpanan',
    command: ['menusimpanan'],
    tags: 'Info',
    desc: 'Submenu Simpanan (list, cari, hapus)',
    prefix: true,

    run: async (conn, msg, { chatInfo, prefix, platform }) => {
        const { chatId } = chatInfo;

        const text = `💾 *SIMPANAN*\nSimpan catatan atau link, cari lagi kapan aja.\n\n📌 Cara pakai:\n├ ${prefix}simpan [teks/link] — simpan catatan baru\n├ ${prefix}cari [kata kunci] — cari isi simpanan\n└ ${prefix}hapussimpanan [id] — hapus 1 simpanan`;

        const buttons = [
            { id: '/listsimpanan', label: '📂 Lihat Semua Simpanan' },
            { id: '/menuflora', label: '⬅️ Kembali' },
        ];

        try {
            await sendWithButtons(conn, chatId, platform, text, buttons, { quoted: msg });
        } catch (e) {
            console.error(`[MENUSIMPANAN] ❌ GAGAL kirim ke ${chatId}:`, e.message);
            throw e;
        }
    },
};
