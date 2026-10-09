const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const scraper = require('./scraper');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;

// In-memory cache for AniList queries (TTL: 10 minutes)
const apiCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const repos = [
  {
    id: 'all',
    name: 'Semua Repo',
    flag: '🌐',
    badge: 'Universal',
    desc: 'Menampilkan katalog anime gabungan dari semua repositori'
  },
  {
    id: 'id',
    name: 'Repo Indonesia',
    flag: '🇮🇩',
    badge: 'Sub Indo',
    desc: 'Mirror fansub lokal: Otakudesu, Samehadaku, Kuramanime',
    mirrors: ['Otakudesu Cloud', 'Samehadaku Fast', 'Kuramanime HD']
  },
  {
    id: 'en',
    name: 'Repo Global (English)',
    flag: '🇬🇧',
    badge: 'Sub/Dub Eng',
    desc: 'Sumber internasional: GogoAnime & HiAnime Mirrors',
    mirrors: ['GogoCDN', 'MegaCloud', 'Vidstream Direct']
  },
  {
    id: 'multi',
    name: 'Repo Multi-Language & Raw',
    flag: '🇯🇵',
    badge: 'Raw & Multi',
    desc: 'Sumber rilisan TV & BD dengan audio original dan softsub multi-bahasa',
    mirrors: ['Erai-Raws Multi', 'SubsPlease Web', 'CrunchyDirect']
  }
];

const extensions = [
  {
    id: 'samehadaku',
    name: 'Samehadaku',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.4.2',
    author: 'Keiyoushi Community',
    icon: '⚡',
    status: 'installed',
    enabled: true,
    description: 'Sumber fansub anime subtitle Indonesia tercepat & mirror HD',
    baseUrl: 'https://samehadaku.email'
  },
  {
    id: 'otakudesu',
    name: 'Otakudesu',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.3.0',
    author: 'Keiyoushi Community',
    icon: '🌸',
    status: 'installed',
    enabled: true,
    description: 'Koleksi anime lengkap tamat & ongoing bahasa Indonesia',
    baseUrl: 'https://otakudesu.cloud'
  },
  {
    id: 'kuramanime',
    name: 'Kuramanime',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.2.1',
    author: 'Keiyoushi Community',
    icon: '🦊',
    status: 'installed',
    enabled: true,
    description: 'Streaming server resolusi 720p/1080p dengan audio jernih',
    baseUrl: 'https://kuramanime.pro'
  },
  {
    id: 'animeindo',
    name: 'AnimeIndo',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.1.0',
    author: 'Keiyoushi Community',
    icon: '🏮',
    status: 'available',
    enabled: false,
    description: 'Mirror anime subtitle Indonesia alternatif anti-blokir',
    baseUrl: 'https://animeindo.to'
  },
  {
    id: 'hianime',
    name: 'HiAnime (Zoro)',
    lang: 'EN',
    flag: '🇬🇧',
    version: '1.5.0',
    author: 'Keiyoushi Community',
    icon: '🗡️',
    status: 'installed',
    enabled: true,
    description: 'Database anime global dengan multi-sub & softsub',
    baseUrl: 'https://hianime.to'
  },
  {
    id: 'gogoanime',
    name: 'GogoAnime',
    lang: 'EN',
    flag: '🇬🇧',
    version: '2.0.1',
    author: 'Keiyoushi Community',
    icon: '🌐',
    status: 'installed',
    enabled: true,
    description: 'Mirror rilis TV jepang tercepat dengan subtitle bahasa inggris',
    baseUrl: 'https://gogoanime3.co'
  },
  {
    id: 'anilist-tracker',
    name: 'AniList Tracker',
    lang: 'ALL',
    flag: '🔄',
    version: '2.2.0',
    author: 'Aniyomi Official',
    icon: '📊',
    status: 'installed',
    enabled: true,
    description: 'Sinkronisasi riwayat tontonan & update musim otomatis ke AniList',
    baseUrl: 'https://anilist.co'
  }
];

