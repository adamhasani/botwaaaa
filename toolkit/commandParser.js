// Parser command yang dipakai bareng WA & Telegram.
// Kedua platform saling terima prefix satu sama lain (WA "." dan Telegram "/"),
// biar command yang sama bisa dipanggil dengan gaya platform manapun.
// altPrefix = prefix "lawan" yang juga diterima sebagai fallback.
export function parseCommand(text, prefix, altPrefix = '/') {
    let body = null;
    let usedPrefix = null;
    if (text.startsWith(prefix)) { body = text.slice(prefix.length); usedPrefix = prefix; }
    else if (altPrefix && text.startsWith(altPrefix)) { body = text.slice(altPrefix.length); usedPrefix = altPrefix; }
    else return null;

    const parts = body.trim().split(/\s+/);
    const commandText = (parts[0] || '').toLowerCase();
    if (!commandText) return null;
    return { commandText, args: parts.slice(1), usedPrefix };
}
