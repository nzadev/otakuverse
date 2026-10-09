// ==========================================================================
// OTAKUVERSE — LIVE ANIME EXTRACTOR & SCRAPER ENGINE (Keiyoushi Spec)
// Real-Time Scraping for Samehadaku (v2.samehadaku.how) & Otakudesu (otakudesu.blog)
// ==========================================================================

const { execFile } = require('child_process');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// In-memory scraper cache (5 minutes TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function fetchCurl(url, extraArgs = []) {
  const cacheKey = `${url}:${extraArgs.join(' ')}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.time < CACHE_TTL)) {
    return Promise.resolve(cached.data);
  }

  return new Promise((resolve, reject) => {
    execFile('curl', [
      '--doh-url', 'https://1.1.1.1/dns-query',
      '-k',
      '-sL',
      '--max-time', '10',
      '-A', USER_AGENT,
      '-H', 'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8',
      ...extraArgs,
      url
    ], (err, stdout) => {
      if (err) return reject(err);
      cache.set(cacheKey, { time: Date.now(), data: stdout });
      resolve(stdout);
    });
  });
}

// In-memory poster cache for AniList HD Key Visuals (1 hour TTL)
const posterCache = new Map();

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .trim();
}

function cleanTitleForPosterMatch(rawTitle) {
  if (!rawTitle) return [];
  const decoded = decodeHtmlEntities(rawTitle);

  const noParen = decoded.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const noEp = noParen.replace(/Episode\s*\d+/gi, '').replace(/\bEp\s*\d+/gi, '').trim();

  const cands = [];
  
  // Base title without Season/S/Part suffixes
  const base = noEp
    .replace(/\s+(?:Season|S)\s*\d+/gi, '')
    .replace(/\s+Part\s*\d+/gi, '')
    .replace(/\s+(?:II|III|IV|V)\b/g, '')
    .trim();
  if (base) cands.push(base);
  if (noEp && noEp !== base) cands.push(noEp);

  // If title has a subtitle after colon or hyphen, try main title
  const colonPart = base.split(/[:\-–—]/)[0].trim();
  if (colonPart && colonPart.length >= 3 && colonPart !== base) {
    cands.push(colonPart);
  }

  // Handle "Shin " prefix (e.g. "Shin Tennis no Oujisama" -> "Tennis no Ouji-sama")
  if (base.toLowerCase().startsWith('shin ')) {
    cands.push(base.slice(5).trim());
  }

  if (base.includes('Oujisama')) {
    cands.push(base.replace(/Oujisama/g, 'Ouji-sama').split(/[:\-–—]/)[0].trim());
    cands.push('Shin Tennis no Ouji-sama');
  }

  return [...new Set(cands.filter(c => c && c.length >= 2))];
}

async function warmupPosterCache() {
  if (posterCache.size > 0) return;
  try {
    const query = `
      query {
        Page(page: 1, perPage: 50) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
            title { romaji english }
            coverImage { extraLarge large }
            bannerImage
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (res.ok) {
      const payload = await res.json();
      const mediaList = payload.data?.Page?.media || [];
      for (const m of mediaList) {
        const cover = m.coverImage?.extraLarge || m.coverImage?.large;
        const banner = m.bannerImage || cover;
        if (!cover) continue;
        if (m.title?.romaji) {
          cleanTitleForPosterMatch(m.title.romaji).forEach(c => {
            posterCache.set(c.toLowerCase(), { poster: cover, backdrop: banner });
          });
        }
        if (m.title?.english) {
          cleanTitleForPosterMatch(m.title.english).forEach(c => {
            posterCache.set(c.toLowerCase(), { poster: cover, backdrop: banner });
          });
        }
      }
    }
  } catch (err) {
    // ignore
  }
}

// Warmup cache immediately in background
warmupPosterCache();

