/* Cuaca — port dari get_info_cuaca() di bot.py */
import axios from 'axios';

export async function getInfoCuaca(kabupaten = 'tegal', kecamatan = 'dukuhturi', desa = 'kepandean') {
    try {
        const res = await axios.get('https://api-faa.my.id/faa/cuaca', {
            params: { kabupaten, kecamatan, desa },
            timeout: 10000,
        });
        const data = res.data;
        if (!data?.status) return '🌤️ Data cuaca tidak ditemukan.';
        let msg = `🌤️ *Cuaca ${desa}, ${kecamatan}, ${kabupaten}*\n\n`;
        for (const item of (data.cuaca || []).slice(0, 6)) {
            msg += `• *${item.jam || '-'}* : ${item.emoji || ''} ${item.deskripsi || ''} | 🌡️ ${item.instant?.air_temperature ?? '-'}°C | 💧 ${item.instant?.relative_humidity ?? '-'}%\n`;
        }
        return msg;
    } catch (e) {
        return `⚠️ Gagal mengambil cuaca dari API: ${e.message}`;
    }
}