function cleanDescription(desc) {
  if (!desc) return 'Sinopsis belum tersedia untuk anime ini.';
  return desc
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function transformMedia(item) {
  const titleRomaji = item.title?.romaji || 'Unknown Anime';
  const titleEnglish = item.title?.english || titleRomaji;
  const titleNative = item.title?.native || '';
  const displayTitle = titleEnglish !== titleRomaji ? `${titleEnglish} (${titleRomaji})` : titleRomaji;

  const cover = item.coverImage?.extraLarge || item.coverImage?.large || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=700';
  const banner = item.bannerImage || cover;

  const studio = item.studios?.nodes?.[0]?.name || 'Studio Animation';
  const episodesCount = item.episodes || 12;
  const statusStr = item.status === 'RELEASING' ? 'Ongoing' : (item.status === 'FINISHED' ? 'Completed' : 'Upcoming');
  let trailerId = (item.trailer?.site === 'youtube') ? item.trailer.id : null;
  if (!trailerId && item.id === 21) trailerId = 'S8_YwFLCh4U'; // One Piece Egghead Arc Official Trailer
  if (!trailerId && item.id === 269) trailerId = 'e8YBesRKq_U'; // Bleach TYBW Official Trailer

  // Generate episodes array
  const totalEp = Math.min(episodesCount, 150);
  const episodes = [];
  const customVideoPath = path.join(ROOT, 'media', `anime_${item.id}.mp4`);
  const videoFileUrl = fs.existsSync(customVideoPath) ? `/media/anime_${item.id}.mp4` : '/media/sample.mp4';

  for (let i = 1; i <= (totalEp || 12); i++) {
    episodes.push({
      num: i,
      title: `Episode ${i}`,
      duration: '24:00',
      video: videoFileUrl,
      trailerId: trailerId,
      releaseDate: item.seasonYear ? `${item.season || 'Season'} ${item.seasonYear}` : '2024'
    });
  }

  return {
    id: String(item.id),
    title: displayTitle,
    romajiTitle: titleRomaji,
    nativeTitle: titleNative,
    repo: ['id', 'en', 'multi'],
    genre: item.genres || ['Action'],
    type: 'TV Series',
    rating: item.averageScore ? (item.averageScore / 10) : 8.0,
    status: statusStr,
    episodesCount: episodesCount,
    year: item.seasonYear || 2024,
    studio: studio,
    season: `${item.season || ''} ${item.seasonYear || ''}`.trim(),
    badge: item.averageScore >= 85 ? 'Masterpiece' : (item.status === 'RELEASING' ? 'Trending' : 'Populer'),
    description: cleanDescription(item.description),
    cover: cover,
    banner: banner,
    trailerId: trailerId,
    episodes: episodes
  };
}

async function fetchFromAniList({ page = 1, perPage = 30, search = '', genre = '', status = '', sort = 'trending' }) {
  const cacheKey = JSON.stringify({ page, perPage, search, genre, status, sort });
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const query = `
    query ($page: Int, $perPage: Int, $search: String, $genre: String, $status: MediaStatus, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(type: ANIME, isAdult: false, search: $search, genre: $genre, status: $status, sort: $sort) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          description
          averageScore
          episodes
          status
          seasonYear
          season
          genres
          trailer {
            id
            site
          }
          studios(isMain: true) {
            nodes {
              name
            }
          }
        }
      }
    }
  `;

  const sortMap = {
    trending: ['TRENDING_DESC', 'POPULARITY_DESC'],
    latest: ['TRENDING_DESC', 'POPULARITY_DESC'],
    popular: ['POPULARITY_DESC'],
    score: ['SCORE_DESC', 'POPULARITY_DESC']
  };

  const variables = {
    page: parseInt(page, 10) || 1,
    perPage: parseInt(perPage, 10) || 30,
    sort: sortMap[sort] || ['TRENDING_DESC', 'POPULARITY_DESC']
  };

  if (sort === 'latest' && (!status || status === 'All')) {
    variables.status = 'RELEASING';
  }

  if (search && search.trim()) {
    variables.search = search.trim();
  }

  if (genre && genre !== 'All') {
    variables.genre = genre;
  }

  if (status && status !== 'All') {
    if (status.toLowerCase() === 'ongoing') variables.status = 'RELEASING';
    if (status.toLowerCase() === 'completed') variables.status = 'FINISHED';
  }

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!res.ok) {
      throw new Error(`AniList returned status: ${res.status}`);
    }

    const payload = await res.json();
    const mediaList = payload.data?.Page?.media || [];
    const pageInfo = payload.data?.Page?.pageInfo || {};

    const items = mediaList.map(transformMedia);
    const result = {
      items,
      pageInfo
    };

    apiCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.error('[OtakuVerse API] AniList fetch error:', err.message);
    return null;
  }
}

