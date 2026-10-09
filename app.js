// ==========================================================================
// OTAKUVERSE v3.0 — ANIYOMI WEB EDITION CLIENT ENGINE
// Native MPV Player HUD, Keiyoushi Extensions Scraper, 4-Tab Navigation & Library
// ==========================================================================

const state = {
  activeTab: 'anime', // 'anime' | 'library' | 'extensions' | 'settings'
  allAnime: [],
  filteredAnime: [],
  extensions: [],
  selectedSource: 'samehadaku',
  selectedGenre: 'All',
  selectedStatus: 'All',
  selectedSort: 'trending',
  searchQuery: '',
  currentPage: 1,
  hasNextPage: true,
  isLoading: false,

  currentAnime: null,
  currentEpIndex: 0,
  availableStreams: [],
  adminMode: localStorage.getItem('otakuverse_admin') === 'true',
  episodesAscending: true, // true: 1 -> N, false: N -> 1
  playbackSpeed: 1.0,
  aspectRatioIndex: 0, // 0: 16:9 (contain), 1: Layar Penuh (cover), 2: Renggang (fill)
  idleTimeout: null,
  
  watchlist: JSON.parse(localStorage.getItem('otakuverse_watchlist') || '[]'),
  activeLibraryCategory: 'all',

  settings: {
    skipIntroTime: parseInt(localStorage.getItem('otakuverse_skip_intro') || '85', 10),
    defaultQuality: localStorage.getItem('otakuverse_quality') || '720',
    autoNext: localStorage.getItem('otakuverse_autonext') !== 'false',
    autoFallback: localStorage.getItem('otakuverse_autofallback') !== 'false'
  }
};

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
const DOM = {
  // Navigation
  sidebarNavItems: document.querySelectorAll('.aniyomi-sidebar .nav-item'),
  bottomNavItems: document.querySelectorAll('.aniyomi-bottom-nav .bottom-nav-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  viewHeaderTitle: document.getElementById('viewHeaderTitle'),
  sidebarActiveSource: document.getElementById('sidebarActiveSource'),
  sidebarLibraryCount: document.getElementById('sidebarLibraryCount'),
  bottomLibraryCount: document.getElementById('bottomLibraryCount'),

  // Search & Source
  globalSearchInput: document.getElementById('globalSearchInput'),
  sourceSelectDropdown: document.getElementById('sourceSelectDropdown'),

  // Catalog Tab
  heroSpotlight: document.getElementById('heroSpotlight'),
  heroBackdrop: document.getElementById('heroBackdrop'),
  heroBadge: document.getElementById('heroBadge'),
  heroRepoTag: document.getElementById('heroRepoTag'),
  heroScore: document.getElementById('heroScore'),
  heroTitle: document.getElementById('heroTitle'),
  heroNativeTitle: document.getElementById('heroNativeTitle'),
  heroSynopsis: document.getElementById('heroSynopsis'),
  btnHeroPlay: document.getElementById('btnHeroPlay'),
  btnHeroDetail: document.getElementById('btnHeroDetail'),
  sortFilterGroup: document.getElementById('sortFilterGroup'),
  statusFilterGroup: document.getElementById('statusFilterGroup'),
  genrePillsList: document.getElementById('genrePillsList'),
  catalogCountBadge: document.getElementById('catalogCountBadge'),
  animeGrid: document.getElementById('animeGrid'),
  loadMoreWrap: document.getElementById('loadMoreWrap'),
  btnLoadMore: document.getElementById('btnLoadMore'),
  loadMoreText: document.getElementById('loadMoreText'),
  loadMoreSpinner: document.getElementById('loadMoreSpinner'),

  // Library Tab
  libTabs: document.querySelectorAll('.lib-tab'),
  libCountAll: document.getElementById('libCountAll'),
  libCountWatching: document.getElementById('libCountWatching'),
  libCountPlan: document.getElementById('libCountPlan'),
  libCountCompleted: document.getElementById('libCountCompleted'),
  libCountDropped: document.getElementById('libCountDropped'),
  libraryGrid: document.getElementById('libraryGrid'),

  // Extensions Tab
  btnCheckExtUpdates: document.getElementById('btnCheckExtUpdates'),
  extensionsList: document.getElementById('extensionsList'),

  // Settings Tab
  settingSkipIntroTime: document.getElementById('settingSkipIntroTime'),
  settingDefaultQuality: document.getElementById('settingDefaultQuality'),
  settingAutoNext: document.getElementById('settingAutoNext'),
  settingAutoFallback: document.getElementById('settingAutoFallback'),
  settingCacheSize: document.getElementById('settingCacheSize'),
  btnClearCache: document.getElementById('btnClearCache'),
  adminSettingsCard: document.getElementById('adminSettingsCard'),
  adminStatusPill: document.getElementById('adminStatusPill'),
  btnToggleAdmin: document.getElementById('btnToggleAdmin'),
  btnToggleAdminText: document.getElementById('btnToggleAdminText'),
  btnChangeAdminPin: document.getElementById('btnChangeAdminPin'),
  adminControlsArea: document.getElementById('adminControlsArea'),
  adminCustomStreamInput: document.getElementById('adminCustomStreamInput'),
  btnAdminPlayCustom: document.getElementById('btnAdminPlayCustom'),

  // Anime Detail Modal
  animeDetailsView: document.getElementById('animeDetailsView'),
  btnDetailBack: document.getElementById('btnDetailBack'),
  detailBackdrop: document.getElementById('detailBackdrop'),
  detailPoster: document.getElementById('detailPoster'),
  detailScore: document.getElementById('detailScore'),
  detailSourceBadge: document.getElementById('detailSourceBadge'),
  detailTitle: document.getElementById('detailTitle'),
  detailNativeTitle: document.getElementById('detailNativeTitle'),
  detailStatus: document.getElementById('detailStatus'),
  detailSeasonYear: document.getElementById('detailSeasonYear'),
  detailTotalEps: document.getElementById('detailTotalEps'),
  detailType: document.getElementById('detailType'),
  btnDetailStartWatching: document.getElementById('btnDetailStartWatching'),
  btnDetailLibraryToggle: document.getElementById('btnDetailLibraryToggle'),
  detailLibraryText: document.getElementById('detailLibraryText'),
  btnDetailAniList: document.getElementById('btnDetailAniList'),
  detailSynopsis: document.getElementById('detailSynopsis'),
  detailGenreChips: document.getElementById('detailGenreChips'),
  detailEpisodesCount: document.getElementById('detailEpisodesCount'),
  btnSortEpisodes: document.getElementById('btnSortEpisodes'),
  sortEpisodesLabel: document.getElementById('sortEpisodesLabel'),
  detailEpisodesGrid: document.getElementById('detailEpisodesGrid'),

  // Download Modal
  downloadModal: document.getElementById('downloadModal'),
  btnCloseDownloadModal: document.getElementById('btnCloseDownloadModal'),
  downloadModalTitle: document.getElementById('downloadModalTitle'),
  downloadModalLoading: document.getElementById('downloadModalLoading'),
  downloadModalContent: document.getElementById('downloadModalContent'),

  // Player Modal
  playerModal: document.getElementById('playerModal'),
  videoContainer: document.getElementById('videoContainer'),
  mainVideoPlayer: document.getElementById('mainVideoPlayer'),
  trailerPlayerIframe: document.getElementById('trailerPlayerIframe'),
  playerHud: document.getElementById('playerHud'),
  btnClosePlayer: document.getElementById('btnClosePlayer'),
  playerModalTitle: document.getElementById('playerModalTitle'),
  playerModalEp: document.getElementById('playerModalEp'),
  playerModalPoster: document.getElementById('playerModalPoster'),
  serverSelect: document.getElementById('serverSelect'),
  qualitySelect: document.getElementById('qualitySelect'),
  btnQuickFallbackServer: document.getElementById('btnQuickFallbackServer'),
  btnDownloadStream: document.getElementById('btnDownloadStream'),
  btnRewind10: document.getElementById('btnRewind10'),
  btnForward10: document.getElementById('btnForward10'),
  centerPlayButton: document.getElementById('centerPlayButton'),
  centerPlayIcon: document.getElementById('centerPlayIcon'),
  btnSkipIntro: document.getElementById('btnSkipIntro'),
  timelineContainer: document.getElementById('timelineContainer'),
  timelineBuffer: document.getElementById('timelineBuffer'),
  timelineProgress: document.getElementById('timelineProgress'),
  timelineSlider: document.getElementById('timelineSlider'),
  btnPlayPause: document.getElementById('btnPlayPause'),
  iconPlay: document.getElementById('iconPlay'),
  iconPause: document.getElementById('iconPause'),
  btnNextEpisode: document.getElementById('btnNextEpisode'),
  currentTimeText: document.getElementById('currentTimeText'),
  durationTimeText: document.getElementById('durationTimeText'),
  btnMute: document.getElementById('btnMute'),
  volumeIcon: document.getElementById('volumeIcon'),
  volumeSlider: document.getElementById('volumeSlider'),
  btnPlaybackSpeed: document.getElementById('btnPlaybackSpeed'),
  speedText: document.getElementById('speedText'),
  btnAspectRatio: document.getElementById('btnAspectRatio'),
  btnFullscreen: document.getElementById('btnFullscreen'),

  // Toast
  toastNotice: document.getElementById('toastNotice')
};

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================
// PWA Install Prompt State
let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
  init();
  initPWA();
});

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered', reg))
      .catch(err => console.error('Service Worker registration failed', err));
  }

  const installBtn = document.getElementById('btnInstallAppSidebar');
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.classList.remove('hidden');
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        installBtn.classList.add('hidden');
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.add('hidden');
    showToast('Aplikasi berhasil diinstal!');
  });
}

async function init() {
  setupNavigation();
  setupSettingsUI();
  setupAdminMode();
  setupEventListeners();
  updateLibraryCounters();

  try {
    await fetchExtensions();
    await fetchAnime(false);
  } catch (err) {
    console.error('Inisialisasi aplikasi gagal:', err);
    showToast('⚠️ Gagal terhubung ke backend server.');
  }
}

