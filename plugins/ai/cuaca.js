import { getInfoCuaca } from '../../toolkit/weather.js';

export default {
    name: 'cuaca',
    command: ['cuaca', 'weather'],
    tags: 'AI & Simpanan',
    desc: 'Cek info cuaca',
    prefix: true,

    run: async (conn, msg, { chatInfo }) => {
        const { chatId } = chatInfo;
        const info = await getInfoCuaca();
        await conn.sendMessage(chatId, { text: info }, { quoted: msg });
    }
};
