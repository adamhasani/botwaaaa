/* ╔══════════════════════════════════════════╗
   ║  EDLINK AUTO TOKEN REFRESHER            ║
   ║  Login via API asli — tanpa browser     ║
   ╚══════════════════════════════════════════╝ */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const envPath    = path.join(__dirname, '../.env');

const LOGIN_URL = 'https://api.edlink.id/api/v1.4/site/login';

// ─────────────────────────────────────────────
// UPDATE TOKEN DI FILE .env
// ─────────────────────────────────────────────
function updateEnvToken(newToken) {
    let content = fs.readFileSync(envPath, 'utf-8');

    if (content.includes('EDLINK_TOKEN=')) {
        content = content.replace(/^EDLINK_TOKEN=.*/m, `EDLINK_TOKEN=${newToken}`);
    } else {
        content += `\nEDLINK_TOKEN=${newToken}`;
    }

    fs.writeFileSync(envPath, content, 'utf-8');
    process.env.EDLINK_TOKEN = newToken;
    console.log('[TokenRefresher] ✅ Token berhasil diperbarui di .env');
}

// ─────────────────────────────────────────────
// MAIN: LOGIN VIA API ASLI EDLINK
// ─────────────────────────────────────────────
export async function refreshEdlinkToken() {
    const email    = process.env.EDLINK_EMAIL;
    const password = process.env.EDLINK_PASSWORD;

    if (!email || !password) {
        throw new Error('EDLINK_EMAIL atau EDLINK_PASSWORD belum diset di .env');
    }

    console.log('[TokenRefresher] 🚀 Login ke Edlink via API...');

    const device = JSON.stringify({
        secureId: 'bot-' + Math.random().toString(36).slice(2, 10),
        name: 'Chrome',
        manufacture: 'Google',
        model: 'Chrome',
        product: 'Chrome',
        hardware: 'Windows 10',
        version: '124.0.0.0',
        regId: null,
    });

    const body = {
        username: '',
        app_id: '',
        device,
        email,
        password,
        web_reg_id: null,
    };

    const res = await axios.post(LOGIN_URL, body, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-app-locale': 'id',
            'origin': 'https://edlink.id',
            'referer': 'https://edlink.id/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
    });

    if (res.status !== 200) {
        const msg = res.data?.message || res.data?.applicationSystem?.message || `HTTP ${res.status}`;
        throw new Error(`Login gagal: ${msg}`);
    }

    const token = res.data?.data?.userToken?.token;

    if (!token) {
        throw new Error('Login berhasil tapi token tidak ditemukan di response (struktur API mungkin berubah)');
    }

    updateEnvToken(token);
    return token;
}