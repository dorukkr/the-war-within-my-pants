/* ================================
   Helpers & feature toggles
================================ */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

/* ================================
   Fade-in with IntersectionObserver
================================ */
(() => {
  if (prefersReduced) return; // animasyonları kapat
  const faders = document.querySelectorAll('.fade-in');
  if (!faders.length) return;

  const io = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      obs.unobserve(entry.target);
    }
  }, { threshold: 0.2 });

  faders.forEach(el => io.observe(el));
})();

/* ==========================================
   HERO: animated starfield canvas (HiDPI)
========================================== */
(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  if (prefersReduced) return; // ağır animasyon, kapat

  const ctx = canvas.getContext('2d', { alpha: true });
  let stars = [];
  const COUNT = 140;

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || 480;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // canvas çizimlerini CSS pikseline göre hizala
    // yıldızları yeniden dağıt
    stars = Array.from({ length: COUNT }, () => ({
      x: Math.random() * cssW,
      y: Math.random() * cssH,
      r: Math.random() * 1.6 + 0.4,
      a: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
      ph: Math.random() * Math.PI * 2
    }));
  }

  let rafId;
  function frame(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const tw = Math.sin(t / 900 + s.ph) * 0.25;
      ctx.globalAlpha = Math.max(0, Math.min(1, s.a + tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -5) s.x = w + 5; if (s.x > w + 5) s.x = -5;
      if (s.y < -5) s.y = h + 5; if (s.y > h + 5) s.y = -5;
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  }

  // Debounced resize
  let rto;
  const onResize = () => {
    clearTimeout(rto);
    rto = setTimeout(() => {
      resize();
    }, 120);
  };

  resize();
  rafId = requestAnimationFrame(frame);
  window.addEventListener('resize', onResize, { passive: true });

  // (İsteğe bağlı) görünürlük sekme değişiminde animasyonu durdur
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else rafId = requestAnimationFrame(frame);
  });
})();

/* ==========================================
   HERO: mouse tilt / parallax on content
========================================== */
(() => {
  const hero = document.getElementById('hero');
  const logo = document.getElementById('guildLogo');
  const cta  = document.getElementById('ctaBtn'); // HTML tarafında yoksa sorun değil
  const content = document.getElementById('heroContent') || document.querySelector('.hero-content');
  if (!hero || !content) return;
  if (!hasFinePointer || prefersReduced) return; // mobil/trackpad & reduced motion: kapat

  function onMove(e) {
    const r = hero.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / r.width;  // ~ -0.5..0.5
    const dy = (e.clientY - cy) / r.height;

    const rotX = dy * 6;
    const rotY = -dx * 6;
    content.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
    if (logo) logo.style.transform = `translate(${dx * 10}px, ${dy * 10}px) scale(0.98)`;
    if (cta)  cta.style.transform  = `translate(${dx * 6}px, ${dy * 6}px)`;
  }
  function onLeave() {
    content.style.transform = `rotateX(0deg) rotateY(0deg)`;
    if (logo) logo.style.transform = `translate(0,0) scale(0.98)`;
    if (cta)  cta.style.transform  = `translate(0,0)`;
  }

  hero.addEventListener('mousemove', onMove);
  hero.addEventListener('mouseleave', onLeave);
})();

