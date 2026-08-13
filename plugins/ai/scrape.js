import { scrapePageContent, extractUrl } from '../../toolkit/scrape.js';
import { askGroqSimple } from '../../toolkit/groqAI.js';

export default {
    name: 'scrape',
    command: ['scrape', 'rangkum'],
    tags: 'AI & Simpanan',
    desc: 'Ambil & rangkum isi lengkap sebuah halaman web dari URL',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const text = args.join(' ').trim();
        const url = extractUrl(text);

        if (!url) {
            return conn.sendMessage(chatId, {
                text: `🔗 Kirim URL yang mau di-scrape.\nContoh: *${prefix}${commandText} https://contoh.com/artikel*`
            }, { quoted: msg });
        }

        await conn.sendMessage(chatId, { text: '🔍 Lagi ambil isi halamannya...' }, { quoted: msg });

        const scraped = await scrapePageContent(url);
        if (scraped.error) {
            return conn.sendMessage(chatId, { text: `⚠️ ${scraped.error}` }, { quoted: msg });
        }

        const ringkasan = await askGroqSimple(
            `Ringkas isi halaman '${scraped.title}' berikut jadi poin-poin penting:\n${scraped.text}`,
            500
        );

        await conn.sendMessage(chatId, { text: `📄 *${scraped.title}*\n\n${ringkasan}\n\n🔗 ${url}` }, { quoted: msg });
    }
};
