/* Web search sederhana pakai DuckDuckGo HTML (tanpa API key) */
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function performWebSearch(query, maxResults = 5) {
    try {
        const res = await axios.get('https://html.duckduckgo.com/html/', {
            params: { q: query },
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const out = [];
        $('.result').each((i, el) => {
            if (out.length >= maxResults) return;
            const title = $(el).find('.result__title').text().trim();
            const href = $(el).find('.result__url').attr('href') || $(el).find('a.result__a').attr('href');
            const body = $(el).find('.result__snippet').text().trim();
            if (title) out.push(`• ${title}\n  Link: ${href || ''}\n  Detail: ${body}`);
        });
        return out.length ? out.join('\n') : 'Nggak nemu hasil pencarian spesifik di internet.';
    } catch (e) {
        return `Gagal melakukan pencarian web: ${e.message}`;
    }
}