async function enrichItemsWithAniListCovers(items) {
  if (!items || items.length === 0) return items;

  // Ensure pre-warm has run
  if (posterCache.size === 0) {
    await warmupPosterCache();
  }

  // 1. Check in-memory cache first
  const missing = [];
  for (const item of items) {
    const candidates = cleanTitleForPosterMatch(item.title);
    let found = null;
    for (const cand of candidates) {
      const lower = cand.toLowerCase();
      if (posterCache.has(lower)) {
        found = posterCache.get(lower);
        break;
      }
    }
    if (found) {
      item.poster = found.poster || item.poster;
      item.backdrop = found.backdrop || item.backdrop;
    } else {
      missing.push({ item, candidate: candidates[0] || item.title });
    }
  }

  // 2. If all matched from cache, return immediately (0ms)
  if (missing.length === 0) return items;

  // 3. Batched single-request query for all missing items (prevents 429 rate limit and 404 aborts!)
  const batchQueries = [];
  missing.forEach((m, idx) => {
    const safeSearch = JSON.stringify(m.candidate);
    batchQueries.push(`a${idx}: Page(page: 1, perPage: 1) { media(search: ${safeSearch}, type: ANIME) { title { romaji english } coverImage { extraLarge large } bannerImage } }`);
  });

  try {
    const batchQuery = `query {\n${batchQueries.join('\n')}\n}`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: batchQuery })
    });
    if (res.ok) {
      const payload = await res.json();
      const data = payload.data || {};
      missing.forEach((m, idx) => {
        const media = data[`a${idx}`]?.media?.[0];
        if (media && media.coverImage) {
          const hdCover = media.coverImage.extraLarge || media.coverImage.large;
          const banner = media.bannerImage || hdCover;
          if (hdCover) {
            cleanTitleForPosterMatch(m.item.title).forEach(c => {
              posterCache.set(c.toLowerCase(), { poster: hdCover, backdrop: banner });
            });
            m.item.poster = hdCover;
            m.item.backdrop = banner;
          }
        }
      });
    }
  } catch (err) {
    // keep original poster on network error
  }

  return items;
}

// ==========================================================================
// 1. SAMEHADAKU LIVE SCRAPER (v2.samehadaku.how)
// ==========================================================================
const SAMEHADAKU_BASE = 'https://v2.samehadaku.how';

async function getSamehadakuLatest(page = 1) {
  const p = parseInt(page, 10) || 1;
  const targetUrl = p === 1 ? `${SAMEHADAKU_BASE}/anime-terbaru/` : `${SAMEHADAKU_BASE}/anime-terbaru/page/${p}/`;
  const html = await fetchCurl(targetUrl);
  const items = [];
  const seenSlugs = new Set();

  const parseFromHtml = (content) => {
    const matches = [...content.matchAll(/<div class="thumb">\s*<a href="([^"]+)"\s*title="([^"]+)"[^>]*>[\s\S]*?<img [^>]*src="([^"]+)"/g)];
    for (const match of matches) {
      const fullUrl = match[1];
      const rawTitle = decodeHtmlEntities(match[2]);
      const poster = match[3];

      const numMatch = fullUrl.match(/episode-(\d+)/i) || rawTitle.match(/Episode\s*(\d+)/i);
      const epNum = numMatch ? parseInt(numMatch[1], 10) : 1;
      const cleanTitle = rawTitle.replace(/Episode\s*\d+/i, '').replace(/\[BATCH\]/i, '').trim();
      const slug = fullUrl.replace(SAMEHADAKU_BASE, '').replace(/^\/|\/$/g, '');

      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      items.push({
        id: `sh_${slug}`,
        slug: slug,
        title: cleanTitle || rawTitle,
        native_title: 'Samehadaku Sub Indo',
        episode_number: epNum,
        episodes_count: epNum || 12,
        url: fullUrl,
        poster: poster,
        backdrop: poster,
        source: 'Samehadaku (ID)',
        score: 8.8,
        status: 'Ongoing',
        type: 'TV Series',
        genres: ['Action', 'Fantasy', 'Sub Indo'],
        synopsis: `Serial anime ${cleanTitle || rawTitle} subtitle Indonesia terbaru tayang di fansub Samehadaku.`,
        episodes: [
          {
            number: epNum,
            num: epNum,
            title: `Episode ${epNum}`,
            url: fullUrl,
            duration: '24:00',
            stream_url: `/api/scrapers/stream-proxy?source=samehadaku&url=${encodeURIComponent(fullUrl)}`
          }
        ]
      });
    }
  };

  parseFromHtml(html);

  if (p === 1) {
    try {
      const homeHtml = await fetchCurl(SAMEHADAKU_BASE);
      parseFromHtml(homeHtml);
    } catch (e) {
      // ignore
    }
  }

  await enrichItemsWithAniListCovers(items);
  return items;
}

