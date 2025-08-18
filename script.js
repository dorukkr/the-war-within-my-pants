// IntersectionObserver: reveal on scroll
const faders = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('visible');
    obs.unobserve(e.target);
  });
}, { threshold: 0.25 });

faders.forEach((el) => observer.observe(el));

// Current year in footer
document.getElementById('year').textContent = new Date().getFullYear();
