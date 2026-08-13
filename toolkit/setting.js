import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const setting = {
    // WhatsApp
    ownerNumber: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
    prefix: process.env.PREFIX || '.',
    timezone: process.env.TIMEZONE || 'Asia/Jakarta',
    reminderTarget: process.env.REMINDER_TARGET || '',
    cobaltApi: process.env.COBALT_API || 'https://api.cobalt.tools',

    // Telegram
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramOwnerId: process.env.TELEGRAM_OWNER_ID || '',

    // Groq AI
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqTextModel: process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile',
    groqSttModel: process.env.GROQ_STT_MODEL || 'whisper-large-v3',

    // Paths
    rootDir: join(__dirname, '..'),
    dbDir: join(__dirname, '../toolkit/db'),
    sessionDir: join(__dirname, '../session'),
};

export default setting;
