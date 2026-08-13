import { planAndExecuteAgenticTask } from '../../toolkit/floraAgent.js';
import { AIRich } from '@isaxn/bailyes';

export default {
    name: 'agentic',
    command: ['agentic', 'agen', 'tugasotomatis'],
    tags: 'Flora',
    desc: 'Pecah 1 perintah kompleks jadi beberapa langkah otomatis (riset -> simpan -> ingetin)',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText, platform }) => {
        const { chatId } = chatInfo;
        const text = args.join(' ').trim();

        if (!text) {
            return conn.sendMessage(chatId, {
                text: `🤖 Kasih tau tugas kompleksnya, contoh:\n*${prefix}${commandText} carikan berita AI terbaru terus simpen yang paling menarik*`,
            }, { quoted: msg });
        }

        try {
            await conn.sendMessage(chatId, { text: '🤖 Oke, aku pecah dulu jadi beberapa langkah ya...' }, { quoted: msg });
            const result = await planAndExecuteAgenticTask(text, platform, chatId);
            await sendAgenticReply(conn, chatId, msg, text, result, prefix, commandText);
            console.log(`[AGENTIC] ✅ Selesai untuk ${chatId}`);
        } catch (e) {
            console.error(`[AGENTIC] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Agentic: ${e.message}` }, { quoted: msg });
        }
    },
};

// [FITUR] Rekap agentic terstruktur: tabel per-langkah (icon, aksi, hasil, status),
// opsional addCode nunjukin JSON plan mentah dari AI, dan tombol "ulangi" via
// addSuggest. Tiga lapis fallback sama seperti hermes.js — command gak pernah
// gagal total walau salah satu fitur AIRich yang lebih baru gak kesupport.
async function sendAgenticReply(conn, chatId, msg, originalText, result, prefix, commandText) {
    if (!result.ok) {
        await conn.sendMessage(chatId, { text: `⚠️ ${result.error}` }, { quoted: msg });
        return;
    }

    const { steps, plan } = result;
    const table = [['', 'Langkah', 'Hasil']];
    for (const s of steps) {
        table.push([s.status === 'ok' ? '✅' : '⚠️', s.label, (s.detail || '').slice(0, 80)]);
    }

    // Lapis 1: AIRich penuh — tabel + detail tiap langkah + JSON plan + tombol ulangi
    try {
        const rich = new AIRich(conn)
            .setTitle('🤖 Agentic — Rekap Tugas')
            .addTable(table);

        // Detail lengkap tiap langkah (tabel di atas cuma ringkasan terpotong)
        const fullDetail = steps.map(s => `${s.icon} *${s.label}*\n${s.detail || '-'}`).join('\n\n');
        if (fullDetail) rich.addText(fullDetail);

        try {
            // addCode dari README sudah ada contoh parameternya di dokumentasi utama
            // (title/language/content), jadi lapis ini lebih dipercaya daripada addSuggest.
            rich.addCode('json', JSON.stringify(plan, null, 2));
        } catch { /* addCode gagal — bukan fatal, lanjut tanpa nunjukin JSON plan */ }

        try {
            rich.addSuggest([
                { text: '🔁 Ulangi dengan approach beda', prompt: `${prefix}${commandText} ${originalText} (coba cara yang beda)` },
            ]);
        } catch { /* addSuggest gagal — lanjut tanpa tombol */ }

        rich.addTip(`Perintah asli: ${originalText}`);
        await rich.send(chatId, { quoted: msg });
        return;
    } catch (e) {
        console.log(`[AGENTIC] AIRich penuh gagal (${e.message}), coba versi sederhana...`);
    }

    // Lapis 2: AIRich sederhana (tabel + tip doang)
    try {
        const rich = new AIRich(conn)
            .setTitle('🤖 Agentic — Rekap Tugas')
            .addTable(table)
            .addTip(`Perintah asli: ${originalText}`);
        await rich.send(chatId, { quoted: msg });
        return;
    } catch (e) {
        console.log(`[AGENTIC] AIRich sederhana juga gagal (${e.message}), fallback teks polos.`);
    }

    // Lapis 3: teks polos
    const text = '🤖 *Tugas selesai, ini rekapnya:*\n\n' +
        steps.map(s => `${s.icon} *${s.label}*\n${s.detail || '-'}`).join('\n\n');
    await conn.sendMessage(chatId, { text }, { quoted: msg });
}
