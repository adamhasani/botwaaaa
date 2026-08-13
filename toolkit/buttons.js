/* ╔══════════════════════════════════════════════════════╗
   ║  BUTTONS — helper tombol interaktif WA & Telegram       ║
   ║  Selalu lewat conn.sendMessage() (konsisten dengan       ║
   ║  arsitektur wrapper main.js/telegramAdapter.js) —         ║
   ║  translate ke bentuk native tiap platform di dalam        ║
   ║  wrapper masing2, bukan di sini.                          ║
   ╚══════════════════════════════════════════════════════╝ */

/**
 * Kirim pesan dengan tombol. Konsisten manggil conn.sendMessage() untuk
 * kedua platform — Baileys terima {text, sections}, telegramAdapter.js
 * terima {text, buttons} (lihat toolkit/telegramAdapter.js).
 * @param buttons  [{ id: '/menu', label: '⚡ Menu Flora' }, ...]
 */
export async function sendWithButtons(conn, chatId, platform, text, buttons, opts = {}) {
    if (platform === 'telegram') {
        return conn.sendMessage(chatId, { text, buttons }, opts);
    }

    // WhatsApp — pakai interactiveMessage (list) via Baileys, fallback ke teks + angka kalau gagal render.
    try {
        const rows = buttons.map(b => ({ title: b.label, description: b.desc || '', rowId: b.id }));
        return await conn.sendMessage(chatId, {
            text,
            footer: 'The Archive Bot',
            title: '',
            buttonText: 'Pilih Menu',
            sections: [{ title: 'Menu', rows }],
        }, opts);
    } catch (e) {
        const manual = buttons.map((b, i) => `${i + 1}. ${b.label} → ketik *${b.id}*`).join('\n');
        return conn.sendMessage(chatId, { text: `${text}\n\n${manual}` }, opts);
    }
}

/**
 * Cocokin teks bebas terhadap daftar tombol berdasarkan id-nya —
 * dipakai buat fallback WA (kalau list message gagal render dan user ketik manual)
 * dan buat translate command pindah menu.
 */
export function matchButtonId(text, buttons) {
    const clean = text.trim().toLowerCase();
    return buttons.find(b => b.id.toLowerCase() === clean) || null;
}