/* ================================
   Footer year (guarded)
================================ */
(() => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

/* =========================================================
   Scroll-driven effects with rAF coalescing
   - .progress-animate için scale+opacity
   - .members-image için özel scale
   - .parallax-bg için arka plan kaydırma
========================================================= */
(() => {
  if (prefersReduced) return; // animasyon yok

  // Cache selectors
  const progressEls = Array.from(document.querySelectorAll('.progress-animate'));
  const membersImg = document.querySelector('.members-image');
  const parallaxSecs = Array.from(document.querySelectorAll('.parallax-bg'));

  let ticking = false;

  function update() {
    const h = window.innerHeight;

    // 1) Genel progress animasyon (members-image hariç)
    for (const el of progressEls) {
      if (el === membersImg) continue;
      const rect = el.getBoundingClientRect();
      const start = h * 0.9;
      const end   = h * 0.1;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      const scale   = 0.92 + p * 0.10;   // 0.92 -> 1.02
      const opacity = 0.55 + p * 0.45;   // 0.55 -> 1
      el.style.transform = `scale(${scale}) translateY(${30 * (1 - p)}px)`;
      el.style.opacity = opacity;
    }

    // 2) Members görseli için özel progress
    if (membersImg) {
      const r = membersImg.getBoundingClientRect();
      const start = h * 0.95;
      const end   = h * 0.15;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      const mScale   = 0.90 + p * 0.15;  // 0.90 -> 1.05
      const mOpacity = 0.60 + p * 0.40;  // 0.6 -> 1
      membersImg.style.transform = `scale(${mScale}) translateY(${24 * (1 - p)}px)`;
      membersImg.style.opacity   = mOpacity;
    }

    // 3) Parallax arka planlar
    const off = window.scrollY * 0.2;
    for (const sec of parallaxSecs) {
      sec.style.backgroundPosition = `center calc(50% + ${off}px)`;
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  // İlk çalıştırma + dinleyiciler
  window.addEventListener('load', update, { once: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
})();


/* ===== Path-based section routing ("/home", "/members", "/raids", "/media") ===== */
(() => {
  // URL yolu -> section id eşlemesi
  const PATH_TO_SECTION = {
    "/": "hero",
    "/home": "hero",
    "/members": "members",
    "/raids": "raids",
    "/media": "media"
  };

  // Bu sayfa ana sayfa mı? (hero var mı?)
  const isHome = !!document.getElementById("hero");

  function routeToSectionFromPath() {
    const id = PATH_TO_SECTION[location.pathname];
    if (!id) return; // yönetmediğimiz bir path
    const el = document.getElementById(id);
    if (!el) return;

    // fixed navbar için ~70px offset
    const top = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top, behavior: "smooth" });

    // nav aktiflik
    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("is-active"));
    const active = document.querySelector(`.nav a[href="${location.pathname}"]`);
    if (active) active.classList.add("is-active");
  }

  // Sadece ana sayfada menü tıklamalarını SPA gibi ele al
  if (isHome) {
    document.querySelectorAll('.nav a[href^="/"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (href && PATH_TO_SECTION[href]) {
          e.preventDefault();                 // tam sayfa yenilemeyi engelle
          history.pushState({}, "", href);    // URL'i güncelle
          routeToSectionFromPath();           // ilgili bölüme kaydır
        }
      });
    });
  }

  // İlk yüklemede de path'e göre kaydır (özellikle /members vb. ile gelindiyse)
  const ready = () => routeToSectionFromPath();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }

  // Geri/ileri tuşları
  window.addEventListener("popstate", routeToSectionFromPath);
})();


/* =========================================================
   Progress Bar Animation (Viewport trigger)
========================================================= */
(() => {
  if (prefersReduced) return; // reduced motion: animasyon yok
  
  const bars = document.querySelectorAll('.progress-bar');
  if (!bars.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const progress = bar.dataset.progress || 0;
        // Viewport'a girince animasyon tetikle
        setTimeout(() => {
          bar.style.width = progress + '%';
        }, 100);
        io.unobserve(bar); // bir kez tetiklendi, yeter
      }
    });
  }, { threshold: 0.3 });

  bars.forEach(bar => io.observe(bar));
})();
/* =========================================================
   Guild Logo: Click Particle Explosion
========================================================= */
(() => {
  const logo = document.getElementById('guildLogo');
  const canvas = document.getElementById('logoParticleCanvas');
  if (!logo || !canvas) return;
  if (prefersReduced) return; // reduced motion: animasyon yok

  const ctx = canvas.getContext('2d', { alpha: true });
  let particles = [];
  let animationId = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Particle class
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = (Math.random() - 0.5) * 8 - 2; // yukarı yönlü bias
      this.life = 1; // 1 = tam, 0 = ölü
      this.size = Math.random() * 6 + 3;
      this.color = `hsl(${45 + Math.random() * 15}, 100%, ${60 + Math.random() * 20}%)`;
      this.gravity = 0.15;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity; // gravity etkisi
      this.life -= 0.015; // fade out
      this.vx *= 0.98; // friction
    }

    draw() {
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (particles.length > 0) {
      animationId = requestAnimationFrame(animate);
    } else {
      animationId = null;
    }
  }

  logo.addEventListener('click', (e) => {
    const rect = logo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 40-60 parçacık oluştur
    const count = 50;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(centerX, centerY));
    }

    if (!animationId) animate();
  });
})();