async function searchSamehadaku(query) {
  const html = await fetchCurl(`${SAMEHADAKU_BASE}/?s=${encodeURIComponent(query)}`);
  const items = [];

  const matches = [...html.matchAll(/<div class="animposx">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[\s\S]*?<img[^>]*src="([^"]+)"/g)];

  for (const match of matches) {
    const url = match[1];
    const rawTitle = decodeHtmlEntities(match[2]);
    const poster = match[3];
    const slug = url.replace(SAMEHADAKU_BASE, '').replace(/^\/|\/$/g, '');

    items.push({
      id: `sh_${slug}`,
      slug: slug,
      title: rawTitle,
      native_title: 'Samehadaku Sub Indo',
      episode_number: 1,
      episodes_count: 12,
      url: url,
      poster: poster,
      backdrop: poster,
      source: 'Samehadaku (ID)',
      score: 8.8,
      status: url.includes('batch') ? 'Completed' : 'Ongoing',
      type: 'TV Series',
      genres: ['Action', 'Shounen', 'Sub Indo'],
      synopsis: `Serial anime ${rawTitle} subtitle Indonesia di repositori Samehadaku.`,
      episodes: [
        {
          number: 1,
          num: 1,
          title: 'Episode 1',
          url: url,
          duration: '24:00',
          stream_url: `/api/scrapers/stream-proxy?source=samehadaku&url=${encodeURIComponent(url)}`
        }
      ]
    });
  }

  await enrichItemsWithAniListCovers(items);
  return items;
}