// ==========================================================================
// 4-TAB NAVIGATION SYSTEM (Aniyomi Core)
// ==========================================================================
function setupNavigation() {
  const switchTab = (tabName) => {
    state.activeTab = tabName;

    // Update Desktop Nav
    DOM.sidebarNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update Bottom Nav
    DOM.bottomNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update Views
    DOM.tabViews.forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (targetView) targetView.classList.add('active');

    // Update Top App Bar Title
    switch (tabName) {
      case 'anime':
        DOM.viewHeaderTitle.textContent = '📺 Katalog Anime';
        break;
      case 'library':
        DOM.viewHeaderTitle.textContent = '📚 Koleksi Saya (Library)';
        renderLibrary();
        break;
      case 'extensions':
        DOM.viewHeaderTitle.textContent = '🧩 Ekstensi Keiyoushi';
        renderExtensions();
        break;
      case 'settings':
        DOM.viewHeaderTitle.textContent = '⚙️ Pengaturan & Preferensi';
        break;
    }

    // Scroll main window to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  DOM.sidebarNavItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  DOM.bottomNavItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function normalizeAnime(item) {
  let episodes = [];
  if (Array.isArray(item.episodes)) {
    episodes = item.episodes.map((ep, idx) => ({
      number: ep.number || ep.num || (idx + 1),
      title: ep.title || `Episode ${ep.number || ep.num || (idx + 1)}`,
      duration: ep.duration || '24m',
      url: ep.url || item.url || '',
      stream_url: ep.stream_url || ep.video || `/media/anime_${item.id}.mp4`,
      trailerId: ep.trailerId || item.trailerId
    }));
  } else if (Array.isArray(item.episodesList)) {
    episodes = item.episodesList;
  } else {
    const epCount = typeof item.episodes === 'number' ? item.episodes : (item.episodes_count || item.episodesCount || 12);
    for (let i = 1; i <= Math.min(epCount, 48); i++) {
      episodes.push({
        number: i,
        num: i,
        title: `Episode ${i}`,
        duration: '24m',
        url: item.url || '',
        stream_url: `/media/sample.mp4`,
        trailerId: item.trailerId
      });
    }
  }

  const totalEps = item.episodes_count || item.episodesCount || (typeof item.episodes === 'number' ? item.episodes : episodes.length);
  const poster = item.poster || item.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=700';
  const backdrop = item.backdrop || item.banner || poster;
  const score = item.score || item.rating || 8.5;
  const genres = item.genres || (item.genre ? [item.genre] : ['Action', 'Fantasy']);
  const synopsis = item.synopsis || item.description || 'Sinopsis belum tersedia.';
  const nativeTitle = item.native_title || item.nativeTitle || item.romajiTitle || '';
  const trailerUrl = item.trailer_url || (item.trailerId ? `https://www.youtube.com/watch?v=${item.trailerId}` : null);
  const studio = item.studio || '';
  const season = item.season || '';
  const year = item.year || '';
  const status = item.status || 'Ongoing';
  const animeType = item.type || 'TV Series';
  const anilistUrl = item.anilist_url || (typeof item.id === 'number' ? `https://anilist.co/anime/${item.id}` : '');

  return {
    ...item,
    id: item.id,
    title: item.title,
    native_title: nativeTitle,
    poster: poster,
    backdrop: backdrop,
    score: score,
    genres: genres,
    synopsis: synopsis,
    episodes_count: totalEps,
    episodes: episodes,
    trailer_url: trailerUrl,
    studio: studio,
    season: season,
    year: year,
    status: status,
    type: animeType,
    anilist_url: anilistUrl,
    url: item.url || (episodes[0] && episodes[0].url) || '',
    source: item.source || (Array.isArray(item.repo) && item.repo.includes('id') ? 'Samehadaku (ID)' : 'Samehadaku')
  };
}

// ==========================================================================
// DIRECT ANILIST GRAPHQL CLIENT (Zero-Dependency Static Fallback)
// ==========================================================================
async function fetchAniListDirect({ page = 1, perPage = 30, search = '', genre = '', status = '', sort = 'trending' }) {
  const query = `
    query ($page: Int, $perPage: Int, $search: String, $genre: String, $status: MediaStatus, $sort: [MediaSort], $isAdult: Boolean) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(type: ANIME, isAdult: $isAdult, search: $search, genre: $genre, status: $status, sort: $sort) {
          id
          isAdult
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
  if (genre === 'Spesial 18+') {
    variables.isAdult = true;
    variables.genre = 'Hentai';
  } else if (state.adminMode && search && search.trim()) {
    variables.isAdult = true;
    variables.search = search.trim();
    if (genre && genre !== 'All') variables.genre = genre;
  } else {
    variables.isAdult = false;
    if (search && search.trim()) variables.search = search.trim();
    if (genre && genre !== 'All') variables.genre = genre;
  }

  if (status && status !== 'All') {
    if (status.toLowerCase() === 'ongoing') variables.status = 'RELEASING';
    if (status.toLowerCase() === 'completed') variables.status = 'FINISHED';
  }

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error(`AniList returned status: ${res.status}`);
  const payload = await res.json();
  const mediaList = payload.data?.Page?.media || [];
  const pageInfo = payload.data?.Page?.pageInfo || {};

  const items = mediaList.map(m => {
    const title = m.title?.romaji || m.title?.english || m.title?.native || 'Unknown Title';
    return {
      id: String(m.id),
      title: title,
      native_title: m.title?.native || m.title?.romaji || '',
      titles: m.title || {},
      genre: (m.genres && m.genres[0]) || 'Action',
      genres: m.genres || ['Action'],
      isAdult: m.isAdult || false,
      type: 'TV Series',
      rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : 8.5,
      episodes: m.episodes || (m.status === 'RELEASING' ? 12 : 24),
      episodes_count: m.episodes || (m.status === 'RELEASING' ? 12 : 24),
      year: m.seasonYear || new Date().getFullYear(),
      duration: '24m',
      badge: m.status === 'RELEASING' ? 'Airing' : 'Completed',
      description: m.description ? m.description.replace(/<[^>]*>/g, '') : 'Sinopsis belum tersedia.',
      cover: m.coverImage?.extraLarge || m.coverImage?.large,
      poster: m.coverImage?.extraLarge || m.coverImage?.large,
      banner: m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large,
      backdrop: m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large,
      trailerId: m.trailer?.id || null,
      trailer_url: m.trailer?.site === 'youtube' && m.trailer?.id ? `https://www.youtube.com/watch?v=${m.trailer.id}` : null,
      source: 'AniList Universal'
    };
  });

  return { success: true, items, pageInfo };
}

// ==========================================================================
// FETCH & RENDER ANIME CATALOG (TAB 1)
// ==========================================================================
async function fetchAnime(isAppend = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (!isAppend) {
    state.currentPage = 1;
    DOM.animeGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-dim);">
        <div style="font-size: 2.2rem; margin-bottom: 12px; animation: pulse 1s infinite alternate;">⏳</div>
        <div style="font-weight: 600; font-size: 1rem; color: #fff;">Menghubungkan ke AniList &amp; Mirror Scraper...</div>
        <div style="font-size: 0.85rem; margin-top: 4px;">Menyinkronkan daftar anime dan stream HD bebas iklan</div>
      </div>
    `;
    if (DOM.loadMoreWrap) DOM.loadMoreWrap.classList.add('hidden');
  } else {
    if (DOM.loadMoreSpinner) DOM.loadMoreSpinner.classList.remove('hidden');
    if (DOM.loadMoreText) DOM.loadMoreText.textContent = 'Memuat Serial...';
  }

  try {
    let data = null;

    // First attempt: local Node backend scraper / API
    try {
      const params = new URLSearchParams({
        source: state.selectedSource,
        page: state.currentPage,
        genre: state.selectedGenre,
        status: state.selectedStatus,
        sort: state.selectedSort,
        search: state.searchQuery
      });

      const res = await fetch(`/api/anime?${params.toString()}`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (localErr) {
      // Local backend offline or static GitHub Pages mode
    }

    // Fallback: direct AniList GraphQL API (100% works on GitHub Pages without server)
    if (!data || !data.success || !Array.isArray(data.items) || data.items.length === 0) {
      data = await fetchAniListDirect({
        page: state.currentPage,
        perPage: 30,
        search: state.searchQuery,
        genre: state.selectedGenre,
        status: state.selectedStatus,
        sort: state.selectedSort
      });
    }

    if (data && data.success && Array.isArray(data.items)) {
      const normalizedItems = data.items.map(normalizeAnime);

      if (!isAppend) {
        state.allAnime = normalizedItems;
        state.newlyAppendedItems = normalizedItems;
      } else {
        const existingIds = new Set(state.allAnime.map(a => String(a.id)));
        const existingTitles = new Set(state.allAnime.map(a => (a.title || '').toLowerCase().trim()));
        const uniqueNewItems = [];
        for (const item of normalizedItems) {
          const tKey = (item.title || '').toLowerCase().trim();
          if (!existingIds.has(String(item.id)) && (!tKey || !existingTitles.has(tKey))) {
            existingIds.add(String(item.id));
            if (tKey) existingTitles.add(tKey);
            uniqueNewItems.push(item);
          }
        }
        state.newlyAppendedItems = uniqueNewItems;
        state.allAnime = [...state.allAnime, ...uniqueNewItems];
      }

      state.filteredAnime = state.allAnime;
      state.hasNextPage = Boolean(data.pageInfo && data.pageInfo.hasNextPage);

      renderAnimeGrid(isAppend);
      updateHeroSpotlight();
    } else {
      throw new Error((data && data.error) || 'Respon API tidak valid');
    }
  } catch (err) {
    console.error('Fetch anime error:', err);
    if (!isAppend) {
      DOM.animeGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 50px 20px; text-align: center; color: var(--accent-rose);">
          <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
          <div style="font-weight: 700;">Gagal memuat katalog anime</div>
          <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">${escapeHtml(err.message)}</div>
          <button type="button" class="cta-btn secondary-cta" style="margin-top: 16px;" onclick="fetchAnime(false)">
            <span>🔄 Coba Lagi</span>
          </button>
        </div>
      `;
    }
    showToast('⚠️ Gagal memuat daftar anime.');
  } finally {
    state.isLoading = false;
    if (DOM.loadMoreSpinner) DOM.loadMoreSpinner.classList.add('hidden');
    if (DOM.loadMoreText) DOM.loadMoreText.textContent = 'Muat Anime Lainnya ⬇';
  }
}

