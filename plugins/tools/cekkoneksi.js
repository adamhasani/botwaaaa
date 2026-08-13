import axios from 'axios';

const TARGETS = [
    { label: 'edlink.id (web)',    url: 'https://edlink.id',             auth: false },
    { label: 'api.edlink.id',      url: 'https://api.edlink.id',         auth: false },
    { label: 'API /me (token cek)', url: 'https://api.edlink.id/me',     auth: true  },
];

async function ping(url, token = null) {
    const start = Date.now();
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await axios.get(url, {
            headers,
            timeout: 8000,
            validateStatus: () => true, // jangan throw di 4xx/5xx
        });

        return {
            ok: res.status < 500,
            status: res.status,
            latency: Date.now() - start,
        };
    } catch (e) {
        return {
            ok: false,
            status: null,
            latency: Date.now() - start,
            error: e.code || e.message,
        };
    }
}

function statusIcon(result, isAuth = false) {
    if (!result.ok) return '🔴';
    if (isAuth && result.status === 401) return '🟡'; // nyambung tapi token salah
    if (isAuth && result.status === 200) return '🟢';
    if (result.status < 300) return '🟢';
    return '🟡';
}

function tokenStatus(result) {
    if (!result.ok || result.status === null) return '❌ Tidak terjangkau';
    if (result.status === 200) return '✅ Valid';
    if (result.status === 401) return '⚠️ Token expired / salah';
    if (result.status === 403) return '🚫 Akses ditolak';
    return `❓ Status ${result.status}`;
}

export default {
    name: 'cekkoneksi',
    command: ['cekkoneksi', 'ceknet', 'edlinkping'],
    tags: 'Owner',
    desc: 'Cek koneksi VPS ke Edlink',
    prefix: true,
    owner: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;
        const token = process.env.EDLINK_TOKEN || null;

        // Kirim pesan loading dulu
        await conn.sendMessage(chatId, {
            text: '🔍 _Mengecek koneksi ke Edlink..._'
        }, { quoted: msg });

        // Ping semua target paralel
        const results = await Promise.all(
            TARGETS.map(t => ping(t.url, t.auth ? token : null))
        );

        // Cek token ada atau tidak
        const tokenInfo = token
            ? `\`${token.substring(0, 8)}...${token.slice(-6)}\``
            : '_(belum diset di .env)_';

        // Build pesan
        let text = `🌐 *CEK KONEKSI EDLINK*\n${'─'.repeat(28)}\n\n`;

        TARGETS.forEach((t, i) => {
            const r = results[i];
            const icon = statusIcon(r, t.auth);
            const latency = r.latency ? `${r.latency}ms` : '-';
            const info = r.error
                ? `❌ ${r.error}`
                : t.auth
                    ? tokenStatus(r)
                    : `HTTP ${r.status} • ${latency}`;

            text += `${icon} *${t.label}*\n   ${info}\n`;
            if (!t.auth && r.ok) text += `   ⚡ Latensi: ${latency}\n`;
            text += '\n';
        });

        text += `${'─'.repeat(28)}\n`;
        text += `🔑 Token: ${tokenInfo}\n`;

        // Ringkasan status keseluruhan
        const koneksiOk = results[0].ok && results[1].ok;
        const tokenOk   = results[2].ok && results[2].status === 200;

        if (!koneksiOk) {
            text += '\n⛔ *VPS tidak bisa menjangkau Edlink.*\nCek firewall atau DNS VPS kamu.';
        } else if (!token) {
            text += '\n⚠️ *Koneksi OK tapi token belum diset.*\nGunakan `.updatetoken` atau set di .env.';
        } else if (!tokenOk) {
            text += '\n⚠️ *Koneksi OK tapi token bermasalah.*\nGunakan `.updatetoken` untuk ganti token.';
        } else {
            text += '\n✅ *Semua OK! VPS bisa sync ke Edlink.*';
        }

        await conn.sendMessage(chatId, { text }, { quoted: msg });
    }
};