async function getSamehadakuStreams(episodeUrl) {
  const html = await fetchCurl(episodeUrl);
  const streams = [];

  // 1. Direct high-speed MP4 streams (e.g. wibufile.com FULLHD / HD)
  const mp4Matches = [...html.matchAll(/https:\/\/[^\"'\s]+(?:wibufile\.com|samehadaku)[^\"'\s]+\.mp4/g)];
  for (const m of mp4Matches) {
    const mp4Url = m[0];
    const is1080 = mp4Url.toUpperCase().includes('FULLHD') || mp4Url.includes('1080');
    streams.push({
      server: is1080 ? '⚡ Samehadaku 1080p Full HD (Direct MP4)' : '⚡ Samehadaku 720p HD (Direct MP4)',
      url: mp4Url,
      type: 'video',
      quality: is1080 ? '1080p' : '720p'
    });
  }

  // 2. Labeled Embeds (Mega 1080p, Mega 720p, Pixeldrain, Blogger)
  const labeledEmbeds = [...html.matchAll(/data-embed="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>/g)];
  for (const m of labeledEmbeds) {
    const raw = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const srcMatch = raw.match(/src="([^"]+)"/);
    if (!srcMatch) continue;

    const streamUrl = srcMatch[1];
    const label = m[2].trim();
    let quality = '720p';
    if (label.includes('1080p') || streamUrl.includes('1080')) quality = '1080p';
    else if (label.includes('720p') || streamUrl.includes('720')) quality = '720p';
    else if (label.includes('480p') || streamUrl.includes('480')) quality = '480p';
    else if (label.includes('360p') || label.toLowerCase().includes('blogspot') || streamUrl.includes('blogger')) quality = '360p';

    if (streamUrl.includes('mega.nz/embed')) {
      streams.push({
        server: `Samehadaku Mega Cloud [${quality.toUpperCase()}]`,
        url: streamUrl,
        type: 'iframe',
        quality: quality
      });
    } else if (streamUrl.includes('pixeldrain.com')) {
      streams.push({
        server: `Samehadaku Pixeldrain HD [${quality.toUpperCase()}]`,
        url: streamUrl,
        type: 'iframe',
        quality: quality
      });
    } else if (streamUrl.includes('blogger.com/video.g')) {
      streams.push({
        server: `Samehadaku Blogspot (Cadangan Rendah) [${quality}]`,
        url: streamUrl,
        type: 'iframe',
        quality: quality,
        isBlogger: true
      });
    }
  }

  // 3. Fallback to any remaining data-embed if no labeled embeds found
  if (streams.length === 0) {
    const embedMatches = [...html.matchAll(/data-embed="([^"]+)"/g)];
    for (const m of embedMatches) {
      const raw = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const srcMatch = raw.match(/src="([^"]+)"/);
      if (!srcMatch) continue;

      const streamUrl = srcMatch[1];
      const isMega = streamUrl.includes('mega.nz/embed');
      const is1080 = isMega || streamUrl.includes('1080');
      streams.push({
        server: isMega ? 'Samehadaku Mega Cloud [1080P]' : 'Samehadaku Web Stream [720P]',
        url: streamUrl,
        type: 'iframe',
        quality: is1080 ? '1080p' : '720p'
      });
    }
  }

  // Deduplicate streams
  const uniqueStreams = [];
  const seenUrls = new Set();
  for (const s of streams) {
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueStreams.push(s);
    }
  }

  // STRICT HARDWARE-ACCELERATED STREAM SORTING: Direct MP4 (GPU decode) > Clean iframe > Mega/Blogger
  const scoreStream = (s) => {
    let score = 0;
    if (s.type === 'video') score += 1000;
    if (s.quality === '1080p') score += 400;
    else if (s.quality === '720p') score += 300;
    else if (s.quality === '480p') score += 200;
    else if (s.quality === '360p') score += 100;
    if (s.url && s.url.includes('mega.nz')) score -= 200;
    if (s.isBlogger || (s.url && s.url.includes('blogger.com'))) score -= 300;
    return score;
  };

  uniqueStreams.sort((a, b) => scoreStream(b) - scoreStream(a));

  return uniqueStreams;
}

async function getSamehadakuEpisodes(targetUrl) {
  let html = await fetchCurl(targetUrl);
  const episodes = [];

  // If targetUrl is an episode page, check if there's an "All Episode" link to fetch complete series page
  const allEpMatch = html.match(/<a[^>]*href="(https:\/\/v2\.samehadaku\.how\/anime\/[^"]+)"[^>]*>All Episode<\/a>/i) ||
                     html.match(/<a[^>]*href="(https:\/\/v2\.samehadaku\.how\/anime\/[^"]+)"[^>]*title="[^"]*All Episode[^"]*"/i);
  
  if (allEpMatch && allEpMatch[1] && allEpMatch[1] !== targetUrl) {
    try {
      const seriesHtml = await fetchCurl(allEpMatch[1]);
      html += '\n' + seriesHtml;
    } catch (e) {
      // continue with existing html
    }
  }

  const epRegex = /https:\/\/v2\.samehadaku\.how\/([a-zA-Z0-9_-]+-episode-([0-9]+)(?:-end)?\/)/g;
  const matches = [...html.matchAll(epRegex)];

  const seenUrls = new Set();
  for (const m of matches) {
    const fullUrl = `https://v2.samehadaku.how/${m[1]}`;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const epNum = parseInt(m[2], 10);
    episodes.push({
      number: epNum,
      num: epNum,
      title: `Episode ${epNum}`,
      url: fullUrl,
      duration: '24:00',
      stream_url: `/api/scrapers/stream-proxy?source=samehadaku&url=${encodeURIComponent(fullUrl)}`
    });
  }

  // If none found (e.g. single episode page or batch), at least include targetUrl
  if (episodes.length === 0 && targetUrl) {
    const numMatch = targetUrl.match(/episode-(\d+)/i);
    const epNum = numMatch ? parseInt(numMatch[1], 10) : 1;
    episodes.push({
      number: epNum,
      num: epNum,
      title: `Episode ${epNum}`,
      url: targetUrl,
      duration: '24:00',
      stream_url: `/api/scrapers/stream-proxy?source=samehadaku&url=${encodeURIComponent(targetUrl)}`
    });
  }

  episodes.sort((a, b) => a.number - b.number);
  return episodes;
}

