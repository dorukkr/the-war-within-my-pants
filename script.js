/**************************************************
 * Çok daha sakin bölüm kaydırma + debounce/cooldown
 **************************************************/
const container = document.getElementById('scroll-container');
const sections  = Array.from(document.querySelectorAll('main > section'));

/* Ayarlar (daha yavaş = süre ve cooldown'ı artır) */
const SCROLL_DURATION_MS   = 1300;  // geçiş süresi (daha sakin)
const STEP_COOLDOWN_MS     = 800;   // bir adım sonrası kilitlenme süresi
const DELTA_ACC_THRESHOLD  = 220;   // tekerlek toplam eşiği (ne kadar çevrilirse adım saysın)
const QUIET_WINDOW_MS      = 250;   // son wheel'den sonra şu kadar sessiz kalmalı

let isAnimating   = false;
let currentIndex  = 0;
let wheelDeltaAcc = 0;
let lastWheelTs   = 0;
let cooldownUntil = 0;

/* En yakın bölüme senkronize */
function syncIndexToScroll() {
  const top = container.scrollTop;
  let nearest = 0, dmin = Infinity;
  sections.forEach((sec, i) => {
    const d = Math.abs(sec.offsetTop - top);
    if (d < dmin) { dmin = d; nearest = i; }
  });
  currentIndex = nearest;
}
syncIndexToScroll();

/* Easing + smooth scroll */
const easeInOutCubic = (t) => (t < 0.5) ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

function smoothScrollTo(targetY, duration = SCROLL_DURATION_MS) {
  const startY = container.scrollTop;
  const diff   = targetY - startY;
  const start  = performance.now();
  isAnimating  = true;

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeInOutCubic(t);
    container.scrollTo(0, startY + diff * eased);
    if (t < 1) requestAnimationFrame(step);
    else {
      isAnimating = false;
      cooldownUntil = performance.now() + STEP_COOLDOWN_MS;
      // küçük yeniden hizalama (drift engeli)
      syncIndexToScroll();
      container.scrollTop = sections[currentIndex].offsetTop;
    }
  }
  requestAnimationFrame(step);
}

/* Wheel/trackpad — eşik + sakinleşme penceresi + cooldown */
container.addEventListener('wheel', (e) => {
  const now = performance.now();

  // Animasyon veya cooldown esnasında kaydırmayı yut
  if (isAnimating || now < cooldownUntil) { e.preventDefault(); return; }

  // Delta biriktir (mutlak)
  wheelDeltaAcc += Math.abs(e.deltaY);
  lastWheelTs = now;
  e.preventDefault(); // tarayıcı default hızlı kaydırmasını engelle

  // Kısa süre sessiz kalınırsa ve eşik aşıldıysa tek adım ilerle
  setTimeout(() => {
    const quietNow = performance.now();
    if (quietNow - lastWheelTs >= QUIET_WINDOW_MS && wheelDeltaAcc >= DELTA_ACC_THRESHOLD && !isAnimating && quietNow >= cooldownUntil) {
      const direction = Math.sign(e.deltaY || 1); // son yön
      syncIndexToScroll();
      currentIndex = Math.min(
        sections.length - 1,
        Math.max(0, currentIndex + (direction > 0 ? 1 : -1))
      );
      const target = sections[currentIndex].offsetTop;
      wheelDeltaAcc = 0; // sıfırla
      smoothScrollTo(target);
    }
  }, QUIET_WINDOW_MS + 10);
}, { passive: false });

/* Klavye: tek tek */
window.addEventListener('keydown', (e) => {
  if (isAnimating || performance.now() < cooldownUntil) return;
  const downKeys = ['PageDown','ArrowDown',' '];
  const upKeys   = ['PageUp','ArrowUp'];

  if (downKeys.includes(e.key)) {
    e.preventDefault();
    syncIndexToScroll();
    currentIndex = Math.min(sections.length - 1, currentIndex + 1);
    smoothScrollTo(sections[currentIndex].offsetTop);
  } else if (upKeys.includes(e.key)) {
    e.preventDefault();
    syncIndexToScroll();
    currentIndex = Math.max(0, currentIndex - 1);
    smoothScrollTo(sections[currentIndex].offsetTop);
  }
});

/* Touch (mobil) — kısa swipe ile tek adım */
let touchStartY = null;
container.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
container.addEventListener('touchend',   (e) => {
  if (touchStartY === null || isAnimating || performance.now() < cooldownUntil) return;
  const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
  const delta = touchStartY - endY;
  touchStartY = null;
  if (Math.abs(delta) < 60) return; // daha yüksek eşik = daha kontrollü
  syncIndexToScroll();
  currentIndex = Math.min(sections.length - 1, Math.max(0, currentIndex + Math.sign(delta)));
  smoothScrollTo(sections[currentIndex].offsetTop);
}, { passive: true });

/* IntersectionObserver — yumuşak görünme + stagger */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { root: container, threshold: 0.28 });

document.querySelectorAll('.fade-in').forEach((el) => revealObserver.observe(el));

/* Stagger: cards / media / grid elemanlarına kademeli gecikme ver */
const groups = document.querySelectorAll('.cards, .media-grid, .grid.three');
groups.forEach(group => {
  Array.from(group.children).forEach((child, idx) => {
    if (!child.classList.contains('fade-in')) child.classList.add('fade-in');
    const staggerClass = `stagger-${Math.min(4, (idx % 4) + 1)}`;
    child.classList.add(staggerClass);
    revealObserver.observe(child);
  });
});

/* Hafif parallax (çok nazik) */
function parallaxUpdate() {
  const t = container.scrollTop;
  sections.forEach((sec) => {
    if (!sec.classList.contains('parallax-bg')) return;
    const offset = Math.round((sec.offsetTop - t) * 0.25); // daha düşük oran = daha sakin
    sec.style.backgroundPosition = `center ${offset}px`;
  });
  requestAnimationFrame(parallaxUpdate);
}
requestAnimationFrame(parallaxUpdate);

/* Footer yılı */
document.getElementById('year').textContent = new Date().getFullYear();
