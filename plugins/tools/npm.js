import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '../../');

// Whitelist command yang diizinkan
const ALLOWED = ['install', 'update', 'uninstall', 'list', 'outdated', 'audit'];

export default {
    name: 'npm',
    command: ['npm'],
    tags: 'Owner',
    desc: 'Jalankan npm command dari WA. Contoh: .npm install axios',
    prefix: true,
    owner: true,

    run: async (conn, msg, { chatInfo, args }) => {
        const { chatId } = chatInfo;

        if (!args.length) {
            return conn.sendMessage(chatId, {
                text: `📦 *NPM via WA*\n\nContoh penggunaan:\n`
                    + `\`.npm install axios\`\n`
                    + `\`.npm uninstall lodash\`\n`
                    + `\`.npm update\`\n`
                    + `\`.npm list\`\n`
                    + `\`.npm outdated\`\n\n`
                    + `✅ Command yang diizinkan:\n${ALLOWED.map(c => `• npm ${c}`).join('\n')}`
            }, { quoted: msg });
        }

        const subCmd = args[0].toLowerCase();

        if (!ALLOWED.includes(subCmd)) {
            return conn.sendMessage(chatId, {
                text: `❌ Command \`npm ${subCmd}\` tidak diizinkan.\n\nYang diizinkan: ${ALLOWED.join(', ')}`
            }, { quoted: msg });
        }

        const fullCmd = `npm ${args.join(' ')}`;

        await conn.sendMessage(chatId, {
            text: `⏳ Menjalankan: \`${fullCmd}\`\n\n_Mohon tunggu..._`
        }, { quoted: msg });

        exec(fullCmd, { cwd: ROOT_DIR, timeout: 120000 }, async (err, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            const trimmed = output.length > 3000
                ? '...(output terpotong)\n' + output.slice(-2800)
                : output;

            const status = err ? '❌ Gagal' : '✅ Selesai';

            await conn.sendMessage(chatId, {
                text: `${status}: \`${fullCmd}\`\n\n\`\`\`\n${trimmed.trim() || '(tidak ada output)'}\n\`\`\``
            }, { quoted: msg });
        });
    }
};
