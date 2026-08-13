import { planAndExecuteAgenticTask } from '../../toolkit/floraAgent.js';

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
            await conn.sendMessage(chatId, { text: formatAgenticResult(result) }, { quoted: msg });
            console.log(`[AGENTIC] ✅ Selesai untuk ${chatId}`);
        } catch (e) {
            console.error(`[AGENTIC] ❌ GAGAL untuk ${chatId}:`, e.message);
            await conn.sendMessage(chatId, { text: `⚠️ Error Agentic: ${e.message}` }, { quoted: msg });
        }
    },
};

// planAndExecuteAgenticTask return { ok, steps: [{icon,label,detail,status}], error? }.
// Format jadi teks WA biasa (tidak pakai tabel bx.rich — fitur @isaxn/bailyes).
function formatAgenticResult(result) {
    if (!result.ok) return `⚠️ ${result.error}`;
    const lines = result.steps.map(s => `${s.icon} *${s.label}*\n${s.detail || '-'}`);
    return '🤖 *Tugas selesai, ini rekapnya:*\n\n' + lines.join('\n\n');
}
