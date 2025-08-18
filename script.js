// Fade-in with IntersectionObserver
const faders = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.2 });
faders.forEach(el => observer.observe(el));

// Scroll progress animations (Apple-like)
window.addEventListener('scroll', () => {
  document.querySelectorAll('.progress-animate').forEach(el => {
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const start = windowHeight * 0.9; // başlama noktası
    const end = windowHeight * 0.1;   // bitiş noktası
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));

    // scale + opacity based on progress
    const scale = 0.85 + progress * 0.15;
    const opacity = 0.3 + progress * 0.7;
    el.style.transform = `scale(${scale}) translateY(${40 * (1-progress)}px)`;
    el.style.opacity = opacity;
  });

  // Parallax effect
  document.querySelectorAll('.parallax-bg').forEach(sec => {
    const speed = 0.2;
    const offset = window.scrollY * speed;
    sec.style.backgroundPosition = `center calc(50% + ${offset}px)`;
  });
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
