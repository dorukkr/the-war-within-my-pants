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
