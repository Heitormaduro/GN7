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

    // Hero parallax desativado — texto fixo ao rolar
    if (false) {
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

  /* ---------- Processo cards — entrada sequencial + tilt ---------- */
  const processoGrid = document.querySelector('.processo-grid');
  if ('IntersectionObserver' in window && processoGrid) {
    const passos     = processoGrid.querySelectorAll('.passo');
    const connectors = processoGrid.querySelectorAll('.passo-connector');
    let fired = false;

    const processoIo = new IntersectionObserver((entries) => {
      if (fired) return;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        fired = true;
        processoIo.disconnect();

        passos.forEach((passo, i) => {
          setTimeout(() => {
            passo.classList.add('in');
            setTimeout(() => passo.classList.add('glow'), 900);
            if (connectors[i]) setTimeout(() => connectors[i].classList.add('in'), 280);
          }, i * 380);
        });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    processoIo.observe(processoGrid);

    // Tilt 3D nos cards do processo (igual aos de serviço, mas mais suave)
    if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
      passos.forEach((card) => {
        card.addEventListener('mousemove', (e) => {
          if (!card.classList.contains('in')) return;
          const rect = card.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width  - 0.5;
          const py = (e.clientY - rect.top)  / rect.height - 0.5;
          card.style.transition = 'transform .12s ease-out';
          card.style.transform  = `perspective(800px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateZ(16px)`;
        });
        card.addEventListener('mouseleave', () => {
          card.style.transition = 'transform .6s var(--ease-premium, cubic-bezier(0.16,1,0.3,1))';
          card.style.transform  = '';
        });
      });
    }
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
    const ease = (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
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
      smoothScroll(targetY, 1400);
    });
  });

  /* ---------- Service modals ---------- */
  const WA = 'https://wa.me/5533988903303?text=Ol%C3%A1%2C%20quero%20faturar%20mais%20com%20o%20digital%21';

  const GN7_SERVICES = [
    {
      num: '01', title: 'Sites com IA',
      tagline: 'Presença digital que converte — entregue em dias.',
      desc: 'Criamos o site da sua empresa do zero usando IA para acelerar, mas com identidade 100% única do seu negócio. SEO, mobile, formulário e analytics já inclusos. Você aprova cada detalhe antes de ir ao ar.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18"/><path d="M7 13h4"/></svg>`,
      steps: [
        { n:'01', label:'Briefing',          desc:'30 min de conversa. Entendemos seu público, posicionamento e o que você quer transmitir.' },
        { n:'02', label:'Design premium',     desc:'Layout aprovado por você antes de virar código — no estilo da sua marca.' },
        { n:'03', label:'Desenvolvimento',    desc:'Site construído, testado em mobile e desktop, indexado corretamente no Google.' },
        { n:'04', label:'Entrega + ajustes',  desc:'No ar em até 5 dias úteis. Rodada de ajustes incluída sem custo extra.' },
      ],
      chips: ['SEO técnico','Mobile-first','Google Analytics','Formulário integrado','Domínio & hospedagem'],
      cta:  'Quero meu site',
    },
    {
      num: '02', title: 'Criativos automáticos',
      tagline: 'Conteúdo que soa como você — sem você fazer nada.',
      desc: 'Posts para Instagram e Facebook gerados com IA treinada na voz e identidade do seu negócio. Semana a semana, sem depender de agência ou freelancer.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="M4 17l4-4 4 4 4-6 4 4"/></svg>`,
      steps: [
        { n:'01', label:'Definição de voz',   desc:'A gente aprende o tom da sua marca: formal, descontraído, técnico ou próximo.' },
        { n:'02', label:'Templates da marca',  desc:'Layouts no Canva/IA com suas cores, logo e tipografia — identidade consistente.' },
        { n:'03', label:'Geração semanal',     desc:'7 a 12 posts por semana prontos para publicar, com legendas e hashtags.' },
        { n:'04', label:'Aprovação fácil',     desc:'Você aprova ou ajusta direto pelo WhatsApp — sem reuniões, sem demora.' },
      ],
      chips: ['Instagram','Facebook','Stories','Legendas + hashtags','Identidade visual'],
      cta:  'Quero meus criativos',
    },
    {
      num: '03', title: 'Análise de KPIs',
      tagline: 'Saiba o que está funcionando antes de gastar mais.',
      desc: 'Conectamos sua conta no Meta Ads e entregamos relatórios automáticos direto no seu WhatsApp. Você lê em 2 minutos e já sabe exatamente o que otimizar.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>`,
      steps: [
        { n:'01', label:'Integração',         desc:'Conectamos com o Meta Ads em menos de 15 minutos — sem complicação técnica.' },
        { n:'02', label:'Dashboard',           desc:'Painel visual com as métricas que realmente importam para o seu objetivo.' },
        { n:'03', label:'Alertas automáticos', desc:'Notificação no WhatsApp quando um anúncio performa bem ou mal — em tempo real.' },
        { n:'04', label:'Relatório mensal',    desc:'Resumo completo com insights e sugestões de otimização para o próximo mês.' },
      ],
      chips: ['Meta Ads','CPC & CTR','ROAS','Custo por lead','Alertas WhatsApp'],
      cta:  'Quero minha análise',
    },
    {
      num: '04', title: 'Automação personalizada',
      tagline: 'Pare de fazer na mão o que a IA pode fazer por você.',
      desc: 'Mapeamos os processos repetitivos do seu negócio e automatizamos usando as melhores ferramentas. Você libera horas toda semana sem precisar mudar como trabalha.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>`,
      steps: [
        { n:'01', label:'Mapeamento',          desc:'Identificamos o processo que mais consome tempo e tem mais a ganhar com automação.' },
        { n:'02', label:'Proposta',             desc:'Mostramos exatamente como vai funcionar antes de escrever uma linha de código.' },
        { n:'03', label:'Implementação',        desc:'Construímos o fluxo usando n8n, Make ou a ferramenta ideal para o seu caso.' },
        { n:'04', label:'Entrega + treinamento',desc:'Você recebe funcionando e entende o que acontece — sem caixa-preta.' },
      ],
      chips: ['n8n','Make / Zapier','WhatsApp API','Planilhas','CRM integrado'],
      cta:  'Quero minha automação',
    },
  ];

  const overlay   = document.getElementById('modalOverlay');
  const card      = document.getElementById('modalCard');
  const btnClose  = document.getElementById('modalClose');

  function openModal(idx) {
    const s = GN7_SERVICES[idx];
    if (!s) return;

    document.getElementById('modalIcon').innerHTML    = s.icon;
    document.getElementById('modalNum').textContent   = s.num;
    document.getElementById('modalTitle').textContent = s.title;
    document.getElementById('modalTagline').textContent = s.tagline;
    document.getElementById('modalDesc').textContent  = s.desc;

    document.getElementById('modalSteps').innerHTML = s.steps.map(st => `
      <div class="modal-step">
        <div class="modal-step-num">${st.n}</div>
        <div class="modal-step-label">${st.label}</div>
        <div class="modal-step-desc">${st.desc}</div>
      </div>`).join('');

    document.getElementById('modalChips').innerHTML = s.chips.map(c =>
      `<span class="modal-chip">${c}</span>`).join('');

    const ctaEl = document.getElementById('modalCta');
    ctaEl.href = WA;
    document.getElementById('modalCtaText').textContent = s.cta;

    card.scrollTop = 0;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.remove('open', 'closing');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }, 320);
  }

  document.querySelectorAll('.servico[data-service]').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.service)));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(Number(el.dataset.service)); } });
  });

  overlay.addEventListener('click', e => { if (e.target === overlay || e.target === overlay.querySelector('.modal-scene')) closeModal(); });
  btnClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

  /* ---------- Console signature ---------- */
  console.log(
    '%cGN7 — Automação com IA',
    'font: 600 14px serif; color: #C2A46F; padding: 4px 0;'
  );
})();
