# 🗂️ The Archive Lite

Bot WhatsApp ringan — hanya fitur esensial: **Downloader + Deadline Reminder**.

## 📦 Dependencies (hanya 8)
- @whiskeysockets/baileys
- axios
- chalk
- dotenv
- moment-timezone
- node-cache
- pino
- ruhend-scraper

Banding bot asli yang punya 40+ dependencies!

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Setup .env
```bash
cp .env.example .env
# Edit .env sesuai kebutuhanmu
```

### 3. Jalankan bot
```bash
# Pakai pairing code (rekomendasi)
npm start

# Pakai QR code
node index.js
```

---

## 📋 Daftar Command

### 📥 Downloader
| Command | Fungsi |
|---------|--------|
| `.tt [link]` | Download TikTok (video + audio) |
| `.ig [link]` | Download Instagram video/foto |
| `.yt [link]` | Download YouTube video |

### 📋 Tugas & Deadline
| Command | Fungsi |
|---------|--------|
| `.addtugas Nama \| YYYY-MM-DD \| HH:mm \| Ket` | Tambah tugas baru |
| `.listtugas` | Lihat semua tugas aktif |
| `.deltugas [nama]` | Hapus tugas |

### ℹ️ Info
| Command | Fungsi |
|---------|--------|
| `.menu` | Tampilkan semua command |

---

## 🔔 Sistem Pengingat Otomatis

Bot otomatis mengirim reminder ke `REMINDER_TARGET` di `.env`:
- **H-7** (jam 08:00) — 7 hari sebelum deadline
- **H-1** (jam 20:00) — 1 hari sebelum deadline  
- **Saat deadline** — tepat waktu deadline

---

## 📝 Contoh Penggunaan

```
.addtugas UTS Statistika | 2025-06-15 | 08:00 | Bab 3-5 halaman 120

.listtugas

.deltugas UTS Statistika

.tt https://vm.tiktok.com/xxxxx

.ig https://www.instagram.com/p/xxxxx
```

---

## 🗂️ Struktur Folder

```
bot-lite/
├── index.js          # Entry point
├── main.js           # Core bot engine
├── .env              # Konfigurasi
├── package.json
├── plugins/
│   ├── download/
│   │   ├── tt.js     # TikTok
│   │   ├── ig.js     # Instagram
│   │   └── yt.js     # YouTube
│   └── tools/
│       ├── addtugas.js
│       ├── listtugas.js
│       ├── deltugas.js
│       └── menu.js
├── scheduler/
│   └── deadline_reminder.js
├── toolkit/
│   ├── setting.js
│   ├── loader.js
│   └── db/
│       └── deadlines.json  # Auto-generated
└── session/          # Auth session WhatsApp
```
