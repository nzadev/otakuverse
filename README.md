# OTAKUVERSE — Aniyomi Web Edition

> 🎌 Platform streaming anime 100% bebas iklan & open-source yang mereplikasi arsitektur Aniyomi/Tachiyomi di browser.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

## Fitur Utama

- **Multi-Source Scraper** — Samehadaku, Otakudesu, Kuramanime, HiAnime, GogoAnime
- **AniList API Integration** — Katalog anime terlengkap via GraphQL
- **Cinema Player (MPV HUD)** — Skip Intro, Speed Control, Aspect Ratio, Fullscreen, Auto-Next Episode
- **Library & Watchlist** — Simpan progress tontonan di localStorage
- **Extensions Manager** — Arsitektur plugin modular Keiyoushi-compatible
- **Responsive** — Desktop (Sidebar Nav) + Mobile/Waydroid (Bottom Nav)
- **HTTP 206 Partial Content** — Streaming video dengan range request

## Quick Start

```bash
npm install
npm start
```

Buka http://localhost:4173

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS, Plus Jakarta Sans, CSS Custom Properties |
| Backend | Node.js HTTP Server (zero-dependency) |
| Data | AniList GraphQL API |
| Scraping | curl-based HTML parser (Samehadaku, Otakudesu) |
| Video | Native HTML5 `<video>` + iframe embed fallback |

## Struktur Folder

```
otakuverse/
├── index.html        # Single-page app shell
├── app.js            # Client-side engine (navigation, player, library)
├── styles.css        # Material 3 / Aniyomi Dark OLED design system
├── server.js         # Node.js HTTP server + API routes
├── scraper.js        # Live scraper engine (Samehadaku & Otakudesu)
├── media/            # Local video files (sample + cached)
├── icon.svg          # App icon
├── manifest.json     # PWA manifest
└── start.sh          # Quick start script
```

## API Endpoints

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /api/anime` | Katalog anime (filter: source, genre, status, sort, search) |
| `GET /api/anime/:id` | Detail anime by AniList ID |
| `GET /api/extensions` | Daftar ekstensi scraper terpasang |
| `GET /api/repos` | Daftar repositori sumber |
| `GET /api/scrapers/streams` | Ekstrak stream URL dari halaman episode |
| `GET /api/scrapers/episodes` | Daftar episode dari halaman anime |
| `GET /api/image-proxy` | Proxy gambar untuk bypass hotlink/CORS |

## License

MIT © NzaDev
