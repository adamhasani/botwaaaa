import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import stg from '../../toolkit/setting.js';
import { readDb } from '../../scheduler/deadline_reminder.js';

const API          = 'https://api.edlink.id/api/v1.4';
const PILIHAN_PATH = path.join(stg.dbDir, 'kumpul_session.json');

function headers() {
    return {
        'Authorization': `Bearer ${process.env.EDLINK_TOKEN}`,
        'Accept': 'application/json',
        'x-app-locale': 'id',
        'Origin': 'https://edlink.id',
        'Referer': 'https://edlink.id/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
}

function readSession() {
    try { return fs.existsSync(PILIHAN_PATH) ? JSON.parse(fs.readFileSync(PILIHAN_PATH, 'utf-8')) : {}; }
    catch { return {}; }
}
function saveSession(d) { try { fs.writeFileSync(PILIHAN_PATH, JSON.stringify(d, null, 2)); } catch {} }

async function uploadMedia(fileBuffer, fileName, groupId) {
    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });
    form.append('group_id', String(groupId));

    const res = await axios.post(`${API}/media/upload`, form, {
        headers: { ...headers(), ...form.getHeaders() },
        timeout: 60000,
        validateStatus: () => true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });

    if (res.data?.applicationSystem?.code === 2) throw new Error('Token expired — jalankan .syncjadwal dulu');
    if (res.status >= 400) throw new Error(`Upload gagal (HTTP ${res.status})`);

    const ids = res.data?.data?.ids || [];
    if (!ids.length) throw new Error('Upload berhasil tapi media_id tidak ditemukan');
    return ids;
}

async function submitJawaban(postId, mediaIds, answerText = '') {
    const res = await axios.post(
        `${API}/lecturer-question/set-answer/${postId}`,
        { id: null, media_ids: mediaIds, answer: answerText },
        { headers: headers(), timeout: 15000, validateStatus: () => true }
    );

    if (res.data?.applicationSystem?.code === 2) throw new Error('Token expired');
    if (res.status >= 400) throw new Error(`Submit gagal (HTTP ${res.status})`);
    return res.data;
}

async function downloadMedia(conn, msg) {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    return await downloadMediaMessage(msg, 'buffer', {});
}

// Ambil tugas edlink dari deadlines.json yang punya edlink_id & group_id
function getTugasEdlink() {
    const db  = readDb();
    const now = moment().tz(stg.timezone);
    return Object.entries(db)
        .filter(([, d]) => d.source === 'edlink' && d.edlink_id && d.group_id && moment(d.deadline).isAfter(now))
        .map(([name, d]) => {
            const clean = name.replace(/^\[Edlink\]\s*/, '').trim();
            const matkul = (d.description?.match(/Mata Kuliah:\s*(.+?)\s*\|/) || [])[1] || '';
            return { name: clean, matkul, postId: d.edlink_id, groupId: d.group_id, deadline: moment(d.deadline) };
        })
        .sort((a, b) => a.deadline - b.deadline);
}

export default {
    name: 'kumpultugas',
    command: ['kumpultugas', 'kumpul', 'submittugas'],
    tags: 'Tugas',
    desc: 'Kumpulkan tugas ke Edlink',
    owner: true,
    prefix: true,

    /*
     * Cara pakai:
     *
     * 1. Ketik .kumpul → bot tampilkan daftar tugas aktif
     * 2. Kirim file dengan caption .kumpul <nomor>
     *    Contoh: .kumpul 1
     * 3. Bot upload file & submit jawaban ke Edlink
     *
     * Opsional tambah teks jawaban:
     *   .kumpul 1 | Ini teks jawaban saya
     */
    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;
        const msgType    = Object.keys(msg.message || {})[0];
        const isMedia    = ['documentMessage', 'imageMessage', 'videoMessage', 'audioMessage'].includes(msgType);
        const arg0       = args[0];
        const nomorPilih = arg0 && /^\d+$/.test(arg0) ? parseInt(arg0) : null;

        // ── KASUS: Ada file + nomor → submit ──
        if (isMedia && nomorPilih) {
            const session = readSession();
            const list    = session[chatId];

            if (!list || !list[nomorPilih - 1]) {
                return conn.sendMessage(chatId, {
                    text: `❌ Sesi tidak ditemukan atau nomor salah.\nKetik *.kumpul* dulu untuk lihat daftar tugas.`
                }, { quoted: msg });
            }

            const tugas = list[nomorPilih - 1];
            const restArgs = args.slice(1).join(' ').replace(/^\|?\s*/, '').trim();

            await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            try {
                await conn.sendMessage(chatId, { text: '📥 Mendownload file...' }, { quoted: msg });
                const fileBuffer = await downloadMedia(conn, msg);
                const mediaMsg   = msg.message[msgType];
                const fileName   = mediaMsg?.fileName || mediaMsg?.title || `tugas_${Date.now()}.pdf`;

                await conn.sendMessage(chatId, {
                    text: `📤 Mengupload *${fileName}*...\n📚 ${tugas.name}`
                }, { quoted: msg });
                const mediaIds = await uploadMedia(fileBuffer, fileName, tugas.groupId);

                await conn.sendMessage(chatId, { text: '📝 Mengumpulkan jawaban...' }, { quoted: msg });
                await submitJawaban(tugas.postId, mediaIds, restArgs);

                await conn.sendMessage(chatId, {
                    text: `✅ *Tugas berhasil dikumpulkan!*\n\n`
                        + `📎 *${fileName}*\n`
                        + `📚 ${tugas.name}\n`
                        + `🎓 ${tugas.matkul}\n`
                        + (restArgs ? `📝 "${restArgs}"\n` : '')
                        + `\n_Cek di Edlink untuk konfirmasi_`
                }, { quoted: msg });
                await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                await conn.sendMessage(chatId, {
                    text: `❌ *Gagal mengumpulkan tugas*\n\nDetail: ${e.message}`
                }, { quoted: msg });
                await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            }
            return;
        }

        // ── KASUS: Tidak ada file / ketik .kumpul saja → tampilkan daftar ──
        const list = getTugasEdlink();

        if (list.length === 0) {
            return conn.sendMessage(chatId, {
                text: `✅ Tidak ada tugas Edlink yang aktif di database.\n\n_Coba *.syncjadwal* untuk sync tugas terbaru._`
            }, { quoted: msg });
        }

        // Simpan session per chatId
        const session = readSession();
        session[chatId] = list;
        saveSession(session);

        const now = moment().tz(stg.timezone);
        let txt = `📋 *DAFTAR TUGAS AKTIF*\n${'━'.repeat(22)}\n\n`;
        list.forEach((t, i) => {
            const sisa = t.deadline.diff(now, 'hours');
            const ind  = sisa <= 24 ? '🔴' : sisa <= 72 ? '🟡' : '🟢';
            txt += `${ind} *${i + 1}. ${t.name}*\n`;
            txt += `   📚 ${t.matkul}\n`;
            txt += `   ⏳ ${t.deadline.format('DD MMM YYYY HH:mm')} WIB\n\n`;
        });
        txt += `${'━'.repeat(22)}\n`;
        txt += `_Kirim file dengan caption:_\n*.kumpul <nomor>*\n\nContoh: \`.kumpul 1\``;

        return conn.sendMessage(chatId, { text: txt }, { quoted: msg });
    }
};