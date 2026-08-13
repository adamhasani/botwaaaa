import * as db from '../toolkit/simpananDb.js';
import chalk from 'chalk';

// Dipanggil tiap menit dari main.js (WA) DAN telegram.js — aman dipanggil dobel
// karena reminder ditandai `done` setelah terkirim sekali.
export async function runDueRemindersOnce({ telegramConn, waConn }) {
    let due = [];
    try {
        due = db.getDueReminders();
    } catch (e) {
        console.error(chalk.red(`[SCHEDULER] gagal baca reminder: ${e.message}`));
        return;
    }

    for (const r of due) {
        try {
            const text = `⏰ *Pengingat!*\n\n${r.text}`;
            if (r.platform === 'telegram' && telegramConn) {
                await telegramConn.sendMessage(r.chat_id, { text });
            } else if (r.platform === 'wa' && waConn) {
                await waConn.sendMessage(r.chat_id, { text });
            }
            db.markReminderDone(r.id, r.is_recurring, r.remind_at);
        } catch (e) {
            console.error(chalk.red(`[SCHEDULER] gagal kirim reminder #${r.id}: ${e.message}`));
        }
    }
}

// Morning briefing jam 07:00 — dikirim ke semua user yang pernah chat
let lastBriefingDate = null;
export async function runMorningBriefingOnce({ telegramConn, waConn }) {
    const now = new Date();
    const jakartaHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(now));
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

    if (jakartaHour !== 7 || lastBriefingDate === todayStr) return;
    lastBriefingDate = todayStr;

    const { getInfoCuaca } = await import('../toolkit/weather.js');
    let cuacaRingkas = '';
    try { cuacaRingkas = (await getInfoCuaca()).split('\n\n')[0]; } catch {}

    const users = db.getAllUsers();
    for (const u of users) {
        const text = `☀️ *Selamat pagi! Ini ringkasan hari ini:*\n\n${cuacaRingkas}`;
        try {
            if (u.platform === 'telegram' && telegramConn) await telegramConn.sendMessage(u.chat_id, { text });
            if (u.platform === 'wa' && waConn) await waConn.sendMessage(u.chat_id, { text });
        } catch (e) {
            console.error(chalk.red(`[MORNING] gagal kirim ke ${u.platform}:${u.chat_id} — ${e.message}`));
        }
    }
}