/* =========================================================
   Guild Roster Manager (Hybrid: JSON + Raider.IO API)
========================================================= */
(() => {
  const grid = document.getElementById('rosterGrid');
  const loading = document.getElementById('rosterLoading');
  const error = document.getElementById('rosterError');
  if (!grid || !loading) return;

  const CLASS_COLORS = {
    'Death Knight': '#C41F3B',
    'Demon Hunter': '#A330C9',
    'Druid': '#FF7D0A',
    'Evoker': '#33937F',
    'Hunter': '#ABD473',
    'Mage': '#40C7EB',
    'Monk': '#00FF96',
    'Paladin': '#F58CBA',
    'Priest': '#FFFFFF',
    'Rogue': '#FFF569',
    'Shaman': '#0070DE',
    'Warlock': '#8787ED',
    'Warrior': '#C79C6E'
   };

  // TWW Raid Kronolojisi (Midnight çıktığında güncelle)
  const TWW_RAIDS = [
    'nerub-ar-palace',           // Season 1
    'liberation-of-undermine',   // Season 2
    'manaforge-omega'            // Season 3 (En son)
  ];

  let allMembers = [];
let currentFilter = 'all'; // Rank filter (mevcut)
let activeRoles = ['Tank', 'Healer', 'DPS']; // YENİ: Role filter (multi-select)
let searchQuery = ''; // YENİ: Arama terimi
let currentPage = 1; // YENİ: Pagination
const membersPerPage = 12; // YENİ: Sayfa başına üye sayısı

   // Tüm filtreleri uygula (rank + role + search)
function getFilteredMembers() {
  let filtered = allMembers;

  // 1. Rank Filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(m => m.rank === currentFilter);
  }

  // 2. Role Filter (multi-select)
  if (activeRoles.length > 0 && activeRoles.length < 3) {
    filtered = filtered.filter(m => activeRoles.includes(m.role));
  }

  // 3. Search Query
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(m => m.name.toLowerCase().includes(query));
  }

  return filtered;
}

function renderPaginatedGrid() {
  const filtered = getFilteredMembers();
  const totalPages = Math.ceil(filtered.length / membersPerPage);
  const startIdx = (currentPage - 1) * membersPerPage;
  const endIdx = startIdx + membersPerPage;
  const pageMembers = filtered.slice(startIdx, endIdx);

  // Render cards
  renderGrid(pageMembers);

  // Update pagination UI
  updatePaginationUI(filtered.length, totalPages);
}

function updatePaginationUI(totalMembers, totalPages) {
  const paginationDiv = document.getElementById('paginationControls');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const pageInfo = document.getElementById('pageInfo');
  const memberCount = document.getElementById('memberCount');

  if (!paginationDiv || !prevBtn || !nextBtn || !pageInfo || !memberCount) return;

  if (totalPages <= 1) {
    paginationDiv.style.display = 'none';
  } else {
    paginationDiv.style.display = 'flex';
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    memberCount.textContent = `${totalMembers} member${totalMembers !== 1 ? 's' : ''}`;
  }
}


  // 1. Manuel JSON yükle
  async function loadManualData() {
    try {
      const resp = await fetch('roster.json');
      if (!resp.ok) throw new Error('roster.json bulunamadı');
      const data = await resp.json();
      return data.members || [];
    } catch (err) {
      console.warn('roster.json yüklenemedi:', err);
      return [];
    }
  }

   

// TWW'nin en son aktif raid'ini bul (öncelik sırasına göre)
function getLatestRaid(raidProgression) {
  if (!raidProgression || typeof raidProgression !== 'object') {
    console.log('⚠️ getLatestRaid: raidProgression null veya object değil');
    return null;
  }
  
  // Listeden geriye doğru (en son raid'den başlayarak)
  for (let i = TWW_RAIDS.length - 1; i >= 0; i--) {
    const raidName = TWW_RAIDS[i];
    if (raidProgression[raidName]) {
      console.log(`✅ Raid seçildi: ${raidName}`);
      // Hem raid nesnesini hem de ismini döndür
      return {
        data: raidProgression[raidName],
        name: raidName
      };
    }
  }
  
  console.log('⚠️ Hiçbir bilinen TWW raid bulunamadı');
  return null;
}

