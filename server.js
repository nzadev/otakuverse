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
    version: '2.0.0',
    author: 'Keiyoushi Community',
    icon: '⚡',
    status: 'installed',
    enabled: true,
    description: 'Sumber fansub anime Sub Indo tercepat (1080p FHD Direct MP4 & Poster HD AniList)',
    baseUrl: 'https://v2.samehadaku.how'
  },
  {
    id: 'otakudesu',
    name: 'Otakudesu',
    lang: 'ID',
    flag: '🇮🇩',
    version: '2.0.0',
    author: 'Keiyoushi Community',
    icon: '🌸',
    status: 'installed',
    enabled: true,
    description: 'Arsip anime lengkap tamat & ongoing Sub Indo (720p HD Direct MP4 & Mega)',
    baseUrl: 'https://otakudesu.blog'
  },
  {
    id: 'kuramanime',
    name: 'Kuramanime Mirror',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.5.0',
    author: 'Keiyoushi Community',
    icon: '🦊',
    status: 'installed',
    enabled: true,
    description: 'Mirror anime subtitle Indonesia 1080p/720p bebas buffering',
    baseUrl: 'https://kuramanime.pro'
  },
  {
    id: 'animeindo',
    name: 'AnimeIndo Mirror',
    lang: 'ID',
    flag: '🇮🇩',
    version: '1.2.0',
    author: 'Keiyoushi Community',
    icon: '🏮',
    status: 'installed',
    enabled: true,
    description: 'Arsip fansub anime subtitle Indonesia alternatif anti-blokir',
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
    description: 'Database anime global dengan multi-sub & softsub auto-resolver',
    baseUrl: 'https://hianime.to'
  },
  {
    id: 'gogoanime',
    name: 'GogoAnime Mirror',
    lang: 'EN',
    flag: '🇬🇧',
    version: '2.1.0',
    author: 'Keiyoushi Community',
    icon: '🌐',
    status: 'installed',
    enabled: true,
    description: 'Mirror rilis TV jepang tercepat dengan subtitle inggris & auto HD stream',
    baseUrl: 'https://gogoanimes.to'
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
  let statusStr = 'Upcoming';
  if (item.status === 'RELEASING') statusStr = 'Ongoing';
  else if (item.status === 'FINISHED') statusStr = 'Completed';
  else if (item.status === 'CANCELLED') statusStr = 'Cancelled';
  else if (item.status === 'HIATUS') statusStr = 'Hiatus';
  let trailerId = (item.trailer?.site === 'youtube') ? item.trailer.id : null;
  if (!trailerId && item.id === 21) trailerId = 'S8_YwFLCh4U'; // One Piece Egghead Arc Official Trailer
  if (!trailerId && item.id === 269) trailerId = 'e8YBesRKq_U'; // Bleach TYBW Official Trailer
  
  let nextAiring = null;
  if (item.nextAiringEpisode) {
    nextAiring = {
      airingAt: item.nextAiringEpisode.airingAt,
      timeUntilAiring: item.nextAiringEpisode.timeUntilAiring,
      episode: item.nextAiringEpisode.episode
    };
  }

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
      releaseDate: item.seasonYear ? `${item.season || 'Season'} ${item.seasonYear}` : '2026'
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
    year: item.seasonYear || 2026,
    studio: studio,
    season: `${item.season || ''} ${item.seasonYear || ''}`.trim(),
    badge: item.averageScore >= 85 ? 'Masterpiece' : (item.status === 'RELEASING' ? 'Trending' : 'Populer'),
    description: cleanDescription(item.description),
    cover: cover,
    banner: banner,
    trailerId: trailerId,
    episodes: episodes,
    nextAiringEpisode: nextAiring
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
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
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
    score: ['SCORE_DESC', 'POPULARITY_DESC'],
    updated: ['UPDATED_AT_DESC']
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
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
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

const requestHandler = async (req, res) => {
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

  // --- FD HARDWARE CHECK ROUTE ---
  if (pathname === '/api/check-admin-fd') {
    try {
      const storages = fs.readdirSync('/storage');
      // emulated and self are default internal storage symlinks on Android.
      // Any other folder (e.g. 1A2B-3C4D) indicates an external OTG/SD card.
      const hasFd = storages.some(s => s !== 'emulated' && s !== 'self' && s !== 'sdcard0' && s !== 'sdcard1');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, isAdmin: hasFd }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, isAdmin: false, error: e.message }));
    }
    return;
  }

  // --- MANGADEX ROUTES ---
  if (pathname === '/api/manga/latest') {
    const mangaScraper = require('./manga_scraper');
    const data = await mangaScraper.getLatestManga();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/manga/search') {
    const q = requestUrl.searchParams.get('q');
    if(!q) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, data: [] }));
        return;
    }
    const mangaScraper = require('./manga_scraper');
    const data = await mangaScraper.searchManga(q);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/manga/chapters') {
    const id = requestUrl.searchParams.get('id');
    if(!id) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, data: [] }));
        return;
    }
    const mangaScraper = require('./manga_scraper');
    const data = await mangaScraper.getMangaChapters(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/manga/read') {
    const chapterId = requestUrl.searchParams.get('id');
    if(!chapterId) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, data: [] }));
        return;
    }
    const mangaScraper = require('./manga_scraper');
    const data = await mangaScraper.getChapterImages(chapterId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }

  // --- LN ROUTES ---
  if (pathname === '/api/ln/latest') {
    const lnScraper = require('./ln_scraper');
    const data = await lnScraper.getLatest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/ln/search') {
    const q = requestUrl.searchParams.get('q');
    if(!q) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const lnScraper = require('./ln_scraper');
    const data = await lnScraper.search(q);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/ln/chapters') {
    const id = requestUrl.searchParams.get('id');
    if(!id) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const lnScraper = require('./ln_scraper');
    const data = await lnScraper.getChapters(id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/ln/read') {
    const id = requestUrl.searchParams.get('id');
    if(!id) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const lnScraper = require('./ln_scraper');
    const data = await lnScraper.read(id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }

  // --- WN ROUTES ---
  if (pathname === '/api/wn/latest') {
    const wnScraper = require('./wn_scraper');
    const data = await wnScraper.getLatest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/wn/search') {
    const q = requestUrl.searchParams.get('q');
    if(!q) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const wnScraper = require('./wn_scraper');
    const data = await wnScraper.search(q);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/wn/chapters') {
    const id = requestUrl.searchParams.get('id');
    if(!id) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const wnScraper = require('./wn_scraper');
    const data = await wnScraper.getChapters(id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (pathname === '/api/wn/read') {
    const id = requestUrl.searchParams.get('id');
    if(!id) res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, data: [] }));
    return;
    const wnScraper = require('./wn_scraper');
    const data = await wnScraper.read(id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data }));
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
    const romaji = requestUrl.searchParams.get('romaji') || '';
    const episode = requestUrl.searchParams.get('episode') || '1';
    const isAdult = requestUrl.searchParams.get('isAdult') === 'true';
    let streams = [];

    try {
      if (isAdult) {
        streams = await scraper.getHanimeStreams(title || romaji, episode);
      } else if (targetUrl && source.includes('samehadaku')) {
        streams = await scraper.getSamehadakuStreams(targetUrl);
      } else if (targetUrl && source.includes('otakudesu')) {
        streams = await scraper.getOtakudesuStreams(targetUrl);
      }

      // Always resolve cross-source mirrors (Otakudesu + Samehadaku) to supply healthy Direct MP4 streams
      // even if targetUrl has dead/expired Mega links
      if (!isAdult && (title || romaji)) {
        const resolvedStreams = await scraper.resolveStreamByTitle(title, episode, romaji, source);
        if (resolvedStreams && resolvedStreams.length > 0) {
          const seen = new Set(streams.map(s => s.url));
          for (const s of resolvedStreams) {
            if (!seen.has(s.url)) {
              seen.add(s.url);
              streams.push(s);
            }
          }
        }
      }

      // Sort streams with hardware acceleration score: Direct MP4 > Clean Embeds > Mega (penalty)
      const scoreStream = (s) => {
        let score = 0;
        if (s.type === 'video') score += 1000;
        if (s.quality === '1080p') score += 400;
        else if (s.quality === '720p') score += 300;
        else if (s.quality === '480p') score += 200;
        else if (s.quality === '360p') score += 100;
        if (s.url && s.url.includes('mega.nz')) score -= 500;
        if (s.isBlogger || (s.url && s.url.includes('blogger.com'))) score -= 300;
        return score;
      };
      streams.sort((a, b) => scoreStream(b) - scoreStream(a));
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

  // Secret Admin & Special 18+ Anime Vault API
  if (pathname === '/api/special-anime') {
    const specialFile = path.join(__dirname, 'data', 'special_anime.json');
    let specialItems = [];
    if (fs.existsSync(specialFile)) {
      try {
        specialItems = JSON.parse(fs.readFileSync(specialFile, 'utf8'));
      } catch (e) {}
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({ success: true, count: specialItems.length, items: specialItems }));
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

    // Route Special 18+ / Ecchi genre filter
    if (genre.toLowerCase().includes('spesial') || genre.toLowerCase().includes('18+') || genre.toLowerCase() === 'ecchi') {
      const specialFile = path.join(__dirname, 'data', 'special_anime.json');
      let specialItems = [];
      if (fs.existsSync(specialFile)) {
        try {
          specialItems = JSON.parse(fs.readFileSync(specialFile, 'utf8'));
        } catch (e) {}
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify({
        success: true,
        count: specialItems.length,
        items: specialItems,
        source: 'Late Night Vault',
        pageInfo: { hasNextPage: false, currentPage: 1 }
      }));
      return;
    }

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
        console.warn('Samehadaku scraper error, fallback to Otakudesu:', err.message);
        try {
          const items = search ? await scraper.searchOtakudesu(search) : await scraper.getOtakudesuOngoing(page);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            count: items.length,
            items: items,
            source: 'Otakudesu (Auto-Fallback)',
            pageInfo: { hasNextPage: !search && items.length > 0, currentPage: parseInt(page, 10) || 1 }
          }));
          return;
        } catch (err2) {
          console.warn('Otakudesu auto-fallback error, fallback to AniList:', err2.message);
        }
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

    // Route to Kuramanime / AnimeIndo Sub Indo Mirrors
    if (source === 'kuramanime' || source === 'animeindo') {
      try {
        const items = search ? await scraper.searchSamehadaku(search) : await scraper.getSamehadakuLatest(page);
        const mirrorName = source === 'kuramanime' ? 'Kuramanime HD Mirror' : 'AnimeIndo Archive Mirror';
        items.forEach(i => { i.source = mirrorName; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          count: items.length,
          items: items,
          source: mirrorName,
          pageInfo: { hasNextPage: !search && items.length > 0, currentPage: parseInt(page, 10) || 1 }
        }));
        return;
      } catch (err) {
        console.warn('Mirror scraper error, fallback to AniList:', err.message);
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
  // Schedule Endpoint

  if (pathname === '/api/history') {
    const historyFile = path.join(__dirname, 'watch_history.json');
    
    if (req.method === 'GET') {
      try {
        if (!fs.existsSync(historyFile)) {
          fs.writeFileSync(historyFile, '[]');
        }
        const data = fs.readFileSync(historyFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          // Verify valid JSON
          JSON.parse(body);
          fs.writeFileSync(historyFile, body, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/schedule/upcoming') {
    try {
      const query = `
      query {
        Page (page: 1, perPage: 30) {
          media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
              userPreferred
            }
            coverImage {
              large
              medium
            }
            bannerImage
            episodes
            status
            genres
            season
            seasonYear
            isAdult
            trailer {
              id
              site
            }
          }
        }
      }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000)
      });
      const responseData = await response.json();
      const upcoming = responseData.data.Page.media || [];
      
      const mapped = upcoming.map(m => transformMedia(m));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: mapped }));
    } catch (e) {
      console.error('Upcoming fetch error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (pathname === '/api/schedule') {
    try {
      // Set to current week (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      
      const startOfWeek = new Date(now.setDate(diffToMonday));
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startUnix = Math.floor(startOfWeek.getTime() / 1000);
      const endUnix = Math.floor(endOfWeek.getTime() / 1000);

      let allSchedules = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const query = `
        query {
          Page (page: ${page}, perPage: 100) {
            pageInfo {
              hasNextPage
            }
            airingSchedules (
              airingAt_greater: ${startUnix}, 
              airingAt_lesser: ${endUnix},
              sort: TIME
            ) {
              id
              episode
              airingAt
              media {
                id
                title {
                  romaji
                  english
                  native
                  userPreferred
                }
                coverImage {
                  large
                  medium
                }
                bannerImage
                episodes
                status
                genres
                season
                seasonYear
                isAdult
                nextAiringEpisode {
                  airingAt
                  timeUntilAiring
                  episode
                }
                trailer {
                  id
                  site
                }
              }
            }
          }
        }
        `;

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000)
        });
        const responseData = await response.json();
        
        if (!responseData.data || !responseData.data.Page) {
          break;
        }

        const schedules = responseData.data.Page.airingSchedules || [];
        allSchedules = allSchedules.concat(schedules);
        
        hasNextPage = responseData.data.Page.pageInfo.hasNextPage;
        page++;
        
        if (page > 5) break; // hard limit to prevent infinite loops (500 items max)
      }

      const mapped = allSchedules.map(s => {
        return {
          airingAt: s.airingAt,
          episode: s.episode,
          media: transformMedia(s.media)
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: mapped }));
    } catch (e) {
      console.error('Schedule fetch error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

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
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    }
  });
};

const server = http.createServer(requestHandler);

// Vercel Serverless Export
if (process.env.VERCEL) {
  module.exports = requestHandler;
} else {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[OtakuVerse Engine v2.2] Server berjalan di http://localhost:${PORT}`);
    console.log(`[OtakuVerse Engine v2.2] Streaming Video HTTP Range 206 Activated.`);
  });
}


