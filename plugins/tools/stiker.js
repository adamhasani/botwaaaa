import fs from 'fs';
import axios from 'axios';
import { downloadContentFromMessage } from 'baileys';
import { writeExifImg, writeExifVid } from '../../toolkit/exif.js';

export default {
    name: 'stiker',
    command: ['s', 'stiker', 'sticker'],
    tags: 'Tools Menu',
    desc: 'Membuat sticker',
    prefix: true,
    owner: false,

    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;
        const ctx    = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        const isQuotedImage = quoted?.imageMessage;
        const isQuotedVideo = quoted?.videoMessage;
        const isDirectImage = msg.message?.imageMessage;
        const isDirectVideo = msg.message?.videoMessage;

        let media, isVideo = false;

        // Helper download pakai downloadContentFromMessage
        async function dlContent(msgObj, type) {
            const stream = await downloadContentFromMessage(msgObj, type);
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer;
        }

        try {
            console.log('[Stiker] Mulai...');

            if (args[0]?.startsWith('http')) {
                await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
                const { data } = await axios.get(args[0], { responseType: 'arraybuffer', timeout: 15000 });
                media = Buffer.from(data);

            } else if (isQuotedImage || isQuotedVideo) {
                isVideo = !!isQuotedVideo;
                const mediaMsg = isQuotedImage ? quoted.imageMessage : quoted.videoMessage;
                console.log('[Stiker] Download quoted', isVideo ? 'video' : 'image', '...');
                media = await dlContent(mediaMsg, isVideo ? 'video' : 'image');

            } else if (isDirectImage || isDirectVideo) {
                isVideo = !!isDirectVideo;
                const mediaMsg = isDirectImage ? msg.message.imageMessage : msg.message.videoMessage;
                console.log('[Stiker] Download direct', isVideo ? 'video' : 'image', '...');
                media = await dlContent(mediaMsg, isVideo ? 'video' : 'image');

            } else {
                return conn.sendMessage(chatId, {
                    text: '⚠️ Balas gambar/video atau kirim link!\nContoh: *.s https://link.com/foto.jpg*'
                }, { quoted: msg });
            }

            console.log('[Stiker] Media size:', media?.length);
            if (!media?.length) throw new Error('Media kosong');

            const topGap   = '\u200E\n'.repeat(20);
            const botGap   = '\u200E\n'.repeat(20);
            const packName = (global.packname || 'Sains Data AI')
                + topGap + '🤪 MAU NYOLONG YA?? KASIAN WKWK 🤪'
                + botGap + 'Tuh tombol savenya di bawah, scroll lagi! 😜';
            const meta = { packname: packName, author: msg.pushName || 'User' };

            console.log('[Stiker] Proses exif...');
            const stickerPath = isVideo ? await writeExifVid(media, meta) : await writeExifImg(media, meta);
            console.log('[Stiker] stickerPath:', stickerPath);
            if (!stickerPath) throw new Error('writeExif gagal');

            const stickerBuffer = fs.readFileSync(stickerPath);
            await conn.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });
            console.log('[Stiker] ✅ Berhasil');

            // [FITUR] Info singkat ukuran & tipe — dikirim terpisah karena WA gak
            // support caption pada pesan sticker.
            const sizeKb = (stickerBuffer.length / 1024).toFixed(1);
            conn.sendMessage(chatId, {
                text: `_✨ Stiker ${isVideo ? 'animasi' : 'gambar'} — ${sizeKb} KB_`
            }, { quoted: msg }).catch(() => {});

            try { fs.unlinkSync(stickerPath); } catch {}

        } catch (e) {
            console.error('[Stiker] ❌', e.message);
            await conn.sendMessage(chatId, {
                text: `❌ Gagal buat stiker!\n_${e.message}_`
            }, { quoted: msg }).catch(() => {});
        }
    }
};