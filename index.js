import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
global.__dirname = __dirname;

// Pastiin folder session & db ada sebelum apapun
const sessionDir = join(__dirname, 'session');
const dbDir      = join(__dirname, 'toolkit/db');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
if (!fs.existsSync(dbDir))      fs.mkdirSync(dbDir, { recursive: true });

const args = process.argv.slice(2);
const usePairing = args.includes('--pairing');

// Tunggu sebentar biar file system siap
await new Promise(r => setTimeout(r, 3000));

// Muat plugin SEKALI di sini biar WA & Telegram pakai Map yang sama persis
const { loadPlugins } = await import('./toolkit/loader.js');
await loadPlugins(__dirname);

const { default: main } = await import('./main.js');
const { default: startTelegram } = await import('./telegram.js');
const { terminateOcrWorker } = await import('./toolkit/fileReaders/imageOcr.js');

// Jalanin dua-duanya bareng. Kalau salah satu gagal/belum dikonfig, yang lain tetap jalan.
main(usePairing).catch(e => console.error('[WA] gagal start:', e.message));
startTelegram().catch(e => console.error('[TELEGRAM] gagal start:', e.message));

// ── GRACEFUL SHUTDOWN ──
// Beri waktu bot simpan session sebelum mati
async function gracefulShutdown(signal) {
    console.log(`\n[SHUTDOWN] Sinyal ${signal} diterima, menyimpan session...`);
    await terminateOcrWorker().catch(() => {}); // [FITUR BARU] matikan worker Tesseract biar proses ga nge-hang
    await new Promise(r => setTimeout(r, 3000));
    console.log('[SHUTDOWN] Session tersimpan, bot mati.');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (e) => {
    console.error('[ERROR] Uncaught exception:', e.message);
    // Jangan exit — biar bot tetap jalan
});
process.on('unhandledRejection', (e) => {
    console.error('[ERROR] Unhandled rejection:', e?.message || e);
    // Jangan exit — biar bot tetap jalan
});