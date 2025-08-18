// Fade-in animasyonu normal scroll ile
const faders = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.2 });

faders.forEach(el => observer.observe(el));

// Parallax efekt (opsiyonel, Apple hissi için)
window.addEventListener('scroll', () => {
  document.querySelectorAll('.parallax-bg').forEach(sec => {
    const speed = 0.3; // daha küçük = daha yavaş
    const y = window.scrollY * speed;
    sec.style.backgroundPosition = `center calc(50% + ${y}px)`;
  });
});

// Footer yılı
document.getElementById('year').textContent = new Date().getFullYear();