async function fetchAnimeById(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        description
        averageScore
        episodes
        status
        seasonYear
        season
        genres
        trailer { id site }
        studios(isMain: true) { nodes { name } }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: parseInt(id, 10) } })
    });
    const payload = await res.json();
    if (payload.data?.Media) {
      return transformMedia(payload.data.Media);
    }
  } catch (err) {
    console.error('Fetch anime by id error:', err.message);
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  // Iframe & CORS Headers (Allows embedding in nzadev-hub and external sites)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/repos') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items: repos }));
    return;
  }

  if (pathname === '/api/extensions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items: extensions }));
    return;
  }

  // Image Proxy to bypass hotlink & CORS restrictions
  if (pathname === '/api/image-proxy') {
    const targetUrl = requestUrl.searchParams.get('url');
    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid URL');
      return;
    }

    try {
      const isSamehadaku = targetUrl.includes('samehadaku');
      const isOtakudesu = targetUrl.includes('otakudesu');
      const referer = isSamehadaku ? 'https://v2.samehadaku.how/' : (isOtakudesu ? 'https://otakudesu.blog/' : '');

      const child = spawn('curl', [
        '-sL',
        '--max-time', '10',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        ...(referer ? ['-e', referer] : []),
        targetUrl
      ]);

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      child.stdout.pipe(res);
      child.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      return;
    } catch (e) {
      if (!res.headersSent) res.writeHead(500);
      res.end();
      return;
    }
  }

  // Scraper Stream Extractors (Samehadaku Full HD, Otakudesu, Auto-Resolver)
  if (pathname === '/api/scrapers/streams') {
    const source = requestUrl.searchParams.get('source') || 'samehadaku';
    const targetUrl = requestUrl.searchParams.get('url') || '';
    const title = requestUrl.searchParams.get('title') || '';
    const episode = requestUrl.searchParams.get('episode') || '1';
    let streams = [];

    try {
      if (targetUrl && source.includes('samehadaku')) {
        streams = await scraper.getSamehadakuStreams(targetUrl);
      } else if (targetUrl && source.includes('otakudesu')) {
        streams = await scraper.getOtakudesuStreams(targetUrl);
      }

      // Auto-resolve stream by title for AniList or other sources
      if (streams.length === 0 && title) {
        streams = await scraper.resolveStreamByTitle(title, episode);
      }
    } catch (err) {
      console.warn('Scraper stream error:', err.message);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, streams }));
    return;
  }

  // Scraper Episode List for Otakudesu & Samehadaku
  if (pathname === '/api/scrapers/episodes') {
    const source = requestUrl.searchParams.get('source') || 'otakudesu';
    const targetUrl = requestUrl.searchParams.get('url') || '';
    let episodes = [];

    try {
      if (source.includes('otakudesu')) {
        episodes = await scraper.getOtakudesuAnimeEpisodes(targetUrl);
      } else if (source.includes('samehadaku')) {
        episodes = await scraper.getSamehadakuEpisodes(targetUrl);
      }
    } catch (err) {
      console.warn('Scraper episodes error:', err.message);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, episodes }));
    return;
  }

  if (pathname === '/api/anime') {
    const source = requestUrl.searchParams.get('source') || 'all';
    const page = requestUrl.searchParams.get('page') || '1';
    const perPage = requestUrl.searchParams.get('perPage') || '30';
    const search = requestUrl.searchParams.get('search') || '';
    const genre = requestUrl.searchParams.get('genre') || '';
    const status = requestUrl.searchParams.get('status') || '';
    const sort = requestUrl.searchParams.get('sort') || 'trending';

    // Route to live Samehadaku scraper
    if (source === 'samehadaku') {
      try {
        const items = search ? await scraper.searchSamehadaku(search) : await scraper.getSamehadakuLatest(page);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          count: items.length,
          items: items,
          source: 'Samehadaku',
          pageInfo: { hasNextPage: !search && items.length > 0, currentPage: parseInt(page, 10) || 1 }
        }));
        return;
      } catch (err) {
        console.warn('Samehadaku scraper error, fallback to AniList:', err.message);
      }
    }

    // Route to live Otakudesu scraper
    if (source === 'otakudesu') {
      try {
        const items = search ? await scraper.searchOtakudesu(search) : await scraper.getOtakudesuOngoing(page);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          count: items.length,
          items: items,
          source: 'Otakudesu',
          pageInfo: { hasNextPage: !search && items.length > 0, currentPage: parseInt(page, 10) || 1 }
        }));
        return;
      } catch (err) {
        console.warn('Otakudesu scraper error, fallback to AniList:', err.message);
      }
    }

    // Default: AniList + Unified
    const aniListData = await fetchFromAniList({ page, perPage, search, genre, status, sort });

    if (aniListData) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: aniListData.items.length,
        items: aniListData.items,
        pageInfo: aniListData.pageInfo
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Gagal memuat data dari upstream API' }));
    }
    return;
  }

  if (pathname.startsWith('/api/anime/')) {
    const id = pathname.replace('/api/anime/', '');
    const found = await fetchAnimeById(id);
    if (found) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: found }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Anime tidak ditemukan' }));
    }
    return;
  }

  // Static File Serving with HTTP 206 Partial Content for Video
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (ext === '.mp4' || ext === '.webm') {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Video not found');
        return;
      }

      const range = req.headers.range;
      const fileSize = stats.size;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes'
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    });
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(ROOT, 'index.html'), (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OtakuVerse Engine v2.2] Server berjalan di http://localhost:${PORT}`);
  console.log(`[OtakuVerse Engine v2.2] Streaming Video HTTP Range 206 Activated.`);
});
