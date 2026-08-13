/* ╔══════════════════════════════════════════════════════╗
   ║  BUTTONS — helper tombol interaktif WA & Telegram       ║
   ║  Selalu lewat conn.sendMessage() (konsisten dengan       ║
   ║  arsitektur wrapper main.js/telegramAdapter.js) —         ║
   ║  translate ke bentuk native tiap platform di dalam        ║
   ║  wrapper masing2, bukan di sini.                          ║
   ╚══════════════════════════════════════════════════════╝ */

import { bx } from '@isaxn/bailyes';

/**
 * Kirim pesan dengan tombol. Konsisten manggil conn.sendMessage() untuk Telegram
 * (lewat telegramAdapter.js), tapi untuk WA sekarang pakai bx.button native dari
 * @isaxn/bailyes — lebih stabil daripada format sections/list Baileys lama.
 * @param buttons  [{ id: '/menu', label: '⚡ Menu Flora' }, ...] — max ~3 disarankan (limit tampilan WA)
 */
export async function sendWithButtons(conn, chatId, platform, text, buttons, opts = {}) {
    if (platform === 'telegram') {
        return conn.sendMessage(chatId, { text, buttons }, opts);
    }

    // WhatsApp — bx.button butuh sock mentah (bukan wrapper), "conn" yang dikirim
    // dari plugin di sini SUDAH sock mentah karena main.js pakai bot.sock langsung.
    try {
        return await bx.button(conn, chatId, {
            body: text,
            footer: 'The Archive Bot',
            buttons: buttons.map(b => ({ text: b.label, id: b.id })),
            options: opts,
        });
    } catch (e) {
        // Fallback aman kalau bx.button gagal render (versi WA client tertentu, dll)
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
