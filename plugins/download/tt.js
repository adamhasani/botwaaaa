// 📂 Lokasi: .../download/tt.js
import axios from "axios"

const AUDIO_API = "https://api-faa.my.id/faa/tiktok"
const AIO       = "https://api-faa.my.id/faa/aio"

async function getAudioFromAPI(tiktokUrl) {
  const { data } = await axios.get(
    `${AUDIO_API}?url=${encodeURIComponent(tiktokUrl)}`
  )
  if (!data?.result?.music_info?.url) throw new Error("Audio API gagal")
  return data.result.music_info.url
}

async function aioDownload(url) {
  const { data } = await axios.get(AIO, {
    params: { url },
    timeout: 20000
  })

  console.log("[AIO] Response:", JSON.stringify(data).substring(0, 300))

  const medias = data?.result?.medias || data?.medias
    || data?.data?.medias || data?.data?.media
    || (data?.result?.url ? [{ url: data.result.url, type: "video" }] : null)
    || (data?.data?.url   ? [{ url: data.data.url,   type: "video" }] : null)
    || (data?.url         ? [{ url: data.url,        type: "video" }] : null)

  if (!medias?.length) throw new Error(`Media tidak ditemukan | Response: ${JSON.stringify(data).substring(0, 150)}`)

  const title = data?.result?.title || data?.data?.title || data?.title || ""
  return { medias, title }
}

export default {
  name: "tiktok",
  command: ["tiktok", "tt", "ttdl"],
  tags: "Download Menu",
  desc: "Download TikTok video tanpa watermark + audio",
  prefix: !0,
  owner: !1,
  premium: !1,

  run: async (conn, msg, { chatInfo, prefix, commandText, args }) => {
    const { chatId } = chatInfo,
          url = Array.isArray(args) ? args[0] : args

    if (!args || !url)
      return conn.sendMessage(chatId, { text: `Masukkan URL TikTok! Contoh: *${prefix + commandText} https://vt.tiktok.com/xxxxxx*` }, { quoted: msg })
    if (!url.includes("tiktok.com"))
      return conn.sendMessage(chatId, { text: "URL tidak valid! Pastikan itu adalah tautan TikTok." }, { quoted: msg })

    await conn.sendMessage(chatId, { react: { text: "⌛", key: msg.key } })

    try {
      const { medias, title } = await aioDownload(url),
            noWm    = medias.find(m => m.quality?.toLowerCase().includes("no watermark") || m.type === "nowm") || medias[0],
            caption = `🎵 *TikTok*${title ? "\n" + title : ""}\n_via The Archive Lite_`

      // 1. Kirim Video
      await conn.sendMessage(chatId, {
        video: { url: noWm.url },
        mimetype: "video/mp4",
        caption
      }, { quoted: msg })

      // 2. Kirim Audio dari AUDIO_API
      try {
        const audioUrl = await getAudioFromAPI(url)
        await conn.sendMessage(chatId, {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: !1
        }, { quoted: msg })
      } catch {
        // Audio gagal skip aja
        const audio = medias.find(m => m.type === "audio" || m.quality?.toLowerCase().includes("audio"))
        if (audio)
          await conn.sendMessage(chatId, {
            audio: { url: audio.url },
            mimetype: "audio/mpeg",
            ptt: !1
          }, { quoted: msg })
      }

      await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

    } catch (e) {
      console.error(e) // Print error ke console agar mudah debug
      await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
      conn.sendMessage(msg.key.remoteJid, { text: `Terjadi kesalahan saat memproses permintaan. Coba lagi nanti!\n_${e.message}_` }, { quoted: msg })
    }
  }
}