// Raid progress öncelik mantığı: Mythic > Heroic > Normal
function getHighestRaidProgress(raidInfo) {
  if (!raidInfo) return '—';
  
  const raidData = raidInfo.data;
  const raidName = raidInfo.name;
  
  // Raid ismini düzgün formata çevir (manaforge-omega → Manaforge Omega)
  const displayName = raidName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const totalBosses = raidData.total_bosses || 8;
  
  // Mythic öncelikli (Mor)
  if (raidData.mythic_bosses_killed > 0) {
    return `<span class="raid-mythic">${raidData.mythic_bosses_killed}/${totalBosses} M - ${displayName}</span>`;
  }
  
  // Heroic (Lacivert)
  if (raidData.heroic_bosses_killed > 0) {
    return `<span class="raid-heroic">${raidData.heroic_bosses_killed}/${totalBosses} H - ${displayName}</span>`;
  }
  
  // Normal (Yeşil)
  if (raidData.normal_bosses_killed > 0) {
    return `<span class="raid-normal">${raidData.normal_bosses_killed}/${totalBosses} N - ${displayName}</span>`;
  }
  
  return '—';
}

// 2. Raider.IO API'den veri çek (opsiyonel)
async function enrichWithRaiderIO(member) {
    try {
     const region = member.region || 'eu'; // fallback to eu if not specified
      const url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${member.realm}&name=${member.name}&fields=gear,mythic_plus_scores_by_season:current,raid_progression`;
      const resp = await fetch(url);
      if (!resp.ok) return member;
      
      const data = await resp.json();

// Debug: API response'u logla
console.log(`📊 ${member.name} API Response:`, {
  raids: data.raid_progression ? Object.keys(data.raid_progression) : 'YOK',
  latestRaid: getLatestRaid(data.raid_progression)
});

return {
  ...member,
  ilvl: data.gear?.item_level_equipped || '—',
  mplusScore: data.mythic_plus_scores_by_season?.[0]?.scores?.all || 0,
  raidProgress: getHighestRaidProgress(getLatestRaid(data.raid_progression)),
  thumbnail: data.thumbnail_url || ''
};
    } catch (err) {
      console.warn(`Raider.IO API hatası (${member.name}):`, err);
      return member;
    }
  }

  // 3. Member Card HTML oluştur
  function createMemberCard(member) {
  const classColor = CLASS_COLORS[member.mainClass] || '#ddd';
  const roleIcon = member.role === 'Tank' ? 'tank' : member.role === 'Healer' ? 'healer' : 'dps';
  
  // Raider.IO URL oluştur
  const raiderIOUrl = `https://raider.io/characters/${member.region || 'eu'}/${encodeURIComponent(member.realm.toLowerCase().replace(/\s+/g, '-'))}/${encodeURIComponent(member.name.toLowerCase())}`;
  
  return `
    <a href="${raiderIOUrl}" 
       target="_blank" 
       rel="noopener noreferrer" 
       class="member-card-link"
       aria-label="View ${member.name}'s Raider.IO profile">

      <div class="member-card" 
           style="--class-color: ${classColor}; --class-color-glow: ${classColor}40;"
           data-rank="${member.rank}"
           role="listitem">
        <div class="member-card-header">
          <img class="member-avatar" 
               src="${member.thumbnail || 'https://render.worldofwarcraft.com/' + (member.region || 'eu') + '/character/' + member.realm.toLowerCase().replace(/\\s+/g, '-') + '/' + member.name.toLowerCase() + '/avatar.jpg'}" 
               alt="${member.name}"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect fill=%22%23333%22 width=%2260%22 height=%2260%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2224%22%3E${member.name.charAt(0)}%3C/text%3E%3C/svg%3E'" />
          <div class="member-info">
            <h3>${member.name}</h3>
            <p class="realm">${member.realm} (${(member.region || 'eu').toUpperCase()})</p>
          </div>
        </div>

        <div class="member-card-body">
          <div class="member-stat">
            <span class="label">Main Class</span>
            <span class="value" style="color: ${classColor};">${member.mainClass}</span>
          </div>
          <div class="member-stat">
            <span class="label">Role</span>
            <span class="value"><span class="role-icon ${roleIcon}">${member.role}</span></span>
          </div>
          ${member.classes && (member.classes.includes('YES') || member.classes.length > 1) ? `
          <div class="member-stat">
            <span class="label">Alts</span>
            <span class="value" style="font-size: 0.8rem; line-height: 1.4;">
              ${member.classes.filter(c => c !== member.mainClass).join(', ')}
            </span>
          </div>` : ''}
          ${member.ilvl ? `
          <div class="member-stat">
            <span class="label">Item Level</span>
            <span class="value">${member.ilvl}</span>
          </div>` : ''}
          ${member.mplusScore ? `
          <div class="member-stat">
            <span class="label">M+ Score</span>
            <span class="value">${member.mplusScore}</span>
          </div>` : ''}
          ${member.raidProgress ? `
          <div class="member-stat">
            <span class="label">Raid Progress</span>
            <span class="value" style="font-size: 0.8rem;">${member.raidProgress}</span>
          </div>` : ''}
        </div>

        <div class="member-badges">
          <span class="badge rank-${member.rank.toLowerCase()}">${member.rank}</span>
          <span class="badge type-${member.type.toLowerCase()}">${member.type}</span>
        </div>
      </div>
      </a>
    `;
  }

  // 4. Grid'i render et
  function renderGrid(members) {
    if (!members || members.length === 0) {
      grid.innerHTML = '<p style="text-align:center; color:#ddd; padding:40px;">No players found.</p>';
      return;
    }
    grid.innerHTML = members.map(createMemberCard).join('');
  }

  // 5. Filtreleme
 function filterMembers(rank) {
  currentFilter = rank;
  currentPage = 1; // Reset pagination
  renderPaginatedGrid(); // ← Bu satırı değiştir (renderGrid yerine)

  // Aktif butonu güncelle
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === rank);
    btn.setAttribute('aria-selected', btn.dataset.filter === rank);
  });
}


  // 6. Ana yükleme fonksiyonu
  async function init() {
    loading.style.display = 'block';
    grid.style.display = 'none';
    if (error) error.style.display = 'none';

    try {
      // Manuel veri yükle
      let members = await loadManualData();
      
      if (members.length === 0) {
        throw new Error('Roster verisi bulunamadı');
      }

      // API ile zenginleştir (paralel)
      const enriched = await Promise.all(
        members.map(m => enrichWithRaiderIO(m))
      );

      allMembers = enriched;
renderPaginatedGrid(); // ← renderGrid yerine bu

      
      loading.style.display = 'none';
      grid.style.display = 'grid';

      // Fade-in animasyonu
      setTimeout(() => {
        document.querySelectorAll('.member-card').forEach((card, i) => {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, i * 50);
        });
      }, 50);

    } catch (err) {
      console.error('Roster yükleme hatası:', err);
      loading.style.display = 'none';
      if (error) error.style.display = 'block';
    }
  }

 // Role Filter Buttons
