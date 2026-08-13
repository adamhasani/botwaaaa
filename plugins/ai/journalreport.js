import * as db from '../../toolkit/simpananDb.js';
import { generateJournalReport } from '../../toolkit/groqAI.js';
import { bx } from '@isaxn/bailyes';

export default {
    name: 'journalreport',
    command: ['journalreport', 'laporanjurnal'],
    tags: 'AI & Simpanan',
    desc: 'Buat laporan naratif tren mood & topik jurnal 7 hari terakhir',
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;
        const platform = conn.platform === 'telegram' ? 'telegram' : 'wa';

        await conn.sendMessage(chatId, { text: '📊 Lagi nyusun laporan jurnal minggu ini...' }, { quoted: msg });

        const days = 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const entries = db.getJournalSince(platform, chatId, since);

        if (!entries.length) {
            return conn.sendMessage(chatId, {
                text: '📔 Belum ada entri jurnal dalam 7 hari terakhir buat dibuatkan laporan.'
            }, { quoted: msg });
        }

        const report = await generateJournalReport(entries, days);

        try {
            await bx.rich(conn, chatId, {
                title: '📊 Laporan Jurnal — 7 Hari Terakhir',
                text: report,
                tip: `Berdasarkan ${entries.length} entri jurnal dalam 7 hari terakhir`,
                options: { quoted: msg },
            });
        } catch (e) {
            await conn.sendMessage(chatId, { text: `📊 *Laporan Jurnal - 7 Hari Terakhir*\n\n${report}` }, { quoted: msg });
        }
    }
};
