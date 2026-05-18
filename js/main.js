/* ============================================================
   GN7 — Main JS
   Reveals · Nav state · Hero parallax · Magnetic buttons
   3D tilt · Counter · Active section
   ============================================================ */

(() => {
  'use strict';

  // const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduceMotion = false; // forçado false — algumas máquinas estavam derrubando todas as animações
  console.log('[GN7] main.js v2 carregado — animações ativas');

  /* ---------- Scroll reveals (IntersectionObserver) ---------- */
  // Triggers data-reveal elements as they enter viewport.
  // rootMargin estendido pra baixo (+120px) — gatilha ANTES do elemento entrar
  // de fato, evita reveals "atrasados" ou que não disparam perto da borda inferior.
  const revealEls = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -6% 0px'
    });

    revealEls.forEach((el) => io.observe(el));

    // Failsafe inteligente — após 3.5s, só força .in em elementos que JÁ ESTÃO
    // visíveis no viewport (cobre IO travado pra esses casos).
    // Elementos abaixo da fold continuam esperando o observer normal pra animar.
    setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) el.classList.add('in');
      });
    }, 3500);
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Nav scroll state + hero parallax ---------- */
  // Single scroll handler driving both nav shrink and hero fade-out
  const nav = document.getElementById('nav');
  const heroInner = document.querySelector('.hero-inner');
  const scrollThreshold = 24;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;

    // Nav state
    if (y > scrollThreshold) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');

    // Hero parallax — sobe e some conforme rola
    if (heroInner && !reduceMotion && y < window.innerHeight) {
      const offset = y * 0.25; // movimento mais sutil
      // fade muito mais suave — CTAs continuam legíveis durante o scroll do hero
      const fade = Math.max(0.55, 1 - (y / (window.innerHeight * 1.6)));
      heroInner.style.transform = `translate3d(0, ${offset}px, 0)`;
      heroInner.style.opacity = fade;
    } else if (heroInner) {
      heroInner.style.transform = '';
      heroInner.style.opacity = '';
    }

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  onScroll();

  /* ---------- Magnetic buttons ---------- */
  // Botões "puxam" levemente para o cursor — força reduzida + transition CSS suaviza
  if (!reduceMotion) {
    const magneticEls = document.querySelectorAll('.cta-primary, .cta-nav');
    const STRENGTH = 0.15;

    magneticEls.forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.translate = `${x * STRENGTH}px ${y * STRENGTH}px`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.translate = '';
      });
    });
  }

  /* ---------- 3D tilt nos cards de serviço ---------- */
  // Perspective rotation + parallax dos filhos (que têm translateZ no CSS)
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const tiltCards = document.querySelectorAll('.servico');
    const MAX_TILT = 12;        // mais dramático que antes (era 6)
    const PERSPECTIVE = 700;    // perspectiva mais próxima = 3D mais visível

    tiltCards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transition = 'transform .12s ease-out';
        card.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${px * MAX_TILT}deg) rotateX(${-py * MAX_TILT}deg) translateZ(20px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform .6s var(--ease-premium, cubic-bezier(0.16, 1, 0.3, 1))';
        card.style.transform = '';
      });
    });
  }

  /* ---------- Counter animation nas stats ---------- */
  // Anima números (ex: "100%") de 0 até o valor real ao entrar no viewport
  const counters = document.querySelectorAll('.stat-num');

  const animateCounter = (el) => {
    const text = el.textContent.trim();
    const match = text.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
    if (!match) return; // texto puro ("dias") — não anima

    const targetNum = parseFloat(match[1].replace(',', '.'));
    const suffix = match[2];
    if (targetNum === 0) { el.textContent = '0' + suffix; return; }

    const duration = 1600;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(targetNum * eased);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = (Number.isInteger(targetNum) ? targetNum : targetNum.toFixed(1)) + suffix;
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window && counters.length) {
    const counterIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach((c) => counterIo.observe(c));
  }

  /* ---------- Active section detection ---------- */
  // Marca o link da nav cuja seção está visível no viewport
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    const sectionIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            link.classList.toggle('active', href === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach((s) => sectionIo.observe(s));
  }

  /* ---------- FAQ: abertura/fechamento animado controlado por JS ---------- */
  // Browsers nativos não animam <details> via CSS. Interceptamos o clique,
  // medimos scrollHeight e animamos height inline. Cleanup remove inline depois.
  const faqItems = document.querySelectorAll('.faq-item');
  const OPEN_MS = 500;
  const CLOSE_MS = 400;
  const FAQ_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

  const openFaq = (item, content, done) => {
    item.setAttribute('open', '');
    const target = content.scrollHeight;
    content.style.height = '0px';
    content.style.transition = `height ${OPEN_MS}ms ${FAQ_EASING}`;
    void content.offsetHeight; // força reflow pra browser registrar height: 0
    content.style.height = target + 'px';
    setTimeout(() => {
      content.style.height = '';
      content.style.transition = '';
      if (done) done();
    }, OPEN_MS + 20);
  };

  const closeFaq = (item, content, done) => {
    const current = content.scrollHeight;
    content.style.height = current + 'px';
    content.style.transition = `height ${CLOSE_MS}ms ${FAQ_EASING}`;
    void content.offsetHeight;
    content.style.height = '0px';
    setTimeout(() => {
      item.removeAttribute('open');
      content.style.height = '';
      content.style.transition = '';
      if (done) done();
    }, CLOSE_MS + 20);
  };

  faqItems.forEach((item) => {
    const summary = item.querySelector('summary');
    const content = item.querySelector('.faq-a');
    if (!summary || !content) return;
    let animating = false;

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (animating) return;
      animating = true;
      const done = () => { animating = false; };

      if (item.hasAttribute('open')) {
        closeFaq(item, content, done);
      } else {
        // Fecha qualquer outro item aberto (accordion behavior)
        faqItems.forEach((other) => {
          if (other !== item && other.hasAttribute('open')) {
            const oc = other.querySelector('.faq-a');
            if (oc) closeFaq(other, oc);
          }
        });
        openFaq(item, content, done);
      }
    });
  });

  /* ---------- Robot video loop forçado ---------- */
  const robotVideo = document.querySelector('.hero-robot');
  if (robotVideo) {
    robotVideo.loop = true;
    robotVideo.addEventListener('ended', () => {
      robotVideo.currentTime = 0;
      robotVideo.play();
    });
  }

  /* ---------- Smooth scroll para âncoras ---------- */
  const smoothScroll = (targetY, duration) => {
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    const startTime = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, startY + dist * ease(progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const navH = document.getElementById('nav')?.offsetHeight ?? 80;
      const targetY = target.getBoundingClientRect().top + window.scrollY - navH;
      smoothScroll(targetY, 900);
    });
  });

  /* ---------- Console signature ---------- */
  console.log(
    '%cGN7 — Automação com IA',
    'font: 600 14px serif; color: #C2A46F; padding: 4px 0;'
  );
})();
