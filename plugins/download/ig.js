// 📂 Lokasi: .../download/ig.js
import axios from 'axios'
// Import wajib untuk fitur Carousel Geser
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'baileys'

const AIO = 'https://api-faa.my.id/faa/aio'

async function aioDownload(url) {
  const { data } = await axios.get(AIO, {
    params: { url },
    timeout: 20000
  })

  console.log('[AIO] Response:', JSON.stringify(data).substring(0, 1000))

  const medias = data?.result?.medias || data?.medias
    || data?.data?.medias || data?.data?.media
    || (data?.result?.url ? [{ url: data.result.url, type: 'video' }] : null)
    || (data?.data?.url   ? [{ url: data.data.url,   type: 'video' }] : null)
    || (data?.url         ? [{ url: data.url,        type: 'video' }] : null)

  if (!medias?.length) throw new Error(`Media tidak ditemukan | Response: ${JSON.stringify(data).substring(0, 150)}`)

  const title = data?.result?.title || data?.data?.title || data?.title || ''
  return { medias, title }
}

export default {
  name: 'instagram',
  command: ['instagram', 'ig', 'igdl', 'instegrem', 'insta'],
  tags: 'Download Menu',
  desc: 'Mengunduh video atau foto dari Instagram + Audio',
  prefix: !0,
  owner: !1,
  premium: !1,

  run: async (conn, msg, {
    chatInfo,
    args,
    prefix,
    commandText
  }) => {
    const { chatId } = chatInfo
    try {
      const rawUrl = Array.isArray(args) ? args[0] : args,
            // Bersihkan query string (?igsh=...) agar API tidak error
            url = rawUrl ? rawUrl.split('?')[0].replace(/\/$/, '') + '/' : rawUrl,
            invalidUrl = !args || !rawUrl || !rawUrl.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/[^\s]+/i)

      if (invalidUrl)
        return conn.sendMessage(chatId, { text: !args || !rawUrl ? `Masukkan URL Instagram! Contoh: *${prefix}${commandText} https://www.instagram.com/reel/xxxxx*` : 'URL tidak valid! Pastikan itu adalah tautan Instagram.' }, { quoted: msg })

      await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } })

      const { medias, title } = await aioDownload(url),
            total   = medias.length,
            isAlbum = total > 1 && medias.every(m => !m.type?.includes('video') && !m.url?.includes('.mp4') && !m.quality)

      // 1. CAROUSEL GESER (Album Foto)
      if (isAlbum) {
        await conn.sendMessage(chatId, { text: `🔄 Memproses ${total} foto...` }, { quoted: msg })

        const cards = []

        for (let i = 0; i < total; i++) {
          // Persiapkan media (upload ke server WA dulu)
          const mediaMessage = await prepareWAMessageMedia(
            { image: { url: medias[i].url } },
            { upload: conn.waUploadToServer }
          )

          // Buat Struktur Kartu
          cards.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
              text: `Foto ${i + 1}/${total}`
            }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
              text: title ? title.substring(0, 50) + '...' : 'Instagram'
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
              title: 'Instagram',
              hasMediaAttachment: !0,
              imageMessage: mediaMessage.imageMessage
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              buttons: []
            })
          })
        }

        // Bungkus kartu ke dalam Pesan Carousel
        const msgContent = generateWAMessageFromContent(chatId, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2
              },
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({
                  text: `✅ *INSTAGRAM ALBUM*\n\n${title ? title + '\n\n' : ''}Total: ${total} Foto\n\n_Geser ke samping untuk melihat foto!_`
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                  text: 'Instagram Downloader by Bot'
                }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                  hasMediaAttachment: !1
                }),
                carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                  cards
                })
              })
            }
          }
        }, { quoted: msg })

        // Kirim menggunakan relayMessage (Wajib untuk tipe Interactive)
        await conn.relayMessage(chatId, msgContent.message, { messageId: msgContent.key.id })

      // 2. VIDEO / FOTO TUNGGAL
      } else {
        for (let i = 0; i < total; i++) {
          const item    = medias[i],
                isVideo = item.type?.includes('video') || item.url?.includes('.mp4') || item.quality,
                caption = `📸 *Instagram*${title ? '\n' + title : ''}${total > 1 ? `\n(${i + 1}/${total})` : ''}\n_via The Archive Lite_`

          if (isVideo) {
            // Kirim Video
            await conn.sendMessage(chatId, {
              video: { url: item.url },
              mimetype: 'video/mp4',
              caption
            }, { quoted: msg })

            // Kirim Audio
            await conn.sendMessage(chatId, {
              audio: { url: item.url },
              mimetype: 'audio/mp4',
              ptt: !1
            }, { quoted: msg })
          } else {
            // Kirim Foto Tunggal
            await conn.sendMessage(chatId, {
              image: { url: item.url },
              caption
            }, { quoted: msg })
          }
        }
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

    } catch (e) {
      console.error(e) // Print error ke console agar mudah debug
      await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
      conn.sendMessage(msg.key.remoteJid, { text: `Terjadi kesalahan saat memproses permintaan. Coba lagi nanti!\n_${e.message}_` }, { quoted: msg })
    }
  }
}