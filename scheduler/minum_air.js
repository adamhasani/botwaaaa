/* ╔══════════════════════════════════════════╗
   ║  MINUM AIR — AUTO REPLY KE GRUP         ║
   ║  Reply gaul ke siapapun yang chat       ║
   ║  Cooldown 2 jam per orang               ║
   ╚══════════════════════════════════════════╝ */

// Counter pesan grup & cooldown per orang
const msgCounter  = new Map(); // chatId → jumlah pesan sejak terakhir trigger
const cooldownMap = new Map(); // jid → timestamp terakhir dikirim
const TRIGGER_EVERY = 10;          // kirim tiap N pesan
const COOLDOWN_MS   = 2 * 60 * 60 * 1000; // 2 jam per orang

const PESAN_MINUM = [
    'eh gaskeun minum air putih dulu gih, udah berapa gelas hari ini? 💧',
    'bentar deh, minum air putih dulu yuk bestie jgn ampe dehidrasi 🫗',
    'inget kan? tubuh lo 60% air, isi ulang dong bro 💦',
    'skip dulu aktivitasnya, minum air putih dulu baru lanjut 🥤',
    'udah minum air putih belum? kalau belum buruan gih, penting banget bestie 💧',
    'reminder nih dari gue — minum air putih dulu, jgn sampe lupa ya 🫗',
    'ayo dong, satu gelas air putih dulu, badan lo butuh itu bro 💦',
    'beneran deh minum air putih dulu, produktivitas lo bakal nambah wkwk 🥤',
    'gas minum air putih dulu, ntar baru lanjut ngobrol lagi 💧',
    'air putih lu udah minum? kalau belum ayo sekarang juga bestie 🫗',
];

const FAKTA_RANDOM = [
    '💡 eh tau ga, gurita punya 3 jantung dan darahnya warna biru. wild banget kan?',
    '🧠 fun fact: otak lo aktif lebih liar waktu tidur dibanding waktu melek. mimpi itu literally otak lo lagi overclocking.',
    '🐝 lebah bisa kenal wajah manusia kayak kita kenal wajah orang. mereka punya memori muka sendiri loh.',
    '🌊 suara laut yang lo denger di kerang itu bukan suara laut — itu suara darah lo sendiri yang dipantulkan. serem ga?',
    '🦈 hiu lebih tua dari pohon. hiu udah ada 450 juta tahun, pohon baru muncul 350 juta tahun lalu.',
    '😴 manusia adalah satu-satunya mamalia yang sengaja nunda tidur. literally cuma kita yang begadang padahal ngantuk.',
    '🌍 kalau semua es di bumi mencair, permukaan laut naik sekitar 70 meter. Jakarta? udah jadi laut.',
    '🐘 gajah takut lebah. peternakan di Afrika pasang suara lebah buat usir gajah dari ladang mereka.',
    '⚡ petir itu 5x lebih panas dari permukaan matahari. cuma berlangsung sepersekian detik sih.',
    '🦋 kupu-kupu ngerasain makanan pakai kaki mereka. reseptor rasa ada di telapak kaki mereka.',
    '🧬 DNA lo kalau direntangin bisa bolak-balik bumi ke matahari lebih dari 600 kali.',
    '🐬 lumba-lumba punya nama panggilan satu sama lain — mereka literally manggil temannya pakai suara unik.',
    '🌙 bulan menjauh dari bumi sekitar 3.8 cm per tahun. suatu hari gerhana total bakal ga ada lagi.',
    '🐜 semut ga punya paru-paru. mereka napas lewat lubang kecil di tubuh mereka yang disebut spirakel.',
    '🧊 air panas bisa beku lebih cepat dari air dingin dalam kondisi tertentu. ini disebut efek Mpemba, sampe sekarang masih debat kenapa.',
    '🎵 musik dalam tangga nada minor bikin otak lo proses emosi lebih dalam — makanya lagu sedih kerasa nusuk banget.',
    '🦴 tulang manusia lebih kuat dari beton per satuan berat. tapi ya tetep bisa patah kalau salah jatuh.',
    '🐙 gurita punya neuron di setiap tentakelnya — jadi tiap lengan bisa "berpikir" semi-independen.',
    '🌿 pohon bisa komunikasi satu sama lain lewat jaringan jamur di tanah. disebut "wood wide web".',
    '🔭 cahaya matahari yang nyentuh kulit lo itu butuh 8 menit dari matahari. tapi aslinya diproduksi 100.000 tahun lalu di inti matahari.',
];

// 50/50 minum air atau fakta random
function getPesan() {
    if (Math.random() < 0.5) {
        return PESAN_MINUM[Math.floor(Math.random() * PESAN_MINUM.length)];
    } else {
        return FAKTA_RANDOM[Math.floor(Math.random() * FAKTA_RANDOM.length)];
    }
}

export function handleMinumAir(conn, msg, senderJid, chatId) {
    const target = process.env.REMINDER_TARGET;
    if (!target || chatId !== target) return;

    // Tambah counter grup
    const count = (msgCounter.get(chatId) || 0) + 1;
    msgCounter.set(chatId, count);
    if (count % TRIGGER_EVERY !== 0) return; // belum 10 pesan

    // Cek cooldown per orang
    const now = Date.now();
    const lastSent = cooldownMap.get(senderJid) || 0;
    if (now - lastSent < COOLDOWN_MS) return; // orang ini baru kena, skip

    cooldownMap.set(senderJid, now);

    const teks = getPesan();

    conn.sendMessage(chatId, {
        text: teks,
    }, { quoted: msg }).catch(() => {});
}
