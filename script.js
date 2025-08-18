/* ===== Fade-in with IntersectionObserver ===== */
const faders = document.querySelectorAll('.fade-in');
const io = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.2 });
faders.forEach(el => io.observe(el));

/* ===== Scroll progress animation (scale/opacity) ===== */
window.addEventListener('scroll', () => {
  document.querySelectorAll('.progress-animate').forEach(el => {
    const r = el.getBoundingClientRect();
    const h = window.innerHeight;
    const start = h * 0.9;
    const end   = h * 0.1;
    const p = Math.min(1, Math.max(0, (start - r.top) / (start - end))); // 0..1
    const scale = 0.85 + p * 0.15;
    const opacity = 0.3 + p * 0.7;
    el.style.transform = `scale(${scale}) translateY(${40 * (1-p)}px)`;
    el.style.opacity = opacity;
  });

  // subtle parallax for bg sections
  document.querySelectorAll('.parallax-bg').forEach(sec => {
    const speed = 0.2;
    const off = window.scrollY * speed;
    sec.style.backgroundPosition = `center calc(50% + ${off}px)`;
  });
}, { passive:true });

/* ===== HERO: animated starfield canvas ===== */
(() => {
  const canvas = document.getElementById('bg-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize(){
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  function ensureCSSSize(){
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  ensureCSSSize(); resize();
  window.addEventListener('resize', () => { ensureCSSSize(); resize(); });

  const COUNT = 140;
  const stars = Array.from({length: COUNT}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.6 + 0.4,
    a: Math.random() * 0.6 + 0.2,
    vx: (Math.random() - .5) * .06,
    vy: (Math.random() - .5) * .06,
    ph: Math.random() * Math.PI*2
  }));

  function frame(t){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const s of stars){
      const tw = Math.sin(t/900 + s.ph) * 0.25;
      ctx.globalAlpha = Math.max(0, Math.min(1, s.a + tw));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
      s.x += s.vx; s.y += s.vy;
      if(s.x<-5) s.x=canvas.width+5; if(s.x>canvas.width+5) s.x=-5;
      if(s.y<-5) s.y=canvas.height+5; if(s.y>canvas.height+5) s.y=-5;
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ===== HERO: mouse tilt / parallax on content ===== */
(() => {
  const hero = document.getElementById('hero');
  const logo = document.getElementById('guildLogo');
  const cta  = document.getElementById('ctaBtn');
  const content = document.getElementById('heroContent') || document.querySelector('.hero-content');
  if(!hero || !content) return;

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const cx = r.left + r.width/2; const cy = r.top + r.height/2;
    const dx = (e.clientX - cx) / r.width;  // -0.5..0.5
    const dy = (e.clientY - cy) / r.height;

    const rotX = dy * 6;
    const rotY = -dx * 6;
    content.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;

    if(logo) logo.style.transform = `translate(${dx*10}px, ${dy*10}px) scale(0.98)`;
    if(cta)  cta.style.transform  = `translate(${dx*6}px, ${dy*6}px)`;
  });

  hero.addEventListener('mouseleave', () => {
    content.style.transform = `rotateX(0deg) rotateY(0deg)`;
    if(logo) logo.style.transform = `translate(0,0) scale(0.98)`;
    if(cta)  cta.style.transform  = `translate(0,0)`;
  });
})();

/* ===== Footer year ===== */
document.getElementById('year').textContent = new Date().getFullYear();
