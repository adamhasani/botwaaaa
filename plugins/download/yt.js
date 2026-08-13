import axios from 'axios';

const AIO = 'https://api-faa.my.id/faa/aio';

async function aioDownload(url) {
    const { data } = await axios.get(AIO, { params: { url }, timeout: 20000 });
    console.log('[AIO] Response:', JSON.stringify(data).substring(0, 300));

    const medias = data?.result?.medias || data?.medias
        || data?.data?.medias || data?.data?.media
        || (data?.result?.url ? [{ url: data.result.url, type: 'video' }] : null)
        || (data?.data?.url   ? [{ url: data.data.url,   type: 'video' }] : null)
        || (data?.url         ? [{ url: data.url,        type: 'video' }] : null);

    if (!medias?.length) throw new Error(`Media tidak ditemukan | Response: ${JSON.stringify(data).substring(0,150)}`);
    const title = data?.result?.title || data?.data?.title || data?.title || '';
    const thumbnail = data?.result?.thumbnail || data?.data?.thumbnail || '';
    return { medias, title, thumbnail };
}

export default {
    name: 'youtube',
    command: ['yt', 'ytdl', 'youtube'],
    tags: 'Downloader',
    desc: 'Download video/audio YouTube',
    prefix: true,

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const input = args.join(' ');

        if (!input) {
            return conn.sendMessage(chatId, {
                text: `❌ Masukkan link YouTube!\nContoh: *${prefix}${commandText} https://youtu.be/xxxxx*`
            }, { quoted: msg });
        }

        const ytRegex = /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i;
        if (!ytRegex.test(input)) {
            return conn.sendMessage(chatId, {
                text: `❌ Link YouTube tidak valid!`
            }, { quoted: msg });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        try {
            const { medias, title, thumbnail } = await aioDownload(input);

            // Pilih kualitas video terbaik yang ada (360p/480p/720p)
            const video = medias.find(m => m.quality?.includes('360') || m.type === 'video')
                || medias.find(m => !m.type?.includes('audio'))
                || medias[0];

            const audio = medias.find(m => m.type === 'audio' || m.quality?.toLowerCase().includes('audio') || m.quality?.includes('128'));

            const caption = `🎬 *${title || 'YouTube'}*\n_via The Archive Lite_`;

            if (video) {
                await conn.sendMessage(chatId, {
                    video: { url: video.url }, mimetype: 'video/mp4', caption
                }, { quoted: msg });
            }

            if (audio) {
                await conn.sendMessage(chatId, {
                    audio: { url: audio.url }, mimetype: 'audio/mpeg', ptt: false
                }, { quoted: msg });
            }

            await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        } catch (e) {
            await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await conn.sendMessage(chatId, { text: `❌ Gagal download!\n_${e.message}_` }, { quoted: msg });
        }
    }
};