document.querySelectorAll('.role-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.role;
    
    if (activeRoles.includes(role)) {
      activeRoles = activeRoles.filter(r => r !== role);
      btn.classList.remove('active');
    } else {
      activeRoles.push(role);
      btn.classList.add('active');
    }
    
    currentPage = 1; // Reset to first page
    renderPaginatedGrid();
  });
});

// Search Input
const searchInput = document.getElementById('memberSearchInput');
const clearBtn = document.getElementById('searchClearBtn');

if (searchInput && clearBtn) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearBtn.style.display = searchQuery ? 'flex' : 'none';
    currentPage = 1; // Reset to first page
    renderPaginatedGrid();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    currentPage = 1;
    renderPaginatedGrid();
  });
}

// Pagination Buttons
const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPaginatedGrid();
      document.getElementById('rosterGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredMembers().length / membersPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderPaginatedGrid();
      document.getElementById('rosterGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// YENİ: Rank Filter Buttons (All Members, Officers, Members, Trials)
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    filterMembers(btn.dataset.filter);
  });
});

// Sayfa yüklendiğinde başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();

/* =========================================================
   Raid Schedule - Discord Event Display

========================================================= */
(() => {
  const card = document.getElementById('raidScheduleCard');
  const loading = document.getElementById('raidScheduleLoading');
  const error = document.getElementById('raidScheduleError');
  
  if (!card || !loading) return;

  // WoW Class ikonları (emoji fallback)
  const CLASS_ICONS = {
    'DK': '💀', 'Death Knight': '💀',
    'DH': '😈', 'Demon Hunter': '😈',
    'Druid': '🐻',
    'Hunter': '🏹',
    'Mage': '🔮',
    'Monk': '🥋',
    'Paladin': '⚔️',
    'Priest': '✨',
    'Rogue': '🗡️',
    'Shaman': '⚡',
    'Warlock': '🔥',
    'Warrior': '🛡️',
    'Evoker': '🐉'
  };

  // Tarih formatla
  function formatEventDate(isoString) {
    const date = new Date(isoString);
    const options = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul' // Server time
    };
    return date.toLocaleDateString('en-US', options);
  }

  // Geri sayım
  function getTimeUntil(isoString) {
    const now = new Date();
    const target = new Date(isoString);
    const diff = target - now;
    
    if (diff < 0) return 'Event started';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'starting soon';
  }

  // Render event card
  function renderEvent(event) {
    if (!event) {
      loading.style.display = 'none';
      error.style.display = 'block';
      return;
    }

    const signupsByClass = {};
    event.signups.forEach(signup => {
      const className = signup.class || signup.role;
      if (!signupsByClass[className]) {
        signupsByClass[className] = [];
      }
      signupsByClass[className].push(signup.user_name);
    });

    const html = `
      <div class="event-header">
        <h4 class="event-title">${event.title || 'Raid Event'}</h4>
        ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
      </div>

      <div class="event-meta">
        <div class="event-meta-item">
          📅 ${formatEventDate(event.start_time)}
        </div>
        <div class="event-meta-item">
          ⏰ ${getTimeUntil(event.start_time)}
        </div>
      </div>

      <div class="role-summary">
        ${Object.keys(event.roles || {}).map(role => {
          const roleData = event.roles[role];
          const filled = roleData.signed >= roleData.max;
          return `
            <div class="role-group ${filled ? 'filled' : 'not-filled'}">
              ${role} ${roleData.signed}/${roleData.max}
            </div>
          `;
        }).join('')}
      </div>

      <div class="signups-grid">
        ${Object.entries(signupsByClass).map(([className, players]) => `
          <div class="class-group">
            <div class="class-group-header">
              <span class="class-icon">${CLASS_ICONS[className] || '⚔️'}</span>
              ${className} (${players.length})
            </div>
            <ul class="player-list">
              ${players.map((name, i) => `
                <li class="player-item">
                  <span class="player-number">${i + 1}</span>
                  <span class="player-name">${name}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>

      ${event.bench || event.tentative ? `
        <div class="other-lists">
          ${event.bench && event.bench.length > 0 ? `
            <div class="other-list">
              <div class="other-list-title">🪑 Bench (${event.bench.length})</div>
              <div class="other-list-players">
                ${event.bench.map(p => p.user_name).join(', ')}
              </div>
            </div>
          ` : ''}
          
          ${event.tentative && event.tentative.length > 0 ? `
            <div class="other-list">
              <div class="other-list-title">⚠️ Tentative (${event.tentative.length})</div>
              <div class="other-list-players">
                ${event.tentative.map(p => p.user_name).join(', ')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    card.innerHTML = html;
    loading.style.display = 'none';
    card.style.display = 'block';
  }

  // API'den event çek
  async function fetchRaidEvent() {
    try {
      const resp = await fetch('/api/raid-events'); // Serverless function
      if (!resp.ok) throw new Error('API error');
      
      const data = await resp.json();
      renderEvent(data.event);
    } catch (err) {
      console.error('Failed to fetch raid event:', err);
      loading.style.display = 'none';
      error.style.display = 'block';
    }
  }

  // Sayfa yüklendiğinde çalıştır
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchRaidEvent);
  } else {
    fetchRaidEvent();
  }

  // Her 5 dakikada bir güncelle (opsiyonel)
  setInterval(fetchRaidEvent, 5 * 60 * 1000);
})();
