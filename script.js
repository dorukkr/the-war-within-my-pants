/***********************
 * Apple-benzeri yavaş bölüm kaydırma + kademeli animasyon + hafif parallax
 ***********************/
const container = document.getElementById('scroll-container');
const sections  = Array.from(document.querySelectorAll('main > section'));

let isAnimating = false;   // aktif yumuşak kaydırma
let currentIndex = 0;      // aktif bölüm index

/***** 1) Başlangıçta en yakın bölüme senkronize et *****/
const syncIndexToScroll = () => {
  const top = container.scrollTop;
  let nearest = 0, minDist = Infinity;
  sections.forEach((sec, i) => {
    const d = Math.abs(sec.offsetTop - top);
    if (d < minDist) { minDist = d; nearest = i; }
  });
  currentIndex = nearest;
};
syncIndexToScroll();

/***** 2) Easing ve smooth scroll helper *****/
const easeInOutCubic = (t) => (t < 0.5) ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

function smoothScrollTo(targetY, duration = 950) { // 950ms: daha sakin
  const startY = container.scrollTop;
  const diff   = targetY - startY;
  const start  = performance.now();
  isAnimating  = true;

  function step(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const eased = easeInOutCubic(t);
    container.scrollTo(0, startY + diff * eased);
    if (t < 1) requestAnimationFrame(step);
    else       isAnimating = false;
  }
  requestAnimationFrame(step);
}

/***** 3) Fare tekerleği/trackpad - tek tek bölümler arası akış *****/
container.addEventListener('wheel', (e) => {
  if (isAnimating) { e.preventDefault(); return; }
  const direction = Math.sign(e.deltaY); // +1: aşağı, -1: yukarı
  if (direction === 0) return;

  e.preventDefault(); // default hızlı kaydırmayı kapat
  syncIndexToScroll();

  currentIndex = Math.min(
    sections.length - 1,
    Math.max(0, currentIndex + direction)
  );
  const target = sections[currentIndex].offsetTop;
  smoothScrollTo(target, 950);
}, { passive: false });

/***** 4) Klavye desteği (PgDn/Up, Arrow, Space) *****/
window.addEventListener('keydown', (e) => {
  if (isAnimating) return;
  const keysDown = ['PageDown','ArrowDown',' '];
  const keysUp   = ['PageUp','ArrowUp'];

  if (keysDown.includes(e.key)) {
    e.preventDefault();
    currentIndex = Math.min(sections.length - 1, currentIndex + 1);
    smoothScrollTo(sections[currentIndex].offsetTop, 900);
  } else if (keysUp.includes(e.key)) {
    e.preventDefault();
    currentIndex = Math.max(0, currentIndex - 1);
    smoothScrollTo(sections[currentIndex].offsetTop, 900);
  }
});

/***** 5) Touch (mobil) — kısa swipe ile bölüm değiştir *****/
let touchStartY = null;
container.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

container.addEventListener('touchmove', (e) => {
  // default davranış kalsın; yalnızca bitişte snap uygulayacağız
}, { passive: true });

container.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
  const delta = touchStartY - endY;
  touchStartY = null;

  // eşik: 40px
  if (Math.abs(delta) < 40 || isAnimating) return;

  syncIndexToScroll();
  currentIndex = Math.min(
    sections.length - 1,
    Math.max(0, currentIndex + Math.sign(delta))
  );
  smoothScrollTo(sections[currentIndex].offsetTop, 900);
});

/***** 6) IntersectionObserver — görünümde kademeli açılma *****/
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { root: container, threshold: 0.25 });

// Tüm fade-in öğelerini izle
document.querySelectorAll('.fade-in').forEach((el) => revealObserver.observe(el));

/***** 7) Stagger otomatik atama (cards, media, grid) *****/
const groups = document.querySelectorAll('.cards, .media-grid, .grid.three');
groups.forEach(group => {
  Array.from(group.children).forEach((child, idx) => {
    if (!child.classList.contains('fade-in')) child.classList.add('fade-in');
    const staggerClass = `stagger-${Math.min(4, (idx % 4) + 1)}`; // 1..4
    child.classList.add(staggerClass);
    revealObserver.observe(child);
  });
});

/***** 8) Hafif Parallax — arka planı yumuşak oynat *****/
function parallaxUpdate() {
  const t = container.scrollTop;
  sections.forEach((sec) => {
    if (!sec.classList.contains('parallax-bg')) return;
    // Yumuşak çok hafif kaydırma: 0.3 oran
    const offset = Math.round((sec.offsetTop - t) * 0.3);
    sec.style.backgroundPosition = `center ${offset}px`;
  });
  requestAnimationFrame(parallaxUpdate);
}
requestAnimationFrame(parallaxUpdate);

/***** 9) Footer yıl *****/
document.getElementById('year').textContent = new Date().getFullYear();
