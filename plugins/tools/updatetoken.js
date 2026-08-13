import fs from 'fs';
import path from 'path';
import stg from '../../toolkit/setting.js';

const envPath = path.join(stg.rootDir, '.env');

function readEnv() {
    try {
        if (!fs.existsSync(envPath)) return {};
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        const env = {};
        for (const line of lines) {
            const [key, ...vals] = line.split('=');
            if (key && vals.length) env[key.trim()] = vals.join('=').trim();
        }
        return env;
    } catch { return {}; }
}

function writeEnv(envObj) {
    const content = Object.entries(envObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    fs.writeFileSync(envPath, content + '\n');
}

export default {
    name: 'updatetoken',
    command: ['updatetoken', 'settoken'],
    tags: 'Owner',
    desc: 'Update token Edlink via WA',
    prefix: true,
    owner: true, // hanya owner yang bisa

    run: async (conn, msg, { chatInfo, args, prefix, commandText }) => {
        const { chatId } = chatInfo;
        const token = args.join(' ').trim()
            .replace(/^Bearer\s+/i, ''); // hapus "Bearer " kalau ikut kesalin

        if (!token) {
            return conn.sendMessage(chatId, {
                text: `❌ Masukkan token!\n\n*Cara dapat token:*\n1. Buka edlink.id (sudah login)\n2. F12 → Network → filter *api*\n3. Klik request apapun → Headers\n4. Copy value *authorization* (tanpa kata Bearer)\n\n*Format:*\n*${prefix}${commandText} tokenmu disini*`
            }, { quoted: msg });
        }

        if (token.length < 20) {
            return conn.sendMessage(chatId, {
                text: '❌ Token terlalu pendek, pastikan copy yang benar!'
            }, { quoted: msg });
        }

        try {
            // Baca .env yang ada
            const env = readEnv();

            // Update token
            env['EDLINK_TOKEN'] = token;

            // Simpan balik
            writeEnv(env);

            // Update juga di process.env biar langsung aktif tanpa restart
            process.env.EDLINK_TOKEN = token;

            const preview = token.substring(0, 10) + '...' + token.substring(token.length - 6);

            await conn.sendMessage(chatId, {
                text: `✅ *Token Edlink berhasil diupdate!*\n\n🔑 Token: \`${preview}\`\n⏰ Berlaku: ~7 jam\n\n_Langsung bisa dipakai, tidak perlu restart bot._\n_Coba .edlinksync sekarang!_`
            }, { quoted: msg });

        } catch (e) {
            await conn.sendMessage(chatId, {
                text: `❌ Gagal update token: ${e.message}`
            }, { quoted: msg });
        }
    }
};
