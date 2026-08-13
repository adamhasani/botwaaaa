/* ╔══════════════════════════════════════════════════════╗
   ║  WA STORE HELPER — akses Store bawaan @isaxn/bailyes    ║
   ║  (contact/chat/message memory), di-bind otomatis oleh    ║
   ║  Bailyes class saat start(). Diexpose lewat global oleh  ║
   ║  main.js begitu bot 'ready'.                              ║
   ╚══════════════════════════════════════════════════════╝ */

/** Nama kontak asli lewat Store, fallback ke nomor kalau belum kenal/Store belum siap. */
export function getContactName(jid) {
    try {
        const store = global.__waStore;
        if (!store) return jid?.split('@')[0] || jid;
        return store.getName(jid) || jid?.split('@')[0] || jid;
    } catch {
        return jid?.split('@')[0] || jid;
    }
}

/** Ambil instance Store mentah, buat kebutuhan lanjutan (loadMessage, getChat, dll). null kalau belum siap. */
export function getStore() {
    return global.__waStore || null;
}