// ==========================================================================
// 2. OTAKUDESU LIVE SCRAPER (otakudesu.blog)
// ==========================================================================
const OTAKUDESU_BASE = 'https://otakudesu.blog';

async function getOtakudesuOngoing(page = 1) {
  const p = parseInt(page, 10) || 1;
  const targetUrl = p === 1 ? `${OTAKUDESU_BASE}/ongoing-anime/` : `${OTAKUDESU_BASE}/ongoing-anime/page/${p}/`;
  const html = await fetchCurl(targetUrl);
  const items = [];

  const matches = [...html.matchAll(/<div class="thumb">\s*<a href="([^"]+)"[^>]*>[\s\S]*?<img [^>]*src="([^"]+)"[\s\S]*?<h2 class="jdlflm">([^<]+)<\/h2>/g)];

  for (const match of matches) {
    const animeUrl = match[1];
    const poster = match[2];
    const rawTitle = decodeHtmlEntities(match[3]);
    const slug = animeUrl.replace(`${OTAKUDESU_BASE}/anime/`, '').replace(/\/$/, '');

    const idx = html.indexOf(animeUrl);
    const beforeBlock = idx !== -1 ? html.slice(Math.max(0, idx - 250), idx) : '';
    const epMatch = beforeBlock.match(/Episode\s*(\d+)/i);
    const epNum = epMatch ? parseInt(epMatch[1], 10) : 12;

    items.push({
      id: `od_${slug}`,
      slug: slug,
      title: rawTitle,
      native_title: 'Otakudesu Sub Indo',
      episode_number: epNum,
      episodes_count: epNum || 12,
      url: animeUrl,
      poster: poster,
      backdrop: poster,
      source: 'Otakudesu (ID)',
      score: 8.7,
      status: 'Ongoing',
      type: 'TV Series',
      genres: ['Action', 'Adventure', 'Sub Indo'],
      synopsis: `Serial anime ${rawTitle} subtitle Indonesia tayang di server Otakudesu.`,
      episodes: [
        {
          number: 1,
          num: 1,
          title: 'Episode 1',
          url: animeUrl,
          duration: '24:00',
          stream_url: `/api/scrapers/stream-proxy?source=otakudesu&url=${encodeURIComponent(animeUrl)}`
        }
      ]
    });
  }

  await enrichItemsWithAniListCovers(items);
  return items;
}

