/* ╔══════════════════════════════════════════╗
   ║  SCRAPE — ambil isi lengkap sebuah halaman  ║
   ║  Port dari scrape_page_content() di bot.py  ║
   ╚══════════════════════════════════════════╝ */
import axios from 'axios';
import * as cheerio from 'cheerio';

export function extractUrl(text) {
    const m = text.match(/(https?:\/\/\S+)/);
    return m ? m[1] : null;
}

/**
 * Ambil isi teks utama dari sebuah URL (bukan cuma title/snippet).
 * Return { title, text, error }.
 */
export async function scrapePageContent(url, maxChars = 4000) {
    let html;
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                    + '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            },
            timeout: 15000,
            maxRedirects: 5,
        });
        html = res.data;
    } catch (e) {
        return { title: null, text: null, error: `Gagal ambil halaman: ${e.message}` };
    }

    try {
        const $ = cheerio.load(html);

        $('script, style, nav, footer, header, aside, form, iframe').remove();

        const title = ($('title').first().text() || '').trim() || url;

        // Coba cari container artikel yang umum dipakai, fallback ke <body>.
        let main = $('article').first();
        if (!main.length) main = $('[role="main"]').first();
        if (!main.length) main = $('[id*="content"], [id*="main"], [id*="article"]').first();
        if (!main.length) main = $('[class*="content"], [class*="main"], [class*="article"], [class*="post"]').first();
        if (!main.length) main = $('body');

        if (!main.length) {
            return { title, text: null, error: 'Konten tidak ditemukan di halaman.' };
        }

        const parts = [];
        main.find('p, li, h1, h2, h3').each((i, el) => {
            const t = $(el).text().trim();
            if (t) parts.push(t);
        });

        let text = parts.join('\n');
        if (!text) text = main.text().replace(/\s+/g, ' ').trim();

        text = text.slice(0, maxChars);

        if (!text.trim()) {
            return { title, text: null, error: 'Halaman ditemukan tapi tidak ada teks yang bisa diekstrak.' };
        }

        return { title, text, error: null };
    } catch (e) {
        return { title: null, text: null, error: `Gagal parsing HTML: ${e.message}` };
    }
}