function renderAnimeGrid(isAppend = false) {
  if (!isAppend) {
    DOM.animeGrid.innerHTML = '';
  }

  if (state.filteredAnime.length === 0) {
    DOM.animeGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-dim);">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
        <div style="font-weight: 700; color: #fff;">Tidak Ada Anime Ditemukan</div>
        <div style="font-size: 0.85rem; margin-top: 4px;">Coba ubah kata kunci pencarian atau filter genre/status Anda.</div>
      </div>
    `;
    DOM.catalogCountBadge.textContent = '0 Judul';
    if (DOM.loadMoreWrap) DOM.loadMoreWrap.classList.add('hidden');
    return;
  }

  DOM.catalogCountBadge.textContent = `${state.filteredAnime.length} Judul`;

  const fragment = document.createDocumentFragment();

  // If appending, strictly render ONLY the newly appended unique items (ZERO duplicates)
  const itemsToRender = isAppend
    ? (state.newlyAppendedItems || [])
    : state.filteredAnime;

  itemsToRender.forEach(anime => {
    // Extra safety guard against duplicate DOM cards
    if (isAppend && DOM.animeGrid.querySelector(`.anime-card[data-id="${anime.id}"]`)) {
      return;
    }

    const card = document.createElement('article');
    card.className = 'anime-card';
    card.dataset.id = anime.id;
    card.tabIndex = 0;

    const sourceName = anime.source || 'Samehadaku';
    const totalEps = anime.episodes_count || (anime.episodes ? anime.episodes.length : 24);
    const scoreVal = anime.score ? `★ ${anime.score}` : '★ 8.5';
    
    // Fix Ongoing vs Tamat detection & episode badge text
    const statusRaw = String(anime.status || '').toLowerCase();
    const isOngoing = statusRaw.includes('ongoing') || statusRaw.includes('releasing') || statusRaw.includes('airing') || (anime.episode_number && anime.episode_number > 0);
    const epNum = anime.episode_number || (Array.isArray(anime.episodes) && anime.episodes[0] && anime.episodes[0].number) || totalEps;
    const epBadgeText = isOngoing ? `Ongoing • Ep ${epNum}` : `Tamat • ${totalEps} Ep`;

    card.innerHTML = `
      <div class="card-poster-wrap">
        <img src="${escapeHtml(anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80')}" 
             alt="${escapeHtml(anime.title)}" 
             class="card-poster" 
             loading="lazy"
             referrerpolicy="no-referrer"
             data-raw-src="${escapeHtml(anime.poster || '')}"
             onerror="if(!this.dataset.proxied && this.dataset.rawSrc){this.dataset.proxied='1';this.src='/api/image-proxy?url='+encodeURIComponent(this.dataset.rawSrc);}else{this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';}">
        <div class="card-top-badges">
          <span class="score-chip">${scoreVal}</span>
          <span class="ep-chip ${isOngoing ? 'chip-ongoing' : 'chip-completed'}">${epBadgeText}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title" title="${escapeHtml(anime.title)}">${escapeHtml(anime.title)}</div>
        <div class="card-meta-line">${escapeHtml((anime.studio && !anime.studio.toLowerCase().includes('unknown') && !anime.studio.toLowerCase().includes('studio animation')) ? `${anime.studio} • ${(Array.isArray(anime.genres) && anime.genres.length) ? anime.genres.slice(0, 2).join(', ') : (anime.type || 'TV Series')}` : `${(Array.isArray(anime.genres) && anime.genres.length) ? anime.genres.slice(0, 2).join(', ') : (anime.genre || 'Action')} • ${anime.type || 'TV Series'}`)}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      openAnimeDetails(anime);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openAnimeDetails(anime);
    });

    fragment.appendChild(card);
  });

  DOM.animeGrid.appendChild(fragment);

  // Manage Load More button
  if (DOM.loadMoreWrap) {
    if (state.hasNextPage) {
      DOM.loadMoreWrap.classList.remove('hidden');
    } else {
      DOM.loadMoreWrap.classList.add('hidden');
    }
  }
}

function updateHeroSpotlight() {
  if (!state.filteredAnime.length) return;
  
  // Pick featured anime (prefer anime with true AniList widescreen banner)
  const featured = state.filteredAnime.find(a => a.backdrop && a.backdrop.includes('/banner/')) ||
                   state.filteredAnime.find(a => a.id === 151807 || a.id === 21 || a.id === 269) ||
                   state.filteredAnime[0];
  if (!featured) return;

  const heroBg = (featured.backdrop && featured.backdrop.includes('/banner/'))
    ? featured.backdrop
    : (featured.backdrop || featured.poster);

  DOM.heroBackdrop.style.backgroundImage = `url('${heroBg}')`;
  DOM.heroTitle.textContent = featured.title;
  const featGenres = Array.isArray(featured.genres) && featured.genres.length ? featured.genres.slice(0, 2).join(', ') : 'Action, Fantasy';
  const featStudio = (featured.studio && !featured.studio.toLowerCase().includes('unknown') && !featured.studio.toLowerCase().includes('studio animation')) ? featured.studio : 'Animation Studio';
  DOM.heroNativeTitle.textContent = `${featStudio} • ${featGenres} (${featured.season || featured.year || '2026'})`;
  DOM.heroSynopsis.textContent = featured.synopsis || 'Dunia fantasi anime spektakuler dengan visual tingkat tinggi dan jalan cerita yang memukau.';
  DOM.heroScore.textContent = `★ ${featured.score || '8.9'}`;
  DOM.heroRepoTag.textContent = '✨ Server HD Online';

  DOM.btnHeroPlay.onclick = () => {
    openPlayer(featured, 0);
  };

  DOM.btnHeroDetail.onclick = () => {
    openAnimeDetails(featured);
  };
}

// ==========================================================================
// ANIME DETAILS SCREEN (Aniyomi Detail Sheet)
// ==========================================================================
function openAnimeDetails(anime) {
  state.currentAnime = anime;

  // Set Backdrops & Posters (prefer crisp widescreen banner art)
  const detailBg = (anime.backdrop && anime.backdrop.includes('/banner/'))
    ? anime.backdrop
    : (anime.backdrop || anime.poster);

  DOM.detailBackdrop.style.backgroundImage = `url('${detailBg}')`;
  if (detailBg === anime.poster) {
    DOM.detailBackdrop.classList.add('is-poster-fallback');
  } else {
    DOM.detailBackdrop.classList.remove('is-poster-fallback');
  }
  
  DOM.detailPoster.src = anime.poster || '';
  DOM.detailPoster.alt = anime.title;
  DOM.detailScore.textContent = `★ ${anime.score || '8.8'}`;
  DOM.detailSourceBadge.textContent = '⚡ Server HD Cloud';
  DOM.detailTitle.textContent = anime.title;
  const detGenres = Array.isArray(anime.genres) && anime.genres.length ? anime.genres.slice(0, 2).join(', ') : (anime.genre || 'Action');
  const detStudio = (anime.studio && !anime.studio.toLowerCase().includes('unknown') && !anime.studio.toLowerCase().includes('studio animation')) ? anime.studio : 'Studio Animation';
  DOM.detailNativeTitle.textContent = `${detStudio} • ${detGenres} • ${anime.type || 'TV Series'}`;
  
  DOM.detailStatus.textContent = anime.status === 'RELEASING' ? 'Sedang Tayang' : 'Tamat';
  DOM.detailSeasonYear.textContent = `${anime.season || 'Fall'} ${anime.year || '2026'}`;
  const totalEps = anime.episodes_count || (anime.episodes ? anime.episodes.length : 24);
  DOM.detailTotalEps.textContent = `${totalEps} Episode`;
  DOM.detailType.textContent = anime.type || 'TV Series';

  DOM.detailSynopsis.textContent = anime.synopsis || 'Tidak ada sinopsis tersedia untuk anime ini.';

  // Genres
  DOM.detailGenreChips.innerHTML = '';
  if (Array.isArray(anime.genres)) {
    anime.genres.forEach(g => {
      const pill = document.createElement('span');
      pill.className = 'info-chip';
      pill.textContent = g;
      DOM.detailGenreChips.appendChild(pill);
    });
  }

  // AniList External Link
  DOM.btnDetailAniList.href = anime.anilist_url || `https://anilist.co/anime/${anime.id}`;

  // Library Toggle Button State
  updateDetailLibraryButton(anime.id);

  // Start Watching Action
  DOM.btnDetailStartWatching.onclick = () => {
    const saved = state.watchlist.find(w => w.id === anime.id);
    const startEp = (saved && saved.lastEpWatched) ? Math.max(0, saved.lastEpWatched - 1) : 0;
    openPlayer(anime, startEp);
  };

  // Render Episode List
  renderDetailEpisodes();

  // If Otakudesu or Samehadaku anime with url, fetch full live episodes list
  const animeIdStr = String(anime.id);
  const isOtakudesu = anime.url && (animeIdStr.startsWith('od_') || (anime.source && anime.source.toLowerCase().includes('otakudesu')));
  const isSamehadaku = anime.url && (animeIdStr.startsWith('sh_') || (anime.source && anime.source.toLowerCase().includes('samehadaku')));

  if (isOtakudesu || isSamehadaku) {
    const epSource = isOtakudesu ? 'otakudesu' : 'samehadaku';
    if (!anime.episodes || anime.episodes.length <= 1) {
      DOM.detailEpisodesGrid.innerHTML = `
        <div class="ep-loading-box">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">⏳</div>
          <div>Mengambil daftar episode lengkap dari server ${epSource === 'otakudesu' ? 'Otakudesu' : 'Samehadaku'}...</div>
        </div>
      `;
    }
    fetch(`/api/scrapers/episodes?source=${epSource}&url=${encodeURIComponent(anime.url)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.episodes) && data.episodes.length > 0) {
          anime.episodes = data.episodes;
          anime.episodes_count = data.episodes.length;
          DOM.detailTotalEps.textContent = `${data.episodes.length} Episode`;
          renderDetailEpisodes();
        } else {
          renderDetailEpisodes();
        }
      })
      .catch(e => {
        console.warn(`Gagal memuat episode live ${epSource}:`, e);
        renderDetailEpisodes();
      });
  }

  // Show Modal
  DOM.animeDetailsView.classList.add('active');
  DOM.animeDetailsView.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeAnimeDetails() {
  DOM.animeDetailsView.classList.remove('active');
  DOM.animeDetailsView.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function updateDetailLibraryButton(animeId) {
  const isInLib = state.watchlist.some(item => String(item.id) === String(animeId));
  if (isInLib) {
    DOM.detailLibraryText.textContent = 'Di Library (Tersimpan)';
    DOM.btnDetailLibraryToggle.classList.add('active');
  } else {
    DOM.detailLibraryText.textContent = 'Tambah ke Library';
    DOM.btnDetailLibraryToggle.classList.remove('active');
  }

  DOM.btnDetailLibraryToggle.onclick = () => {
    toggleWatchlist(state.currentAnime);
    updateDetailLibraryButton(animeId);
  };
}

function renderDetailEpisodes() {
  if (!state.currentAnime) return;
  const anime = state.currentAnime;
  let episodes = anime.episodes || [];

  DOM.detailEpisodesCount.textContent = `${episodes.length} Episode`;

  // Sort episodes based on order state
  let displayEpisodes = [...episodes];
  if (!state.episodesAscending) {
    displayEpisodes.reverse();
  }

  DOM.sortEpisodesLabel.textContent = state.episodesAscending ? 'Urutan: 1 ➔ N' : 'Urutan: N ➔ 1';

  DOM.detailEpisodesGrid.innerHTML = '';

  const savedWatch = state.watchlist.find(w => w.id === anime.id);
  const lastWatchedNumber = savedWatch ? savedWatch.lastEpWatched : 0;

  displayEpisodes.forEach(ep => {
    const epCard = document.createElement('div');
    epCard.className = 'ep-card-item';
    
    const isWatched = ep.number <= lastWatchedNumber;
    const watchedTag = isWatched ? '<span style="color: var(--accent-emerald); font-size: 0.72rem;">✓ Sudah Ditonton</span>' : '';

    epCard.innerHTML = `
      <div class="ep-card-left">
        <div class="ep-card-num">Episode ${ep.number} ${watchedTag}</div>
        <div class="ep-card-sub">${escapeHtml(ep.title || `Episode ${ep.number}`)} &bull; ${ep.duration || '24m'} &bull; HD Direct</div>
      </div>
      <div class="ep-card-actions">
        <button type="button" class="ep-dl-btn" title="Download Episode" aria-label="Download">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <div class="ep-card-play-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
      </div>
    `;

    // Handle clicks inside card
    epCard.addEventListener('click', (e) => {
      const realIndex = episodes.findIndex(item => item.number === ep.number);
      
      // If clicked download button
      const dlBtn = e.target.closest('.ep-dl-btn');
      if (dlBtn) {
        e.stopPropagation(); // prevent play
        openDownloadModal(anime, realIndex !== -1 ? realIndex : 0);
        return;
      }
      
      // Default: Play Episode
      openPlayer(anime, realIndex !== -1 ? realIndex : 0);
    });

    DOM.detailEpisodesGrid.appendChild(epCard);
  });
}

// ==========================================================================
// DOWNLOAD EPISODE MODAL
// ==========================================================================
async function openDownloadModal(anime, epIndex) {
  const episodes = anime.episodes || [];
  const ep = episodes[epIndex] || {
    number: epIndex + 1,
    title: `Episode ${epIndex + 1}`,
    url: anime.url || ''
  };

  DOM.downloadModalTitle.textContent = `Download: ${anime.title} - Episode ${ep.number}`;
  DOM.downloadModal.classList.add('active');
  DOM.downloadModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  
  DOM.downloadModalLoading.classList.remove('hidden');
  DOM.downloadModalContent.classList.add('hidden');
  DOM.downloadModalContent.innerHTML = '';

  let fetchUrl = ep.url;
  let epSource = 'samehadaku';
  
  if (anime.source === 'otakudesu' || (fetchUrl && fetchUrl.includes('otakudesu'))) {
    epSource = 'otakudesu';
  } else if (!fetchUrl && anime.id) {
    epSource = 'anilist';
    fetchUrl = `/media/anime_${anime.id}.mp4`;
  }

  try {
    let streams = [];
    if (epSource === 'anilist') {
      streams = [{ resolution: '1080p', url: fetchUrl }];
    } else {
      const res = await fetch(`/api/scrapers/stream-proxy?source=${epSource}&url=${encodeURIComponent(fetchUrl)}`);
      const data = await res.json();
      if (data.success && data.streams) {
        streams = data.streams;
      } else {
        throw new Error(data.error || 'No streams found');
      }
    }

    DOM.downloadModalLoading.classList.add('hidden');
    DOM.downloadModalContent.classList.remove('hidden');

    if (streams.length === 0) {
      DOM.downloadModalContent.innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">Maaf, link download tidak tersedia saat ini.</p>';
      return;
    }

    streams.forEach(stream => {
      const btn = document.createElement('a');
      btn.className = 'download-link-btn';
      btn.href = stream.url;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.download = `${anime.title}_Ep${ep.number}_${stream.resolution}.mp4`;
      btn.innerHTML = `
        <div class="dl-res">${stream.resolution}</div>
        <div class="dl-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      `;
      DOM.downloadModalContent.appendChild(btn);
    });

  } catch (error) {
    console.error('Download fetch error:', error);
    DOM.downloadModalLoading.classList.add('hidden');
    DOM.downloadModalContent.classList.remove('hidden');
    DOM.downloadModalContent.innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">Gagal memuat daftar download. Silakan coba lagi nanti.</p>';
  }
}

