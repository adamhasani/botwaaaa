# The Archive — Merged (WhatsApp + Telegram)

Bot WA ("The Archive Lite", Baileys) dan bot Telegram (python-telegram-bot) sekarang
digabung jadi **satu project Node.js**. Command dan chat bisa dipanggil dari WA
maupun Telegram — satu database, satu "otak".

## ⚠️ Wajib dilakukan dulu sebelum jalanin

1. **Rotate/ganti kredensial lama.** File `bot.py` yang kamu upload berisi
   `BOT_TOKEN` Telegram dan `GROQ_API_KEY` yang ter-hardcode di kode. Kalau file itu
   pernah dibagikan/diupload ke tempat lain, anggap kredensial itu bocor:
   - Telegram: buka **@BotFather** → `/revoke` token lama → generate token baru.
   - Groq: buka [console.groq.com](https://console.groq.com) → cabut API key lama → buat baru.
   - Edlink: `EDLINK_PASSWORD` di `.env` lama kamu juga plaintext — ganti password akun itu juga kalau perlu.
2. Copy `.env.example` jadi `.env`, isi semua value (token BARU, bukan yang lama).

## Cara jalan

```bash
npm install
cp .env.example .env   # lalu edit isinya
node index.js --pairing
```

Sekali `node index.js` dijalankan, dua-duanya nyala bareng dalam satu proses:
- **WhatsApp** — pairing code / QR seperti biasa (lihat prompt di terminal).
- **Telegram** — otomatis connect pakai `TELEGRAM_BOT_TOKEN` dari `.env`.

Kalau `TELEGRAM_BOT_TOKEN` kosong, bagian Telegram di-skip (WA tetap jalan normal).
Kalau `GROQ_API_KEY` kosong, fitur AI chat bebas (obrolan tanpa command) di-skip
di kedua platform, tapi semua command tetap jalan.

## Apa yang berubah / ditambah

| Bagian | Keterangan |
|---|---|
| `telegram.js` | Entry point Telegram baru, pakai **plugin Map yang sama** dengan WA (`toolkit/loader.js`). Command apapun yang ada di `plugins/` otomatis bisa dipanggil dari Telegram, gak perlu ditulis ulang. |
| `toolkit/telegramAdapter.js` | "Penerjemah" — bikin objek `conn` versi Telegram yang punya `sendMessage(chatId, content, options)` dengan bentuk sama persis kayak Baileys. Ini kuncinya kenapa plugin lama (menu, addtugas, tt, yt, ig, dst) langsung jalan di Telegram tanpa disentuh. |
| `toolkit/simpananDb.js` | Database SQLite terpusat (`toolkit/db/simpenan.db`), dipakai bareng WA & Telegram. Port dari skema `bot.py` (items, reminders, chat_history, users, daily_journal) + kolom `platform` biar tau reminder/jurnal itu punya siapa dari platform mana. |
| `toolkit/groqAI.js` | Chat completion + klasifikasi intent (keyword-based + fallback AI) + transcribe voice note, port dari `bot.py`. |
| `toolkit/aiChatHandler.js` | Kalau pesan **bukan** command (gak diawali prefix), pesan dilempar ke sini — chat AI bebas kayak bot Telegram lama. Aktif di **chat pribadi saja** (di grup di-skip biar gak spam auto-reply). |
| `plugins/ai/*.js` | Command baru, otomatis jalan di WA & Telegram: `.simpan`, `.cari`, `.listsimpanan`, `.hapussimpanan`, `.jurnal`, `.reminder`, `.cuaca`. |
| `scheduler/simpanan_scheduler.js` | Cek reminder generik yang jatuh tempo tiap menit, kirim ke platform asalnya (WA atau Telegram). Juga morning briefing jam 7 pagi ke semua user yang pernah chat. |
| Command prefix di Telegram | Bisa pakai `.` (sama kayak WA) **atau** `/` (gaya command Telegram bawaan) — dua-duanya kepakai. |

## Fitur dari `bot.py` yang **belum** ikut diport (perlu effort tambahan)

Beberapa fitur di `bot.py` sangat spesifik ke setup lama (cloudflare tunnel ke PC,
endpoint TTS yang gak jelas asalnya, dsb) jadi sengaja belum dipindah biar gak
bikin bot crash karena manggil service yang gak ada:

- **GOD mode** / **Hermes agent** — kontrol PC dari jarak jauh lewat cloudflare tunnel.
- **Text-to-speech** (voice reply).
- **Vision** (analisa gambar via Groq vision) — voice+chat udah ada, foto belum.
- **Jadwal bola** (`get_jadwal_bola`).
- **Agentic multi-step planning** (`plan_and_execute_agentic_task`) — versi sekarang
  cuma 1 langkah per intent (simpan/cari/reminder/dst), belum bisa chaining beberapa
  aksi sekaligus dalam 1 pesan.

Kalau salah satu ini penting buat kamu, bilang aja — bisa aku susulin.

## Update lanjutan (port dari perbaikan bot.py v2)

Setelah merge awal ini, `bot.py` sempat dibenerin lagi (bug smart recall yang
suka "nyambung-nyambungin" konteks nggak relevan, bug bot riset sendiri padahal
nggak perlu) plus ditambah beberapa fitur baru. Perbaikan & fitur itu sekarang
sudah diport ke project Node ini juga:

| Bagian | Keterangan |
|---|---|
| `toolkit/contextRecall.js` (baru) | Smart Context Recall v2 — pakai scoring (kata spesifik = 2 poin, kata generik = 1 poin) + threshold minimum, biar bot AI chat (`toolkit/aiChatHandler.js`) nggak salah nyambungin obrolan sekarang sama data lama yang sebenarnya nggak relevan. |
| `toolkit/groqAI.js` | Prompt classifier fallback (`classifyIntentAI`) diperjelas: pertanyaan pengetahuan umum ("kenapa X", "jelasin Y") sekarang jatuh ke CHAT, bukan RESEARCH — benerin bug bot yang riset sendiri padahal nggak perlu data internet. Ditambah intent `SCRAPE`. |
| `toolkit/scrape.js` (baru) | Ambil isi teks lengkap sebuah halaman (bukan cuma title), pakai `axios` + `cheerio` (dependency yang udah ada, gak nambah apa-apa). |
| `toolkit/simpananDb.js` | `checkSimilarItem` diganti dari heuristik char-overlap kasar ke Dice coefficient (bigram) — mirip `difflib.SequenceMatcher` di Python, lebih akurat. Ditambah `getRelatedItems()` (kemiripan sedang, 0.3–0.6) buat saran "item terkait" yang bukan duplikat persis, dan `getJournalSince()` buat laporan mingguan. |
| `plugins/ai/scrape.js` (baru) | Command `.scrape <url>` / `.rangkum <url>` — ambil & rangkum isi halaman. |
| `plugins/ai/journalreport.js` (baru) | Command `.journalreport` / `.laporanjurnal` — laporan naratif tren mood & topik dari jurnal 7 hari terakhir, dibikin AI. |
| `plugins/ai/simpan.js`, `toolkit/aiChatHandler.js` | Saat nyimpen item, sekarang juga nunjukin item lama yang **terkait** (bukan cuma cek duplikat) pakai `getRelatedItems()`. |

Semua perubahan ini cuma nambah/nge-fix file, gak ada yang menghapus fitur lama.
Command prefix tetap sama (`.` atau `/`), gak perlu setting baru di `.env`.

## Update lanjutan #2 — Multi-format file reader (PDF/DOCX/XLSX/OCR)

Bot sekarang bisa baca isi PDF, Word (.docx), spreadsheet (.xlsx/.xls/.csv),
dan gambar (OCR) — baik dari WA maupun Telegram.

**Dependency baru** (jalankan `npm install` setelah update):
`pdf-parse`, `mammoth`, `xlsx`, `tesseract.js` — semua pure JS/WASM, gak perlu
install binary tambahan (Tesseract, LibreOffice, dst) di VPS.

| Bagian | Keterangan |
|---|---|
| `toolkit/fileReaders/pdfReader.js` (baru) | Ekstrak teks PDF pakai `pdf-parse`. |
| `toolkit/fileReaders/docxReader.js` (baru) | Ekstrak teks `.docx` pakai `mammoth`. Format `.doc` lama (bukan `.docx`) TIDAK didukung. |
| `toolkit/fileReaders/spreadsheetReader.js` (baru) | Ekstrak isi `.xlsx`/`.xls`/`.csv` per sheet pakai `xlsx` (SheetJS). |
| `toolkit/fileReaders/imageOcr.js` (baru) | OCR gambar (ind+eng) pakai `tesseract.js`. Worker di-init sekali (singleton) biar gak lambat tiap request; language data didownload otomatis di run pertama (butuh internet sekali). |
| `toolkit/fileReaders/index.js` (baru) | Dispatcher — deteksi tipe file dari ekstensi/magic-bytes (`file-type`, dependency lama), arahkan ke reader yang sesuai. |
| `toolkit/documentHandler.js` (baru) | Logika bersama WA+Telegram: ekstrak isi file → ringkas via Groq → balas ke chat → simpan opsional ke database. |
| `plugins/ai/bacadokumen.js` (baru) | Command WA `.bacadokumen` / `.baca` / `.readdoc` — kirim file dengan caption ini, atau reply file itu pakai command ini. Tambah kata `simpan` di belakang buat nyimpen hasil ekstraksi ke database. |
| `telegram.js` | Ditambah handler `message.document` & `message.photo` — kirim file dengan caption `.bacadokumen` (perlu caption, biar bot gak auto-proses tiap foto yang masuk). |
| `main.js` | **[FIX]** `parseMessage()` sebelumnya gak baca caption dari `documentMessage` sama sekali — jadi command lewat caption di file PDF/DOCX/XLSX gak akan pernah kepicu (cuma jalan buat gambar). Sekarang sudah ditangkap. |
| `index.js` | Worker OCR (`tesseract.js`) dimatikan pas graceful shutdown biar proses gak nge-hang. |

**Keterbatasan yang belum ditangani** (biar jujur, bukan pura-pura semua sempurna):
- Telegram: reply ke dokumen LAMA dengan `.baca` (tanpa attach file baru) **belum** didukung — Telegram naruh dokumen lama itu di `reply_to_message`, bukan di pesan saat ini, dan itu belum di-handle. Yang jalan: kirim file baru dengan caption `.bacadokumen`.
- PDF hasil scan (gambar tanpa layer teks) akan gagal diekstrak `pdf-parse` — untuk itu perlu OCR manual (belum ada auto-fallback PDF→gambar→OCR).
- File di atas ~15-20 MB kemungkinan lambat/berat diproses di VPS spek kecil, terutama OCR.

## Yang perlu ditest manual (butuh device/koneksi asli)

Aku udah cek: instalasi dependency, syntax semua file baru, dan fungsi database
(simpan/cari/reminder/jurnal) jalan normal lewat test script. Yang **belum** bisa
aku test dari sini karena butuh token/koneksi asli punya kamu:
- Login WA (scan pairing code) & login Telegram (`TELEGRAM_BOT_TOKEN` asli)
- Panggilan ke Groq API (butuh `GROQ_API_KEY` asli)
- Command downloader (tt/yt/ig) dari sisi Telegram — logic-nya harusnya jalan
  karena cuma pakai `args`+`conn.sendMessage`, tapi tetap sebaiknya dicoba langsung.
- `.s` (bikin stiker) dari **Telegram** akan selalu bilang "media gak ada" kalau
  motret pesan reply — soalnya baca media WA quoted itu API yang WA-only. Dari WA
  tetap normal seperti biasa.
