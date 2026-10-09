const { execFile } = require('child_process');

function fetchCurlJSON(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '--doh-url', 'https://1.1.1.1/dns-query',
      '-sLk',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      url
    ], { maxBuffer: 1024 * 1024 * 5 }, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const MD_API = 'https://api.mangadex.org';

async function getLatestManga() {
    try {
        const res = await fetchCurlJSON(`${MD_API}/manga?limit=15&offset=0&includes[]=cover_art&availableTranslatedLanguage[]=id&order[updatedAt]=desc`);
        return res.data.map(manga => {
            const coverArt = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverArt ? coverArt.attributes.fileName : '';
            const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg` : '';
            return {
                id: manga.id,
                title: manga.attributes.title.en || manga.attributes.title['ja-ro'] || Object.values(manga.attributes.title)[0],
                cover: coverUrl,
                type: 'Manga'
            };
        });
    } catch (e) {
        console.error('MangaDex error:', e.message);
        return [];
    }
}

async function searchManga(query) {
    try {
        const res = await fetchCurlJSON(`${MD_API}/manga?limit=15&title=${encodeURIComponent(query)}&includes[]=cover_art&availableTranslatedLanguage[]=id&order[relevance]=desc`);
        return res.data.map(manga => {
            const coverArt = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverArt ? coverArt.attributes.fileName : '';
            const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg` : '';
            return {
                id: manga.id,
                title: manga.attributes.title.en || manga.attributes.title['ja-ro'] || Object.values(manga.attributes.title)[0],
                cover: coverUrl,
                type: 'Manga'
            };
        });
    } catch (e) {
        return [];
    }
}

async function getMangaChapters(mangaId) {
    try {
        const res = await fetchCurlJSON(`${MD_API}/manga/${mangaId}/feed?translatedLanguage[]=id&order[chapter]=desc&limit=100`);
        return res.data.map(ch => ({
            id: ch.id,
            chapter: ch.attributes.chapter,
            title: ch.attributes.title,
            externalUrl: ch.attributes.externalUrl
        }));
    } catch (e) {
        return [];
    }
}

async function getChapterImages(chapterId) {
    try {
        const res = await fetchCurlJSON(`${MD_API}/at-home/server/${chapterId}`);
        const baseUrl = res.baseUrl;
        const hash = res.chapter.hash;
        const data = res.chapter.data; // High quality images
        
        return data.map(file => `${baseUrl}/data/${hash}/${file}`);
    } catch (e) {
        return [];
    }
}

module.exports = { getLatestManga, searchManga, getMangaChapters, getChapterImages };