async function searchOtakudesu(query) {
  const html = await fetchCurl(`${OTAKUDESU_BASE}/?s=${encodeURIComponent(query)}&post_type=anime`);
  const items = [];

  const matches = [...html.matchAll(/<li style=[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<h2><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>[\s\S]*?<b>Rating<\/b>\s*:\s*([0-9.]+)/g)];

  for (const match of matches) {
    const poster = match[1];
    const url = match[2];
    const rawTitle = decodeHtmlEntities(match[3]);
    const rating = parseFloat(match[4]) || 8.5;
    const slug = url.replace(`${OTAKUDESU_BASE}/anime/`, '').replace(/\/$/, '');

    items.push({
      id: `od_${slug}`,
      slug: slug,
      title: rawTitle,
      native_title: 'Otakudesu Sub Indo',
      episode_number: 1,
      episodes_count: 12,
      url: url,
      poster: poster,
      backdrop: poster,
      source: 'Otakudesu (ID)',
      score: rating,
      status: 'Ongoing',
      type: 'TV Series',
      genres: ['Action', 'Fantasy', 'Sub Indo'],
      synopsis: `Serial anime ${rawTitle} subtitle Indonesia di server Otakudesu.`,
      episodes: [
        {
          number: 1,
          num: 1,
          title: 'Episode 1',
          url: url,
          duration: '24:00',
          stream_url: `/api/scrapers/stream-proxy?source=otakudesu&url=${encodeURIComponent(url)}`
        }
      ]
    });
  }

  await enrichItemsWithAniListCovers(items);
  return items;
}

async function getOtakudesuAnimeEpisodes(animeUrl) {
  const html = await fetchCurl(animeUrl);
  const episodes = [];

  const matches = [...html.matchAll(/<a href="(https:\/\/otakudesu\.blog\/episode\/[^"]+)"[^>]*>([^<]+)<\/a>/g)];
  for (const m of matches) {
    const epUrl = m[1];
    const epTitle = m[2].trim();
    const numMatch = epTitle.match(/Episode\s*(\d+)/i);
    const epNum = numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1;

    episodes.push({
      number: epNum,
      num: epNum,
      title: epTitle,
      url: epUrl,
      duration: '24:00',
      stream_url: `/api/scrapers/stream-proxy?source=otakudesu&url=${encodeURIComponent(epUrl)}`
    });
  }

  const unique = [];
  const seen = new Set();
  for (const ep of episodes) {
    if (!seen.has(ep.url)) {
      seen.add(ep.url);
      unique.push(ep);
    }
  }

  unique.sort((a, b) => a.number - b.number);

  if (unique.length === 0 && animeUrl) {
    unique.push({
      number: 1,
      num: 1,
      title: 'Episode 1',
      url: animeUrl,
      duration: '24:00',
      stream_url: `/api/scrapers/stream-proxy?source=otakudesu&url=${encodeURIComponent(animeUrl)}`
    });
  }

  return unique;
}

async function getOtakudesuStreams(episodeUrl) {
  const html = await fetchCurl(episodeUrl);
  const streams = [];

  const dcMatches = [...html.matchAll(/data-content="([^"]+)"/g)];
  if (dcMatches.length > 0) {
    try {
      const nonceJson = await fetchCurl(`${OTAKUDESU_BASE}/wp-admin/admin-ajax.php`, [
        '-d', 'action=aa1208d27f29ca340c92c66d1926f13f'
      ]);
      const nonce = JSON.parse(nonceJson).data;

      // Scan up to 10 quality streams (prioritizing 720p HD and 480p)
      for (let i = 0; i < Math.min(dcMatches.length, 10); i++) {
        try {
          const payload = JSON.parse(Buffer.from(dcMatches[i][1], 'base64').toString());
          const streamJson = await fetchCurl(`${OTAKUDESU_BASE}/wp-admin/admin-ajax.php`, [
            '-d', `id=${payload.id}&i=${payload.i}&q=${payload.q}&nonce=${nonce}&action=2a3505c93b0035d3f455df82bf976b84`
          ]);
          const parsedRes = JSON.parse(streamJson);
          if (parsedRes && parsedRes.data) {
            const iframeHtml = Buffer.from(parsedRes.data, 'base64').toString();
            const srcMatch = iframeHtml.match(/src="([^"]+)"/);
            if (srcMatch) {
              const url = srcMatch[1];
              const q = payload.q || '720p';

              // If desustream.net, extract direct MP4 file to prevent Firefox CSP frame-ancestors block
              if (url.includes('desustream')) {
                try {
                  const desuHtml = await fetchCurl(url, ['-e', 'https://otakudesu.blog/']);
                  const mp4Match = desuHtml.match(/https:\/\/[^\"']+\.mp4/);
                  if (mp4Match) {
                    streams.push({
                      server: `Otakudesu DesuStream [${q.toUpperCase()}] (Direct MP4)`,
                      url: mp4Match[0],
                      type: 'video',
                      quality: q
                    });
                    continue;
                  }
                } catch (err) {}
              }

              const srvName = url.includes('mega') ? 'Mega HD' : (url.includes('desu') ? 'DesuStream' : 'Odvidhide');
              streams.push({
                server: `Otakudesu ${srvName} [${q.toUpperCase()}]`,
                url: url,
                type: 'iframe',
                quality: q
              });
            }
          }
        } catch (e) {
          // ignore single item fail
        }
      }
    } catch (err) {
      console.warn('Gagal ekstrak Otakudesu streams:', err.message);
    }
  }

  // STRICT HARDWARE-ACCELERATED STREAM SORTING: Direct MP4 (GPU decode) > Clean iframe > Mega/Blogger
  const scoreStream = (s) => {
    let score = 0;
    if (s.type === 'video') score += 1000;
    if (s.quality === '1080p') score += 400;
    else if (s.quality === '720p') score += 300;
    else if (s.quality === '480p') score += 200;
    else if (s.quality === '360p') score += 100;
    if (s.url && s.url.includes('mega.nz')) score -= 200;
    if (s.isBlogger || (s.url && s.url.includes('blogger.com'))) score -= 300;
    return score;
  };

  uniqueStreams.sort((a, b) => scoreStream(b) - scoreStream(a));

  return uniqueStreams;
}

// Automatically resolve streams for ANY anime title and episode number
async function resolveStreamByTitle(title, episodeNumber = 1, romajiTitle = '') {
  if (!title && !romajiTitle) return [];
  const ep = parseInt(episodeNumber, 10) || 1;

  // Extract core keywords from both title and romaji (handling English + Romaji parenthesized formats)
  const candidates = [];
  const addCandidate = (str) => {
    if (!str) return;
    const clean = str
      .replace(/Season\s*\d+/gi, '')
      .replace(/S\d+/gi, '')
      .replace(/Part\s*\d+/gi, '')
      .replace(/\b(?:II|III|IV|V)\b/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean && clean.length >= 3) candidates.push(clean);
  };

  if (romajiTitle) addCandidate(romajiTitle);

  if (title) {
    const parenMatch = title.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      addCandidate(parenMatch[1]);
    }
    const outsideParen = title.replace(/\([^)]*\)/g, '').trim();
    addCandidate(outsideParen);
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  // 1. Search Samehadaku with all candidates
  for (const query of uniqueCandidates) {
    try {
      const shResults = await searchSamehadaku(query);
      if (shResults.length > 0) {
        const epMatch = shResults.find(r => r.url.includes(`episode-${ep}`) || r.title.includes(`Episode ${ep}`));
        if (epMatch) {
          const streams = await getSamehadakuStreams(epMatch.url);
          if (streams.length > 0) return streams;
        }
        const seriesEps = await getSamehadakuEpisodes(shResults[0].url);
        const targetEp = seriesEps.find(e => e.number === ep) || seriesEps[0];
        if (targetEp && targetEp.url) {
          const streams = await getSamehadakuStreams(targetEp.url);
          if (streams.length > 0) return streams;
        }
      }
    } catch (e) {
      console.warn('[Resolve] Samehadaku error for query:', query, e.message);
    }
  }

  // 2. Search Otakudesu with all candidates
  for (const query of uniqueCandidates) {
    try {
      const odResults = await searchOtakudesu(query);
      if (odResults.length > 0) {
        const seriesEps = await getOtakudesuAnimeEpisodes(odResults[0].url);
        const targetEp = seriesEps.find(e => e.number === ep) || seriesEps[0];
        if (targetEp && targetEp.url) {
          const streams = await getOtakudesuStreams(targetEp.url);
          if (streams.length > 0) return streams;
        }
      }
    } catch (e) {
      console.warn('[Resolve] Otakudesu error for query:', query, e.message);
    }
  }

  return [];
}

module.exports = {
  getSamehadakuLatest,
  searchSamehadaku,
  getSamehadakuEpisodes,
  getSamehadakuStreams,
  getOtakudesuOngoing,
  searchOtakudesu,
  getOtakudesuAnimeEpisodes,
  getOtakudesuStreams,
  resolveStreamByTitle
};
