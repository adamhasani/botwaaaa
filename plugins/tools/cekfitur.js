import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import { sendScheduleOnStartup, runDailySchedule } from '../../scheduler/daily_schedule.js';
import { readDb, formatSisa } from '../../scheduler/deadline_reminder.js';

const dbPath     = path.join(stg.dbDir, 'deadlines.json');
const weeklyPath = path.join(stg.dbDir, 'weekly_schedule.json');
const sentPath   = path.join(stg.dbDir, 'schedule_sent.json');
const stikerPath = path.join(stg.dbDir, 'stiker.json');
const stikerLogPath = path.join(stg.dbDir, 'stiker_sent.json');

export default {
    name: 'cekfitur',
    command: ['cekfitur', 'tesfitur', 'testfitur'],
    tags: 'Tools',
    desc: 'Cek & tes notif fitur terjadwal. Contoh: .cekfitur jadwal | .cekfitur deadline | .cekfitur kelas',
    owner: true,
    prefix: true,

    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;
        const fitur = args[0]?.toLowerCase();

        if (!fitur) {
            const help = `🔧 *CEK FITUR*\n\n`
                + `Paksa kirim notif sekarang untuk testing.\n\n`
                + `*Tersedia:*\n`
                + `• \`.cekfitur jadwal\` — kirim jadwal hari ini\n`
                + `• \`.cekfitur deadline\` — kirim reminder semua deadline aktif\n`
                + `• \`.cekfitur kelas\` — kirim info kelas berikutnya hari ini\n`
                + `• \`.cekfitur stiker\` — tes kirim stiker random ke target\n`
                + `• \`.cekfitur status\` — cek status semua fitur`;
            return conn.sendMessage(chatId, { text: help }, { quoted: msg });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        // ── JADWAL ──
        if (fitur === 'jadwal') {
            try {
                // Reset lastSentDate biar bisa kirim ulang
                if (fs.existsSync(sentPath)) {
                    const sent = JSON.parse(fs.readFileSync(sentPath, 'utf-8'));
                    sent.lastSentDate = null;
                    fs.writeFileSync(sentPath, JSON.stringify(sent));
                }

                await sendScheduleOnStartup(conn);
                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                await conn.sendMessage(chatId, { text: '✅ Notif jadwal berhasil dikirim!' }, { quoted: msg });
            } catch (e) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                await conn.sendMessage(chatId, { text: `❌ Gagal: ${e.message}` }, { quoted: msg });
            }
        }

        // ── DEADLINE ──
        else if (fitur === 'deadline') {
            const db = readDb();
            const now = moment().tz(stg.timezone);
            const tasks = Object.entries(db)
                .map(([name, data]) => ({ name, ...data, dl: moment(data.deadline).tz(stg.timezone) }))
                .filter(t => t.dl.isAfter(now))
                .sort((a, b) => a.dl.diff(b.dl));

            if (tasks.length === 0) {
                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return conn.sendMessage(chatId, { text: '🎉 Tidak ada deadline aktif saat ini!' }, { quoted: msg });
            }

            const target = process.env.REMINDER_TARGET || chatId;
            let msg2 = `🔔 *TES NOTIF DEADLINE*\n_${tasks.length} tugas aktif_\n${'━'.repeat(20)}\n\n`;

            tasks.forEach((t, i) => {
                const sisa = t.dl.diff(now);
                const urgent = sisa < 86400000 ? '🔴' : sisa < 259200000 ? '🟡' : '🟢';
                msg2 += `${urgent} *${i + 1}. ${t.name}*\n`;
                msg2 += `   📅 ${t.dl.format('ddd, DD MMM YYYY • HH:mm')} WIB\n`;
                msg2 += `   ⏳ Sisa: _${formatSisa(sisa)}_\n\n`;
            });

            msg2 += `${'━'.repeat(20)}\n🟢 Aman  🟡 < 3 hari  🔴 < 1 hari`;

            await conn.sendMessage(target, { text: msg2 });
            await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
            if (target !== chatId) {
                await conn.sendMessage(chatId, { text: '✅ Notif deadline berhasil dikirim ke target!' }, { quoted: msg });
            }
        }

        // ── KELAS ──
        else if (fitur === 'kelas') {
            const now = moment().tz(stg.timezone);
            const todayStr = now.format('YYYY-MM-DD');

            if (!fs.existsSync(weeklyPath)) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return conn.sendMessage(chatId, { text: '❌ DB jadwal kosong — jalankan sync.js dulu!' }, { quoted: msg });
            }

            const db = JSON.parse(fs.readFileSync(weeklyPath, 'utf-8'));
            const todayData = db?.data?.find(d => d.date === todayStr);

            if (!todayData?.sections?.length) {
                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return conn.sendMessage(chatId, { text: '✅ Tidak ada kelas hari ini!' }, { quoted: msg });
            }

            // Cari kelas berikutnya
            const berikutnya = todayData.sections
                .filter(s => moment.tz(s.startedAt, stg.timezone).isAfter(now))
                .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];

            const target = process.env.REMINDER_TARGET || chatId;

            if (!berikutnya) {
                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return conn.sendMessage(chatId, { text: '✅ Tidak ada kelas lagi hari ini!' }, { quoted: msg });
            }

            const start = moment.tz(berikutnya.startedAt, stg.timezone);
            const end   = moment.tz(berikutnya.endedAt, stg.timezone);
            const menit = start.diff(now, 'minutes');
            const method = berikutnya.learningMethod === 'Offline' ? '🏫' : '💻';
            const topic  = berikutnya.topic && berikutnya.topic !== '-' ? `\n📖 _${berikutnya.topic}_` : '';

            const notif = `⏰ *TES NOTIF KELAS*\n\n`
                + `📚 *${berikutnya.group.name}* (${berikutnya.group.className})\n`
                + `${method} ${berikutnya.room}\n`
                + `🕐 ${start.format('HH:mm')} – ${end.format('HH:mm')} WIB\n`
                + `⏳ ${menit > 0 ? `${menit} menit lagi` : 'Sedang berlangsung!'}`
                + `${topic}`;

            await conn.sendMessage(target, { text: notif });
            await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
            if (target !== chatId) {
                await conn.sendMessage(chatId, { text: '✅ Notif kelas berhasil dikirim ke target!' }, { quoted: msg });
            }
        }

        // ── STATUS ──
        else if (fitur === 'status') {
            const now = moment().tz(stg.timezone);

            // Cek jadwal DB
            let jadwalStatus = '❌ Belum ada — jalankan sync.js';
            if (fs.existsSync(weeklyPath)) {
                const db = JSON.parse(fs.readFileSync(weeklyPath, 'utf-8'));
                const hariAda = db?.data?.filter(d => d.sections?.length > 0).length || 0;
                const fetchedAt = db?.fetchedAt ? moment(db.fetchedAt).format('DD MMM YYYY HH:mm') : '?';
                jadwalStatus = `✅ ${hariAda} hari ada kelas (diambil ${fetchedAt})`;
            }

            // Cek deadline DB
            let deadlineStatus = '❌ Belum ada';
            if (fs.existsSync(dbPath)) {
                const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
                const aktif = Object.values(db).filter(t => moment(t.deadline).isAfter(now)).length;
                deadlineStatus = `✅ ${aktif} tugas aktif`;
            }

            // Cek last sent
            let lastSent = 'Belum pernah';
            if (fs.existsSync(sentPath)) {
                const sent = JSON.parse(fs.readFileSync(sentPath, 'utf-8'));
                if (sent.lastSentDate) lastSent = sent.lastSentDate;
            }

            const status = `🔧 *STATUS FITUR*\n`
                + `${'━'.repeat(20)}\n\n`
                + `📅 *Jadwal DB*\n   ${jadwalStatus}\n\n`
                + `⏰ *Deadline DB*\n   ${deadlineStatus}\n\n`
                + `📤 *Jadwal terakhir dikirim*\n   ${lastSent}\n\n`
                + `🎯 *Target notif*\n   ${process.env.REMINDER_TARGET || '❌ Belum diset'}\n\n`
                + `${'━'.repeat(20)}\n`
                + `_Gunakan .cekfitur <jadwal/deadline/kelas/stiker> untuk tes notif_`;

            await conn.sendMessage(chatId, { text: status }, { quoted: msg });
            await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        }

        // ── STIKER ──
        else if (fitur === 'stiker') {
            if (!fs.existsSync(stikerPath)) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return conn.sendMessage(chatId, { text: '❌ DB stiker kosong — tambah dulu pakai .addstiker' }, { quoted: msg });
            }

            const stickers = JSON.parse(fs.readFileSync(stikerPath, 'utf-8'));
            if (stickers.length === 0) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return conn.sendMessage(chatId, { text: '❌ Koleksi stiker kosong — tambah dulu pakai .addstiker' }, { quoted: msg });
            }

            const stiker = stickers[Math.floor(Math.random() * stickers.length)];

            if (!stiker.filePath || !fs.existsSync(stiker.filePath)) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return conn.sendMessage(chatId, {
                    text: `❌ File stiker tidak ditemukan.\nCoba hapus koleksi lama dan tambah ulang pakai .addstiker`
                }, { quoted: msg });
            }

            const stikerBuffer = fs.readFileSync(stiker.filePath);

            try {
                await conn.sendMessage(chatId, { sticker: stikerBuffer });

                let logInfo = 'Belum pernah terkirim otomatis';
                if (fs.existsSync(stikerLogPath)) {
                    const log = JSON.parse(fs.readFileSync(stikerLogPath, 'utf-8'));
                    if (log.lastSentDate) logInfo = `Terakhir otomatis: ${log.lastSentDate} jam ${log.jam}.${String(log.menit).padStart(2,'0')}`;
                }

                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                await conn.sendMessage(chatId, {
                    text: `✅ *Tes stiker berhasil!*\n\n`
                        + `📦 Koleksi: *${stickers.length} stiker*\n`
                        + `📅 ${logInfo}`
                }, { quoted: msg });
            } catch (e) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                await conn.sendMessage(chatId, { text: `❌ Gagal kirim stiker: ${e.message}` }, { quoted: msg });
            }
        }

        else {
            await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await conn.sendMessage(chatId, {
                text: `❌ Fitur *${fitur}* tidak dikenali.\n\nPilihan: \`jadwal\`, \`deadline\`, \`kelas\`, \`stiker\`, \`status\``
            }, { quoted: msg });
        }
    }
};