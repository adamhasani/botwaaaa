import { processDocumentBuffer } from '../../toolkit/documentHandler.js';

const MEDIA_TYPES = ['documentMessage', 'imageMessage'];

async function downloadMedia(msg) {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    return downloadMediaMessage(msg, 'buffer', {});
}

function getMediaInfo(msg) {
    const msgType = Object.keys(msg.message || {})[0];
    if (!MEDIA_TYPES.includes(msgType)) return null;
    const mediaMsg = msg.message[msgType];
    const filename = mediaMsg?.fileName
        || (msgType === 'imageMessage' ? `gambar_${Date.now()}.jpg` : `dokumen_${Date.now()}`);
    return { msgType, mediaMsg, filename };
}

export default {
    name: 'bacadokumen',
    command: ['bacadokumen', 'baca', 'readdoc'],
    tags: 'AI & Simpanan',
    desc: 'Baca isi PDF/Word/Excel/gambar (OCR) — kirim file dengan caption ini, atau reply file dengan command ini. Tambah "simpan" buat nyimpen ke database.',
    prefix: true,

    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;
        const wantSave = args.some(a => a.toLowerCase() === 'simpan');

        // Cek dulu di pesan ini sendiri (caption), lalu di pesan yang di-reply.
        let target = getMediaInfo(msg);
        let sourceMsg = msg;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!target && quoted) {
            const quotedMsgType = Object.keys(quoted)[0];
            if (MEDIA_TYPES.includes(quotedMsgType)) {
                target = getMediaInfo({ message: quoted });
                sourceMsg = {
                    key: msg.message.extendedTextMessage.contextInfo,
                    message: quoted,
                };
            }
        }

        if (!target) {
            return conn.sendMessage(chatId, {
                text: '📎 Kirim file (PDF/Word/Excel/gambar) dengan caption *.bacadokumen*, atau reply file itu pakai command ini.\n\nTambahin *simpan* di belakang command kalau mau hasilnya disimpan ke database. Contoh: *.bacadokumen simpan*'
            }, { quoted: msg });
        }

        try {
            const buffer = await downloadMedia(sourceMsg);
            await processDocumentBuffer(conn, msg, {
                chatId,
                buffer,
                filename: target.filename,
                save: wantSave,
            });
        } catch (e) {
            await conn.sendMessage(chatId, { text: `⚠️ Gagal memproses file: ${e.message}` }, { quoted: msg });
        }
    }
};
