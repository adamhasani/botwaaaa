// Parser command yang dipakai bareng WA & Telegram.
// Telegram support prefix "." (custom) DAN "/" (kebiasaan command Telegram),
// jadi command yang sama bisa dipanggil dengan gaya command masing-masing platform.
export function parseCommand(text, prefix) {
    let body = null;
    if (text.startsWith(prefix)) body = text.slice(prefix.length);
    else if (text.startsWith('/')) body = text.slice(1);
    else return null;

    const parts = body.trim().split(/\s+/);
    const commandText = (parts[0] || '').toLowerCase();
    if (!commandText) return null;
    return { commandText, args: parts.slice(1) };
}