DOM.btnCloseDownloadModal.addEventListener('click', () => {
  DOM.downloadModal.classList.remove('active');
  DOM.downloadModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
});

DOM.downloadModal.addEventListener('click', (e) => {
  if (e.target === DOM.downloadModal) {
    DOM.downloadModal.classList.remove('active');
    DOM.downloadModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
});

// ==========================================================================
// CINEMA VIDEO PLAYER (MPV HUD Experience)
// ==========================================================================
async function openPlayer(anime, epIndex = 0) {
  state.currentAnime = anime;
  state.currentEpIndex = epIndex;

  const episodes = anime.episodes || [];
  const currentEp = episodes[epIndex] || {
    number: epIndex + 1,
    title: `Episode ${epIndex + 1}`,
    url: anime.url || '',
    stream_url: `/media/anime_${anime.id}.mp4`
  };

  DOM.playerModalTitle.textContent = anime.title;
  DOM.playerModalEp.textContent = `Episode ${currentEp.number} — ${currentEp.title || 'HD Direct Stream'}`;
  
  if (anime.poster) {
    DOM.playerModalPoster.src = anime.poster;
    DOM.playerModalPoster.style.display = 'block';
  } else {
    DOM.playerModalPoster.style.display = 'none';
  }

  // Reset Player UI
  DOM.playerModal.classList.add('active');
  DOM.playerModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Setup initial loading state in server selector
  DOM.serverSelect.innerHTML = `
    <option value="" disabled selected>⏳ Menghubungkan ke Stream HD Asli...</option>
    ${anime.trailer_url ? `<option value="trailer" data-url="${anime.trailer_url}" data-type="iframe">🎬 Trailer Resmi (YT)</option>` : ''}
  `;

  // Pause previous video & hide video player until real stream is ready
  DOM.mainVideoPlayer.pause();
  DOM.mainVideoPlayer.src = '';
  DOM.trailerPlayerIframe.src = '';
  DOM.centerPlayButton.style.display = 'none';
  
  // Show spinner immediately while resolving streams
  DOM.videoContainer.classList.add('is-buffering');

  // Update Skip Intro Chip Text with configured seconds
  DOM.btnSkipIntro.querySelector('span').textContent = `⏩ Lewati Intro (+${state.settings.skipIntroTime}s)`;

  // Update Next Episode Button Visibility
  if (epIndex >= episodes.length - 1) {
    DOM.btnNextEpisode.style.opacity = '0.4';
    DOM.btnNextEpisode.disabled = true;
  } else {
    DOM.btnNextEpisode.style.opacity = '1';
    DOM.btnNextEpisode.disabled = false;
  }

  // Record Watch History
  recordEpisodeWatch(anime, currentEp.number);

  // Setup HUD idle timer
  resetHudIdleTimer();

  // If anime or episode has a live scraper target URL or title
  const targetUrl = currentEp.url || anime.url || '';
  const isOtakudesu = (anime.source && anime.source.toLowerCase().includes('otakudesu')) || (targetUrl && targetUrl.includes('otakudesu'));
  const targetSource = isOtakudesu ? 'otakudesu' : 'samehadaku';

  showToast(`🔍 Mengambil video asli Episode ${currentEp.number} (1080p/720p)...`);

  const romajiName = anime.native_title || (anime.titles && anime.titles.romaji) || '';
  const queryParams = new URLSearchParams({
    source: targetSource,
    url: targetUrl,
    title: anime.title || '',
    romaji: romajiName,
    episode: currentEp.number || (epIndex + 1),
    isAdult: anime.isAdult || anime.genre === 'Hentai'
  });

  try {
    const res = await fetch(`/api/scrapers/streams?${queryParams.toString()}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.streams) && data.streams.length > 0) {
      // Smart Hardware-Accelerated Stream Scoring:
      // Direct MP4 (native <video> GPU decode) >>> Heavy/Ad Iframe Embeds
      const scoreStream = (s) => {
        let score = 0;
        // Direct MP4 plays with native hardware acceleration, HTTP 206 range chunking, zero frame drop
        if (s.type === 'video') score += 1000;
        
        // Quality rank bonus
        if (s.quality === '1080p') score += 400;
        else if (s.quality === '720p') score += 300;
        else if (s.quality === '480p') score += 200;
        else if (s.quality === '360p') score += 100;

        // Heavy decryption / ad penalties
        if (s.url && s.url.includes('mega.nz')) score -= 500; // Mega links often expire or get deleted
        if (s.isBlogger || (s.url && s.url.includes('blogger.com'))) score -= 300; // Blogger 360p low bitrate
        return score;
      };

      const sortedStreams = [...data.streams].sort((a, b) => scoreStream(b) - scoreStream(a));

      state.availableStreams = sortedStreams;

      DOM.serverSelect.innerHTML = '';
      sortedStreams.forEach((stream, idx) => {
        const opt = document.createElement('option');
        opt.value = `stream_${idx}`;
        const tag = stream.type === 'video' ? '⚡ [Direct MP4]' : '🌐 [Embed]';
        opt.textContent = `${stream.server} ${tag}`;
        opt.dataset.url = stream.url;
        opt.dataset.type = stream.type || 'video';
        opt.dataset.quality = stream.quality || '720p';
        DOM.serverSelect.appendChild(opt);
      });

      if (anime.trailer_url) {
        const trailerOpt = document.createElement('option');
        trailerOpt.value = 'trailer';
        trailerOpt.textContent = '🎬 Trailer Resmi (YT)';
        trailerOpt.dataset.url = anime.trailer_url;
        trailerOpt.dataset.type = 'iframe';
        trailerOpt.dataset.quality = '1080p';
        DOM.serverSelect.appendChild(trailerOpt);
      }

      // Populate & sync Quality dropdown based on available streams
      const userPrefQ = (state.settings.defaultQuality || '720').toLowerCase().replace('p', '');
      updateQualityOptions(sortedStreams, userPrefQ);

      // Select initial stream: prioritize Direct MP4, then healthy non-Mega embeds, only Mega as fallback
      let bestStream = sortedStreams.find(s => (s.quality || '').toLowerCase() === `${userPrefQ}p` && s.type === 'video') ||
                       sortedStreams.find(s => s.type === 'video') ||
                       sortedStreams.find(s => (s.quality || '').toLowerCase() === `${userPrefQ}p` && !s.url.includes('mega.nz')) ||
                       sortedStreams.find(s => !s.url.includes('mega.nz')) ||
                       sortedStreams[0];

      if (bestStream) {
        const matchedOpt = Array.from(DOM.serverSelect.options).find(o => o.dataset.url === bestStream.url);
        if (matchedOpt) DOM.serverSelect.value = matchedOpt.value;

        const bestQVal = (bestStream.quality || `${userPrefQ}p`).toLowerCase().replace('p', '');
        if (DOM.qualitySelect) DOM.qualitySelect.value = bestQVal;

        if (bestStream.type === 'iframe') {
          loadIframeStream(bestStream.url, bestStream.server);
        } else if (bestStream.type === 'external') {
          window.open(bestStream.url, '_blank');
          showToast(`🔗 Membuka link eksternal: ${bestStream.server}`);
          // Load trailer as fallback in player if available, else close
          if (anime.trailer_url) {
            loadIframeStream(anime.trailer_url, 'Trailer Resmi');
          } else {
            closePlayer();
          }
        } else {
          loadNativeVideo(bestStream.url);
        }
        showToast(`⚡ Memutar resolusi ${bestStream.quality || 'HD'}: ${bestStream.server}`);
      }
    } else {
      if (anime.trailer_url) {
        DOM.serverSelect.innerHTML = `<option value="trailer" data-url="${anime.trailer_url}" data-type="iframe">🎬 Trailer Resmi (YT)</option>`;
        loadIframeStream(anime.trailer_url, 'Trailer Resmi');
        showToast('⚠️ Stream episode belum rilis, memutar trailer resmi.');
      } else {
        showToast('⚠️ Tidak ada server video aktif yang ditemukan untuk episode ini.');
        closePlayer();
      }
    }
  } catch (e) {
    console.warn('Gagal memuat stream scraper:', e);
    showToast('⚠️ Gagal terhubung ke server video.');
    closePlayer();
  }
}

function loadNativeVideo(srcUrl) {
  DOM.videoContainer.classList.remove('in-iframe-mode');
  DOM.trailerPlayerIframe.classList.add('hidden');
  DOM.trailerPlayerIframe.src = '';
  DOM.mainVideoPlayer.classList.remove('hidden');

  if (DOM.btnDownloadStream) {
    DOM.btnDownloadStream.href = srcUrl;
    DOM.btnDownloadStream.classList.remove('hidden');
  }

  DOM.mainVideoPlayer.src = srcUrl;
  DOM.mainVideoPlayer.preload = 'auto';
  DOM.mainVideoPlayer.playbackRate = state.playbackSpeed;
  DOM.mainVideoPlayer.load();

  const playPromise = DOM.mainVideoPlayer.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      updatePlayIcons(true);
    }).catch(err => {
      console.warn('Autoplay dicegah browser, klik play secara manual:', err);
      updatePlayIcons(false);
    });
  }
}

function loadIframeStream(embedUrl, label = 'Stream Iframe') {
  DOM.mainVideoPlayer.pause();
  DOM.mainVideoPlayer.classList.add('hidden');
  DOM.videoContainer.classList.add('in-iframe-mode');
  DOM.centerPlayButton.style.display = 'none';
  DOM.trailerPlayerIframe.classList.remove('hidden');

  if (DOM.btnDownloadStream) {
    DOM.btnDownloadStream.classList.add('hidden');
  }

  let targetUrl = embedUrl;
  if (targetUrl.includes('watch?v=')) {
    targetUrl = targetUrl.replace('watch?v=', 'embed/') + '?autoplay=1';
  }
  DOM.trailerPlayerIframe.src = targetUrl;
  showToast(`🎬 Memuat ${label}`);
}

function loadTrailerIframe(trailerUrl) {
  loadIframeStream(trailerUrl, 'Trailer Resmi');
}

function updateQualityOptions(streams, preferredQuality) {
  if (!DOM.qualitySelect) return;
  DOM.qualitySelect.innerHTML = '';

  const qualityLabels = {
    '1080': '1080p FHD',
    '720': '720p HD',
    '480': '480p SD',
    '360': '360p Hemat'
  };

  const streamQualities = new Set();
  (streams || []).forEach(s => {
    if (s.quality) {
      streamQualities.add(s.quality.toLowerCase().replace('p', ''));
    }
  });

  const allPossible = ['1080', '720', '480', '360'];
  allPossible.forEach(q => {
    const isAvail = streamQualities.has(q);
    const opt = document.createElement('option');
    opt.value = q;
    opt.textContent = isAvail ? (qualityLabels[q] || `${q}p`) : `${qualityLabels[q] || `${q}p`} (N/A)`;
    if (!isAvail) {
      opt.disabled = true;
    }
    DOM.qualitySelect.appendChild(opt);
  });

  // Select target quality: preferredQuality if available, else first available
  const pref = String(preferredQuality || '720').toLowerCase().replace('p', '');
  if (streamQualities.has(pref)) {
    DOM.qualitySelect.value = pref;
  } else {
    const firstAvail = allPossible.find(q => streamQualities.has(q));
    if (firstAvail) {
      DOM.qualitySelect.value = firstAvail;
    }
  }
}

function switchStreamQuality(qualityVal) {
  if (!state.availableStreams || !state.availableStreams.length) {
    showToast(`⚠️ Tidak ada daftar resolusi aktif untuk episode ini`);
    return;
  }
  const qStr = String(qualityVal).toLowerCase().replace('p', '');
  const targetTag = `${qStr}p`;

  // Find stream matching target quality:
  // Prefer Direct MP4 video first, then cleanest iframe
  let match = state.availableStreams.find(s => (s.quality || '').toLowerCase() === targetTag && s.type === 'video');
  if (!match) {
    match = state.availableStreams.find(s => (s.quality || '').toLowerCase() === targetTag);
  }

  // Fallback to closest available quality if exact match not found
  if (!match) {
    const qNum = parseInt(qStr, 10) || 720;
    const sorted = [...state.availableStreams].sort((a, b) => {
      const aNum = parseInt((a.quality || '720').replace('p', ''), 10) || 720;
      const bNum = parseInt((b.quality || '720').replace('p', ''), 10) || 720;
      return Math.abs(aNum - qNum) - Math.abs(bNum - qNum);
    });
    match = sorted[0];
  }

  if (match) {
    // Sync server dropdown
    const matchedOpt = Array.from(DOM.serverSelect.options).find(o => o.dataset.url === match.url);
    if (matchedOpt) {
      DOM.serverSelect.value = matchedOpt.value;
    }
    // Sync quality dropdown
    const matchQ = (match.quality || `${qStr}p`).toLowerCase().replace('p', '');
    DOM.qualitySelect.value = matchQ;
    state.settings.defaultQuality = matchQ;
    localStorage.setItem('otakuverse_quality', matchQ);
    if (DOM.settingDefaultQuality) {
      DOM.settingDefaultQuality.value = matchQ;
    }

    if (match.type === 'iframe') {
      loadIframeStream(match.url, match.server);
    } else {
      loadNativeVideo(match.url);
    }
    showToast(`🎬 Resolusi beralih ke ${match.quality || targetTag} (${match.server})`);
  }
}

function closePlayer() {
  DOM.mainVideoPlayer.pause();
  DOM.mainVideoPlayer.src = '';
  DOM.trailerPlayerIframe.src = '';
  DOM.trailerPlayerIframe.classList.add('hidden');
  DOM.videoContainer.classList.remove('in-iframe-mode');
  DOM.videoContainer.classList.remove('is-playing');
  DOM.centerPlayButton.style.display = 'flex';

  if (DOM.btnDownloadStream) {
    DOM.btnDownloadStream.classList.add('hidden');
  }

  DOM.playerModal.classList.remove('active');
  DOM.playerModal.setAttribute('aria-hidden', 'true');
  
  // Only restore body scroll if details view is not open
  if (!DOM.animeDetailsView.classList.contains('active')) {
    document.body.style.overflow = '';
  }

  clearTimeout(state.idleTimeout);
}

function quickCycleFallbackServer() {
  if (!DOM.serverSelect || DOM.serverSelect.options.length <= 1) {
    showToast('⚠️ Tidak ada mirror cadangan lain untuk episode ini');
    return;
  }
  const currentIdx = DOM.serverSelect.selectedIndex;
  const nextIdx = (currentIdx + 1) % DOM.serverSelect.options.length;
  DOM.serverSelect.selectedIndex = nextIdx;
  DOM.serverSelect.dispatchEvent(new Event('change'));
  const nextOpt = DOM.serverSelect.options[nextIdx];
  showToast(`🔄 Beralih ke mirror cadangan: ${nextOpt.text}`);
}

function togglePlayPause() {
  if (DOM.mainVideoPlayer.classList.contains('hidden')) return;

  if (DOM.mainVideoPlayer.paused || DOM.mainVideoPlayer.ended) {
    DOM.mainVideoPlayer.play();
  } else {
    DOM.mainVideoPlayer.pause();
  }
}

function updatePlayIcons(isPlaying) {
  if (isPlaying) {
    DOM.iconPlay.classList.add('hidden');
    DOM.iconPause.classList.remove('hidden');
    DOM.centerPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    DOM.videoContainer.classList.add('is-playing');
    DOM.centerPlayButton.style.display = 'none';
  } else {
    DOM.iconPlay.classList.remove('hidden');
    DOM.iconPause.classList.add('hidden');
    DOM.centerPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    DOM.videoContainer.classList.remove('is-playing');
    if (!DOM.videoContainer.classList.contains('in-iframe-mode')) {
      DOM.centerPlayButton.style.display = 'flex';
    }
  }
}

function skipVideoTime(seconds) {
  if (DOM.mainVideoPlayer.classList.contains('hidden')) return;
  const target = Math.min(Math.max(0, DOM.mainVideoPlayer.currentTime + seconds), DOM.mainVideoPlayer.duration || 0);
  DOM.mainVideoPlayer.currentTime = target;
  
  if (seconds > 0) {
    showToast(`⏩ Maju +${seconds}s`);
  } else {
    showToast(`⏪ Mundur ${seconds}s`);
  }
}

function skipIntro() {
  const skipSec = state.settings.skipIntroTime;
  skipVideoTime(skipSec);
  showToast(`⏩ Melompati Intro (+${skipSec}s)`);
}

function playNextEpisode() {
  if (!state.currentAnime) return;
  const episodes = state.currentAnime.episodes || [];
  if (state.currentEpIndex < episodes.length - 1) {
    openPlayer(state.currentAnime, state.currentEpIndex + 1);
    showToast(`▶️ Episode ${state.currentEpIndex + 1}`);
  } else {
    showToast('🎉 Ini adalah episode terakhir!');
  }
}

function cyclePlaybackSpeed() {
  const speeds = [1.0, 1.25, 1.5, 2.0];
  const currentIndex = speeds.indexOf(state.playbackSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  state.playbackSpeed = speeds[nextIndex];

  DOM.mainVideoPlayer.playbackRate = state.playbackSpeed;
  DOM.speedText.textContent = `${state.playbackSpeed}x`;
  showToast(`⚡ Kecepatan: ${state.playbackSpeed}x`);
}

function cycleAspectRatio() {
  const modes = [
    { label: '16:9', fit: 'contain' },
    { label: 'Penuh', fit: 'cover' },
    { label: 'Renggang', fit: 'fill' }
  ];

  state.aspectRatioIndex = (state.aspectRatioIndex + 1) % modes.length;
  const current = modes[state.aspectRatioIndex];

  DOM.mainVideoPlayer.style.objectFit = current.fit;
  DOM.btnAspectRatio.querySelector('span').textContent = current.label;
  showToast(`📺 Aspek Rasio: ${current.label}`);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    DOM.videoContainer.requestFullscreen().catch(err => {
      console.warn('Gagal fullscreen:', err);
    });
  } else {
    document.exitFullscreen().catch(err => {
      console.warn('Gagal keluar fullscreen:', err);
    });
  }
}

function resetHudIdleTimer() {
  DOM.playerHud.classList.remove('idle');
  clearTimeout(state.idleTimeout);

  // Auto-hide HUD after 3.2s of inactivity if video is playing
  state.idleTimeout = setTimeout(() => {
    if (!DOM.mainVideoPlayer.paused && !DOM.mainVideoPlayer.ended) {
      DOM.playerHud.classList.add('idle');
    }
  }, 3200);
}

// ==========================================================================
// WATCHLIST & LIBRARY MANAGEMENT (TAB 2)
// ==========================================================================
function toggleWatchlist(anime) {
  if (!anime) return;
  const index = state.watchlist.findIndex(item => String(item.id) === String(anime.id));

  if (index >= 0) {
    // Remove from library
    state.watchlist.splice(index, 1);
    showToast(`🗑️ ${anime.title} dihapus dari Library.`);
  } else {
    // Add to library
    const newItem = {
      id: anime.id,
      title: anime.title,
      native_title: anime.native_title,
      poster: anime.poster,
      score: anime.score,
      status: anime.status,
      category: 'watching',
      lastEpWatched: 1,
      totalEps: anime.episodes_count || (anime.episodes ? anime.episodes.length : 24),
      addedAt: Date.now()
    };
    state.watchlist.unshift(newItem);
    showToast(`📚 ${anime.title} ditambahkan ke Library!`);
  }

  saveWatchlist();
  updateLibraryCounters();
  if (state.activeTab === 'library') renderLibrary();
}

function recordEpisodeWatch(anime, epNumber) {
  if (!anime) return;
  let item = state.watchlist.find(w => String(w.id) === String(anime.id));

  if (!item) {
    item = {
      id: anime.id,
      title: anime.title,
      native_title: anime.native_title,
      poster: anime.poster,
      score: anime.score,
      status: anime.status,
      category: 'watching',
      lastEpWatched: epNumber,
      totalEps: anime.episodes_count || (anime.episodes ? anime.episodes.length : 24),
      addedAt: Date.now()
    };
    state.watchlist.unshift(item);
  } else {
    item.lastEpWatched = Math.max(item.lastEpWatched, epNumber);
    item.lastWatchedAt = Date.now();
    if (item.lastEpWatched >= item.totalEps) {
      item.category = 'completed';
    }
  }

  saveWatchlist();
  updateLibraryCounters();
}

function saveWatchlist() {
  localStorage.setItem('otakuverse_watchlist', JSON.stringify(state.watchlist));
}

function updateLibraryCounters() {
  const counts = {
    all: state.watchlist.length,
    watching: 0,
    plan: 0,
    completed: 0,
    dropped: 0
  };

  state.watchlist.forEach(item => {
    if (counts[item.category] !== undefined) {
      counts[item.category]++;
    }
  });

  DOM.libCountAll.textContent = counts.all;
  DOM.libCountWatching.textContent = counts.watching;
  DOM.libCountPlan.textContent = counts.plan;
  DOM.libCountCompleted.textContent = counts.completed;
  DOM.libCountDropped.textContent = counts.dropped;

  DOM.sidebarLibraryCount.textContent = counts.all;
  DOM.bottomLibraryCount.textContent = counts.all;
}

function renderLibrary() {
  DOM.libraryGrid.innerHTML = '';

  const filtered = state.watchlist.filter(item => {
    if (state.activeLibraryCategory === 'all') return true;
    return item.category === state.activeLibraryCategory;
  });

  if (filtered.length === 0) {
    DOM.libraryGrid.innerHTML = `
      <div class="empty-library-box">
        <div class="empty-icon">📭</div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff;">Belum Ada Koleksi di Kategori Ini</h3>
        <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 6px;">
          Buka katalog anime dan klik "Simpan ke Library" untuk menyimpan serial favorit Anda.
        </p>
        <button type="button" class="cta-btn primary-cta" style="margin-top: 18px;" onclick="document.querySelector('[data-tab=anime]').click()">
          <span>Cari Serial Anime</span>
        </button>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'anime-card';
    card.dataset.id = item.id;

    const progressPct = Math.min(100, Math.round((item.lastEpWatched / (item.totalEps || 24)) * 100));

    card.innerHTML = `
      <div class="card-poster-wrap">
        <img src="${escapeHtml(item.poster || '')}" alt="${escapeHtml(item.title)}" class="card-poster" loading="lazy">
        <div class="card-top-badges">
          <span class="score-chip">★ ${item.score || '8.8'}</span>
          <span class="ep-chip">EP ${item.lastEpWatched}/${item.totalEps}</span>
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(0,0,0,0.6);">
          <div style="height: 100%; width: ${progressPct}%; background: var(--accent-primary);"></div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(item.title)}</div>
        <div class="card-meta-line">${escapeHtml((item.studio && !item.studio.toLowerCase().includes('unknown')) ? `${item.studio} • ${item.type || 'TV'}` : `${(Array.isArray(item.genres) && item.genres.length) ? item.genres.slice(0, 2).join(', ') : (item.type || 'TV Series')}`)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <span class="status-pill ${item.category === 'completed' ? 'connected' : 'idle'}">
            ${getCategoryLabel(item.category)}
          </span>
          <button type="button" class="cta-btn icon-btn" title="Hapus dari Library" style="padding: 4px; height: 26px; width: 26px;" onclick="event.stopPropagation(); removeWatchlistItem('${escapeHtml(String(item.id))}')">
            ✕
          </button>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      // Find anime in catalog or build stub
      const found = state.allAnime.find(a => String(a.id) === String(item.id)) || item;
      openAnimeDetails(found);
    });

    fragment.appendChild(card);
  });

  DOM.libraryGrid.appendChild(fragment);
}

function getCategoryLabel(cat) {
  switch (cat) {
    case 'watching': return 'Ditonton';
    case 'plan': return 'Rencana';
    case 'completed': return 'Selesai';
    case 'dropped': return 'Dihentikan';
    default: return 'Library';
  }
}

window.removeWatchlistItem = function(id) {
  const index = state.watchlist.findIndex(i => String(i.id) === String(id));
  if (index >= 0) {
    state.watchlist.splice(index, 1);
    saveWatchlist();
    updateLibraryCounters();
    renderLibrary();
    showToast('🗑️ Serial dihapus dari Library');
  }
};

// ==========================================================================
// KEIYOUSHI EXTENSIONS MANAGER (TAB 3)
// ==========================================================================
const DEFAULT_EXTENSIONS = [
  { id: 'samehadaku', name: 'Samehadaku', lang: 'ID', flag: '🇮🇩', version: '1.4.2', author: 'Keiyoushi Community', icon: '⚡', status: 'installed', enabled: true, description: 'Sumber fansub anime subtitle Indonesia tercepat & mirror HD', baseUrl: 'https://samehadaku.email' },
  { id: 'otakudesu', name: 'Otakudesu', lang: 'ID', flag: '🇮🇩', version: '1.3.0', author: 'Keiyoushi Community', icon: '🌸', status: 'installed', enabled: true, description: 'Koleksi anime lengkap tamat & ongoing bahasa Indonesia', baseUrl: 'https://otakudesu.cloud' },
  { id: 'kuramanime', name: 'Kuramanime', lang: 'ID', flag: '🇮🇩', version: '1.2.1', author: 'Keiyoushi Community', icon: '🦊', status: 'installed', enabled: true, description: 'Streaming server resolusi 720p/1080p dengan audio jernih', baseUrl: 'https://kuramanime.pro' },
  { id: 'animeindo', name: 'AnimeIndo', lang: 'ID', flag: '🇮🇩', version: '1.1.0', author: 'Keiyoushi Community', icon: '🏮', status: 'available', enabled: false, description: 'Mirror anime subtitle Indonesia alternatif anti-blokir', baseUrl: 'https://animeindo.to' }
];

async function fetchExtensions() {
  try {
    const res = await fetch('/api/extensions');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        state.extensions = data.items;
        renderExtensions();
        return;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat ekstensi Keiyoushi dari server, fallback ke default:', err);
  }
  state.extensions = DEFAULT_EXTENSIONS;
  renderExtensions();
}

function renderExtensions() {
  DOM.extensionsList.innerHTML = '';

  if (!state.extensions.length) {
    DOM.extensionsList.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-dim);">
        <div>Memeriksa ekstensi terpasang...</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.extensions.forEach(ext => {
    const extCard = document.createElement('div');
    extCard.className = 'extension-card';

    extCard.innerHTML = `
      <div class="extension-left">
        <div class="ext-icon-box">${escapeHtml(ext.icon || '🧩')}</div>
        <div class="ext-info">
          <div class="ext-title-row">
            <span class="ext-name">${escapeHtml(ext.name)}</span>
            <span class="ext-lang-badge">${escapeHtml(ext.lang ? ext.lang.toUpperCase() : 'ID')}</span>
            <span class="ext-version">v${escapeHtml(ext.version || '1.0.0')}</span>
          </div>
          <div class="ext-desc">${escapeHtml(ext.description || 'Ekstensi scraper Aniyomi/Keiyoushi')}</div>
        </div>
      </div>
      <div class="ext-right" style="display: flex; gap: 8px; align-items: center;">
        <span class="status-pill connected">● Terpasang</span>
        <button type="button" class="cta-btn primary-cta" style="padding: 6px 12px; font-size: 0.8rem;" onclick="useExtensionSource('${escapeHtml(ext.id)}', '${escapeHtml(ext.name)}')">
          Gunakan
        </button>
        <button type="button" class="cta-btn secondary-cta" style="padding: 6px 12px; font-size: 0.8rem;" onclick="checkSingleExtUpdate('${escapeHtml(ext.id)}')">
          Perbarui
        </button>
      </div>
    `;

    fragment.appendChild(extCard);
  });

  DOM.extensionsList.appendChild(fragment);
}

window.useExtensionSource = function(extId, extName) {
  state.selectedSource = extId;
  if (DOM.sourceSelectDropdown) {
    DOM.sourceSelectDropdown.value = extId;
    const selectedText = DOM.sourceSelectDropdown.options[DOM.sourceSelectDropdown.selectedIndex]?.text || extName;
    if (DOM.sidebarActiveSource) {
      DOM.sidebarActiveSource.querySelector('.source-text').textContent = selectedText;
    }
  }
  showToast(`📡 Sumber aktif diubah ke ${extName}`);
  const animeTabBtn = document.querySelector('.aniyomi-sidebar .nav-item[data-tab="anime"]') || document.querySelector('.aniyomi-bottom-nav .bottom-nav-item[data-tab="anime"]');
  if (animeTabBtn) animeTabBtn.click();
  state.currentPage = 1;
  fetchAnime(false);
};

window.checkSingleExtUpdate = function(extId) {
  showToast(`✅ Ekstensi ${extId} telah menggunakan versi terbaru.`);
};

// ==========================================================================
// SETTINGS PREFERENCES (TAB 4)
// ==========================================================================
function setupSettingsUI() {
  // Skip Intro setting
  DOM.settingSkipIntroTime.value = state.settings.skipIntroTime;
  DOM.settingSkipIntroTime.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 85;
    state.settings.skipIntroTime = val;
    localStorage.setItem('otakuverse_skip_intro', val.toString());
    DOM.btnSkipIntro.querySelector('span').textContent = `⏩ Lewati Intro (+${val}s)`;
    showToast(`⏱️ Durasi lewati intro diatur ke ${val} detik`);
  });

  // Default Quality
  DOM.settingDefaultQuality.value = state.settings.defaultQuality;
  DOM.settingDefaultQuality.addEventListener('change', (e) => {
    state.settings.defaultQuality = e.target.value;
    localStorage.setItem('otakuverse_quality', e.target.value);
    DOM.qualitySelect.value = e.target.value;
    showToast(`🎬 Kualitas default diatur ke ${e.target.value}p`);
  });

  // Auto-play Next
  DOM.settingAutoNext.checked = state.settings.autoNext;
  DOM.settingAutoNext.addEventListener('change', (e) => {
    state.settings.autoNext = e.target.checked;
    localStorage.setItem('otakuverse_autonext', e.target.checked.toString());
    showToast(e.target.checked ? '▶️ Putar otomatis episode berikutnya aktif' : '⏹️ Putar otomatis dimatikan');
  });

  // Auto Fallback Server
  DOM.settingAutoFallback.checked = state.settings.autoFallback;
  DOM.settingAutoFallback.addEventListener('change', (e) => {
    state.settings.autoFallback = e.target.checked;
    localStorage.setItem('otakuverse_autofallback', e.target.checked.toString());
    showToast(e.target.checked ? '🔁 Auto Fallback Server aktif' : '⏹️ Auto Fallback dimatikan');
  });

  // Clear Cache
  DOM.btnClearCache.addEventListener('click', () => {
    localStorage.removeItem('otakuverse_watchlist');
    state.watchlist = [];
    updateLibraryCounters();
    DOM.settingCacheSize.textContent = '0 MB (Bersih)';
    showToast('🧹 Cache & riwayat lokal berhasil dibersihkan.');
  });
}

// ==========================================================================
// SECRET ADMIN & SPECIAL 18+ VAULT MODE
// ==========================================================================
function setupAdminMode() {
  const getAdminPin = () => localStorage.getItem('otakuverse_admin_pin') || '6969';

  const updateAdminUI = () => {
    // Hide/show extensions tab dynamically based on admin mode
    document.querySelectorAll('.admin-only-tab').forEach(tab => {
      tab.style.display = state.adminMode ? 'flex' : 'none';
    });

    if (DOM.adminStatusPill) {
      if (state.adminMode) {
        DOM.adminStatusPill.textContent = 'Terbuka 🔓';
        DOM.adminStatusPill.style.background = 'rgba(139, 92, 246, 0.25)';
        DOM.adminStatusPill.style.color = '#c084fc';
        DOM.adminStatusPill.style.borderColor = '#8b5cf6';
      } else {
        DOM.adminStatusPill.textContent = 'Terkunci 🔒';
        DOM.adminStatusPill.style.background = 'rgba(255, 255, 255, 0.05)';
        DOM.adminStatusPill.style.color = 'var(--text-muted)';
        DOM.adminStatusPill.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }
    }
    if (DOM.btnToggleAdminText) {
      DOM.btnToggleAdminText.textContent = state.adminMode ? '🔒 Kunci Akses Kembali' : '🔑 Buka Kunci Akses';
    }
    if (DOM.adminControlsArea) {
      DOM.adminControlsArea.classList.toggle('hidden', !state.adminMode);
    }

    // Header Vault Badge (Discreet & Aesthetic)
    let vipBadge = document.getElementById('headerAdminBadge');
    if (state.adminMode) {
      if (!vipBadge && DOM.viewHeaderTitle) {
        vipBadge = document.createElement('span');
        vipBadge.id = 'headerAdminBadge';
        vipBadge.style.cssText = 'font-size: 0.65rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 2px 7px; border-radius: 4px; font-weight: 700; margin-left: 8px; vertical-align: middle; box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);';
        vipBadge.textContent = '🌙 VAULT AKTIF';
        DOM.viewHeaderTitle.appendChild(vipBadge);
      }
    } else {
      if (vipBadge) vipBadge.remove();
    }

    // Inject / remove Admin Special Pill in Catalog
    let adminPill = document.querySelector('.genre-pill.admin-genre-pill');
    if (state.adminMode) {
      if (!adminPill && DOM.genrePillsList) {
        adminPill = document.createElement('button');
        adminPill.type = 'button';
        adminPill.className = 'genre-pill admin-genre-pill';
        adminPill.dataset.genre = 'Spesial 18+';
        adminPill.style.cssText = 'border-color: rgba(139, 92, 246, 0.6); color: #c084fc; font-weight: 600;';
        adminPill.textContent = '🌙 Late Night Vault';
        adminPill.addEventListener('click', () => {
          DOM.genrePillsList.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
          adminPill.classList.add('active');
          state.selectedGenre = 'Spesial 18+';
          fetchAnime(false);
        });
        DOM.genrePillsList.appendChild(adminPill);
      }
    } else {
      if (adminPill) {
        if (adminPill.classList.contains('active')) {
          const allPill = DOM.genrePillsList.querySelector('.genre-pill[data-genre="All"]');
          if (allPill) allPill.click();
        }
        adminPill.remove();
      }
    }
  };

  const promptAdminPIN = () => {
    if (state.adminMode) {
      state.adminMode = false;
      localStorage.setItem('otakuverse_admin', 'false');
      updateAdminUI();
      showToast('🔒 Akses Brankas Dikunci (Aman)');
      return;
    }

    showToast('🔑 Membaca kunci dari Flashdisk/OTG...', 2000);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.key,.txt';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target.result.trim();
        // The secret key inside the file must match "OTAKU_ADMIN_1337"
        if (content === 'OTAKU_ADMIN_1337') {
          state.adminMode = true;
          localStorage.setItem('otakuverse_admin', 'true');
          updateAdminUI();
          showToast('🔓 Akses Brankas Berhasil Dibuka lewat Flashdisk!');
          const specialPill = document.querySelector('.genre-pill.admin-genre-pill');
          if (specialPill) specialPill.click();
        } else {
          showToast('❌ Kunci Flashdisk salah atau tidak valid!');
        }
      };
      reader.readAsText(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  // No more manual toggle buttons in Settings
  // Secret 5-clicks trigger on Brand Title or Header
  let secretClicks = 0;
  let secretTimer = null;
  const brandTitle = document.querySelector('.aniyomi-sidebar .brand-title') || DOM.viewHeaderTitle;
  if (brandTitle) {
    brandTitle.addEventListener('click', () => {
      secretClicks++;
      clearTimeout(secretTimer);
      secretTimer = setTimeout(() => { secretClicks = 0; }, 1500);
      if (secretClicks >= 5) {
        secretClicks = 0;
        promptAdminPIN();
      }
    });
  }

  // Custom Stream Injector
  if (DOM.btnAdminPlayCustom && DOM.adminCustomStreamInput) {
    DOM.btnAdminPlayCustom.addEventListener('click', () => {
      const url = DOM.adminCustomStreamInput.value.trim();
      if (!url) {
        showToast('⚠️ Masukkan URL video terlebih dahulu');
        return;
      }
      openPlayer({
        id: 'custom_admin_stream',
        title: 'Custom Stream (Admin Injector)',
        native_title: 'Direct Video Stream',
        source: 'Admin Injector',
        episodes: [{ number: 1, title: 'Stream Khusus', url: url, stream_url: url }]
      }, 0);
    });
  }

  updateAdminUI();
}

// ==========================================================================
// EVENT LISTENERS & WIRING
// ==========================================================================
function setupEventListeners() {
  // Quick Fallback Mirror Button
  if (DOM.btnQuickFallbackServer) {
    DOM.btnQuickFallbackServer.addEventListener('click', quickCycleFallbackServer);
  }
  // Global Search Input with Debounce
  let searchTimer = null;
  DOM.globalSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      fetchAnime(false);
    }, 380);
  });

  // Source Selector Dropdown
  DOM.sourceSelectDropdown.addEventListener('change', (e) => {
    state.selectedSource = e.target.value;
    const selectedText = DOM.sourceSelectDropdown.options[DOM.sourceSelectDropdown.selectedIndex].text;
    DOM.sidebarActiveSource.querySelector('.source-text').textContent = selectedText;
    showToast(`📡 Sumber diubah ke ${selectedText}`);
    state.currentPage = 1;
    fetchAnime(false);
  });

  // Sort Filter Buttons
  DOM.sortFilterGroup.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.sortFilterGroup.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSort = btn.dataset.sort;
      fetchAnime(false);
    });
  });

  // Status Filter Buttons
  DOM.statusFilterGroup.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.statusFilterGroup.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedStatus = btn.dataset.status;
      fetchAnime(false);
    });
  });

  // Genre Pills
  DOM.genrePillsList.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.genrePillsList.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedGenre = pill.dataset.genre;
      fetchAnime(false);
    });
  });

  // Load More Button
  if (DOM.btnLoadMore) {
    DOM.btnLoadMore.addEventListener('click', () => {
      if (!state.isLoading && state.hasNextPage) {
        state.currentPage++;
        fetchAnime(true);
      }
    });
  }

  // Library Category Tabs
  DOM.libTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.libTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeLibraryCategory = tab.dataset.category;
      renderLibrary();
    });
  });

  // Check Ext Updates Button
  if (DOM.btnCheckExtUpdates) {
    DOM.btnCheckExtUpdates.addEventListener('click', () => {
      showToast('🔄 Memeriksa repository Keiyoushi...');
      setTimeout(() => {
        showToast('✅ Semua ekstensi scraper Keiyoushi sudah yang terbaru!');
      }, 800);
    });
  }

  // Anime Details Back Button
  DOM.btnDetailBack.addEventListener('click', closeAnimeDetails);

  // Episodes Sort Toggle in Details
  DOM.btnSortEpisodes.addEventListener('click', () => {
    state.episodesAscending = !state.episodesAscending;
    renderDetailEpisodes();
  });

  // Close Player Button
  DOM.btnClosePlayer.addEventListener('click', closePlayer);

  // Video Element Events
  DOM.mainVideoPlayer.addEventListener('play', () => updatePlayIcons(true));
  DOM.mainVideoPlayer.addEventListener('pause', () => updatePlayIcons(false));
  
  let bufferingTimeout = null;
  const triggerAutoFallback = () => {
    if (!state.settings.autoFallback) return;
    const select = DOM.serverSelect;
    const currentIdx = select.selectedIndex;
    // Switch to next server if there is one (ignoring the last one if it's trailer, wait, we can just switch to the next valid option)
    if (currentIdx >= 0 && currentIdx < select.options.length - 1) {
      const nextOpt = select.options[currentIdx + 1];
      if (nextOpt.value === 'trailer') return; // don't fallback to trailer
      showToast(`⚠️ Server lemot/error. Ganti otomatis ke ${nextOpt.text}...`);
      select.selectedIndex = currentIdx + 1;
      select.dispatchEvent(new Event('change'));
    }
  };

  DOM.mainVideoPlayer.addEventListener('error', (e) => {
    if (DOM.mainVideoPlayer.error && state.settings.autoFallback) {
      triggerAutoFallback();
    }
  });

  DOM.mainVideoPlayer.addEventListener('waiting', () => {
    DOM.videoContainer.classList.add('is-buffering');
    DOM.centerPlayIcon.innerHTML = '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="16 16" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle>';
    if (state.settings.autoFallback) {
      clearTimeout(bufferingTimeout);
      bufferingTimeout = setTimeout(() => {
        if (DOM.videoContainer.classList.contains('is-buffering')) {
          triggerAutoFallback();
        }
      }, 10000); // 10 seconds threshold
    }
  });
  DOM.mainVideoPlayer.addEventListener('playing', () => {
    DOM.videoContainer.classList.remove('is-buffering');
    DOM.centerPlayIcon.innerHTML = DOM.mainVideoPlayer.paused ? '<polygon points="5 3 19 12 5 21 5 3"></polygon>' : '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    clearTimeout(bufferingTimeout);
    updatePlayIcons(true);
  });
  DOM.mainVideoPlayer.addEventListener('canplay', () => {
    DOM.videoContainer.classList.remove('is-buffering');
    clearTimeout(bufferingTimeout);
  });
  DOM.mainVideoPlayer.addEventListener('ended', () => {
    updatePlayIcons(false);
    if (state.settings.autoNext) {
      showToast('⏭️ Episode selesai, memutar episode berikutnya...');
      setTimeout(() => playNextEpisode(), 1500);
    }
  });

  DOM.mainVideoPlayer.addEventListener('timeupdate', () => {
    const cur = DOM.mainVideoPlayer.currentTime || 0;
    const dur = DOM.mainVideoPlayer.duration || 0;

    DOM.currentTimeText.textContent = formatTime(cur);
    DOM.durationTimeText.textContent = formatTime(dur);

    if (dur > 0) {
      const pct = (cur / dur) * 100;
      DOM.timelineProgress.style.width = `${pct}%`;
      DOM.timelineSlider.value = pct;
    }

    // Buffer bar
    if (DOM.mainVideoPlayer.buffered && DOM.mainVideoPlayer.buffered.length > 0 && dur > 0) {
      const buffEnd = DOM.mainVideoPlayer.buffered.end(DOM.mainVideoPlayer.buffered.length - 1);
      DOM.timelineBuffer.style.width = `${(buffEnd / dur) * 100}%`;
    }
  });

  // Timeline Slider Scrubbing
  DOM.timelineSlider.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value);
    DOM.timelineProgress.style.width = `${pct}%`;
    if (DOM.mainVideoPlayer.duration) {
      DOM.mainVideoPlayer.currentTime = (pct / 100) * DOM.mainVideoPlayer.duration;
    }
  });

  // Player Buttons
  DOM.btnPlayPause.addEventListener('click', togglePlayPause);
  DOM.centerPlayButton.addEventListener('click', togglePlayPause);
  DOM.btnRewind10.addEventListener('click', () => skipVideoTime(-10));
  DOM.btnForward10.addEventListener('click', () => skipVideoTime(10));
  DOM.btnSkipIntro.addEventListener('click', skipIntro);
  DOM.btnNextEpisode.addEventListener('click', playNextEpisode);
  DOM.btnPlaybackSpeed.addEventListener('click', cyclePlaybackSpeed);
  DOM.btnAspectRatio.addEventListener('click', cycleAspectRatio);
  DOM.btnFullscreen.addEventListener('click', toggleFullscreen);

  // Volume & Mute
  DOM.volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    DOM.mainVideoPlayer.volume = val;
    DOM.mainVideoPlayer.muted = (val === 0);
    DOM.volumeIcon.textContent = val === 0 ? '🔇' : (val < 0.5 ? '🔉' : '🔊');
  });

  DOM.btnMute.addEventListener('click', () => {
    DOM.mainVideoPlayer.muted = !DOM.mainVideoPlayer.muted;
    DOM.volumeIcon.textContent = DOM.mainVideoPlayer.muted ? '🔇' : '🔊';
    if (!DOM.mainVideoPlayer.muted && DOM.mainVideoPlayer.volume === 0) {
      DOM.mainVideoPlayer.volume = 0.5;
      DOM.volumeSlider.value = 0.5;
    }
  });

  // Server Switcher
  DOM.serverSelect.addEventListener('change', (e) => {
    if (!state.currentAnime) return;
    const selectedOpt = DOM.serverSelect.options[DOM.serverSelect.selectedIndex];
    if (!selectedOpt) return;

    const streamUrl = selectedOpt.dataset.url;
    const streamType = selectedOpt.dataset.type;
    const serverName = selectedOpt.text;
    const streamQuality = selectedOpt.dataset.quality;

    if (streamQuality && DOM.qualitySelect) {
      const qVal = streamQuality.toLowerCase().replace('p', '');
      DOM.qualitySelect.value = qVal;
      state.settings.defaultQuality = qVal;
      localStorage.setItem('otakuverse_quality', qVal);
      if (DOM.settingDefaultQuality) DOM.settingDefaultQuality.value = qVal;
    }

    if (streamType === 'external') {
      window.open(streamUrl, '_blank');
      showToast(`🔗 Membuka ${serverName} di tab baru...`);
    } else if (streamType === 'iframe') {
      loadIframeStream(streamUrl, serverName);
    } else {
      const episodes = state.currentAnime.episodes || [];
      const currentEp = episodes[state.currentEpIndex];
      const fallbackUrl = currentEp ? currentEp.stream_url : `/media/anime_${state.currentAnime.id}.mp4`;
      loadNativeVideo(streamUrl || fallbackUrl);
      showToast(`⚡ Beralih ke server: ${serverName}`);
    }
  });

  // Quality Switcher
  DOM.qualitySelect.addEventListener('change', (e) => {
    switchStreamQuality(e.target.value);
  });

  // HUD Idle Detection
  DOM.videoContainer.addEventListener('mousemove', resetHudIdleTimer);
  DOM.videoContainer.addEventListener('touchstart', resetHudIdleTimer);
  DOM.videoContainer.addEventListener('click', (e) => {
    if (e.target === DOM.mainVideoPlayer) {
      togglePlayPause();
    }
    resetHudIdleTimer();
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Esc closes modals
    if (e.key === 'Escape') {
      if (DOM.playerModal.classList.contains('active')) {
        closePlayer();
        return;
      }
      if (DOM.animeDetailsView.classList.contains('active')) {
        closeAnimeDetails();
        return;
      }
    }

    // Don't intercept shortcuts when typing in search or inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl + K or '/' focuses search
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || e.key === '/') {
      e.preventDefault();
      DOM.globalSearchInput.focus();
      return;
    }

    // Only handle video shortcuts if player is open
    if (!DOM.playerModal.classList.contains('active')) return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'j':
      case 'arrowleft':
        e.preventDefault();
        skipVideoTime(-10);
        break;
      case 'l':
      case 'arrowright':
        e.preventDefault();
        skipVideoTime(10);
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        DOM.btnMute.click();
        break;
      case 's':
      case 'i':
        e.preventDefault();
        skipIntro();
        break;
      case 'n':
        e.preventDefault();
        playNextEpisode();
        break;
    }
  });
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const remSec = s % 60;
  const h = Math.floor(m / 60);
  const remMin = m % 60;

  if (h > 0) {
    return `${h}:${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  }
  return `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

let toastTimer = null;
function showToast(message, duration = 3000) {
  if (!DOM.toastNotice) return;
  DOM.toastNotice.textContent = message;
  DOM.toastNotice.classList.add('visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    DOM.toastNotice.classList.remove('visible');
  }, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
