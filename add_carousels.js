
async function fetchCarousels() {
  const carousels = [
    { id: 'carouselTopRated', sort: 'score', perPage: 10 },
    { id: 'carouselMostRecommended', sort: 'popular', perPage: 10 },
    { id: 'carouselBestAnime', sort: 'trending', perPage: 10 }
  ];

  for (const c of carousels) {
    try {
      const res = await fetch(`/api/anime?sort=${c.sort}&perPage=${c.perPage}`);
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        renderCarousel(c.id, items);
      }
    } catch (e) {
      console.error(`Gagal memuat carousel ${c.id}:`, e);
    }
  }
}

function renderCarousel(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  items.forEach(anime => {
    const card = document.createElement('article');
    card.className = 'anime-card';
    card.dataset.id = anime.id;
    card.tabIndex = 0;
    
    const scoreVal = anime.score ? `★ ${anime.score}` : '★ 8.5';
    const title = escapeHtml(anime.title);
    
    card.innerHTML = `
      <div class="card-poster-wrap">
        <img src="${escapeHtml(anime.poster)}" alt="${title}" class="card-poster" loading="lazy" referrerpolicy="no-referrer">
        <div class="card-top-badges">
          <span class="score-badge" style="background: rgba(0,0,0,0.8); color: #ffd700; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${scoreVal}</span>
        </div>
        <div class="card-hover-overlay">▶ Putar</div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${title}</h3>
      </div>
    `;
    
    card.addEventListener('click', () => {
      openPlayer(anime, 0);
    });
    
    container.appendChild(card);
  });
}
