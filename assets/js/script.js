
function applyTextStyles(s){
  const styles = s.textStyles || {};
  Object.entries(styles).forEach(([field, cfg]) => {
    document.querySelectorAll(`[data-builder-field="${field}"]`).forEach(el => {
      if(cfg.scale) el.style.fontSize = `calc(1em * ${Number(cfg.scale) / 100})`;
    });
  });
}

const textIds = [
  'brandName','heroBadge','heroLine1','heroLine2','heroLine3','heroText',
  'aboutKicker','aboutTitle','aboutText','servicesKicker','servicesTitle','servicesText','bannerText',
  'resultsKicker','resultsTitle','resultsText','pricingKicker','pricingTitle','pricingText',
  'testimonialKicker','testimonialTitle','testimonialText','testimonialName',
  'faqKicker','faqTitle','finalKicker','finalTitle','finalText','footerText'
];

function safeArray(x){ return Array.isArray(x) ? x : []; }

function applyLayout(s){
  const l = s.layout || {};
  const set = (name, value, suffix='') => {
    if(value !== undefined && value !== null && value !== '') document.documentElement.style.setProperty(name, `${value}${suffix}`);
  };
  set('--site-max-width', l.maxWidth, 'px');
  set('--section-padding', l.sectionPadding, 'px');
  set('--mobile-section-padding', l.mobileSectionPadding, 'px');
  set('--hero-height', l.heroHeight, 'vh');
  set('--hero-overlay-strength', (l.heroOverlayStrength ?? 82) / 100);
  set('--hero-focus-x', l.heroImageFocusX, '%');
  set('--hero-focus-y', l.heroImageFocusY, '%');
  set('--about-image-width', l.aboutImageWidth, '%');
  set('--about-text-width', l.aboutTextWidth, '%');
  set('--about-gap', l.aboutGap, 'px');
  set('--about-image-height', l.aboutImageHeight, 'px');
  set('--services-columns', l.servicesColumns);
  set('--services-card-padding', l.servicesCardPadding, 'px');
  set('--services-card-radius', l.servicesCardRadius, 'px');
  set('--results-columns', l.resultsColumns);
  set('--results-card-height', l.resultsCardHeight, 'px');
  set('--pricing-columns', l.pricingColumns);
  set('--pricing-card-padding', l.pricingCardPadding, 'px');
  set('--pricing-card-radius', l.pricingCardRadius, 'px');
  set('--button-radius', l.buttonRadius, 'px');
  set('--button-height', l.buttonHeight, 'px');

  document.documentElement.style.setProperty('--hero-text-align', l.heroTextAlign || 'left');
  document.documentElement.style.setProperty('--hero-button-align', l.heroTextAlign === 'center' ? 'center' : l.heroTextAlign === 'right' ? 'flex-end' : 'flex-start');

  const about = document.getElementById('aboutLayout');
  if(about){
    if(l.aboutImagePosition === 'right') about.classList.add('about-reverse');
    else about.classList.remove('about-reverse');
  }
}

function applySectionOrder(s){
  const main = document.getElementById('pageSections');
  if(!main) return;
  const order = (s._builder && Array.isArray(s._builder.sectionOrder)) ? s._builder.sectionOrder : ['about','services','results','pricing','testimonial','faq','contact'];
  const hiddenSections = (s._builder && Array.isArray(s._builder.hiddenSections)) ? s._builder.hiddenSections : [];
  order.forEach(key => {
    const el = main.querySelector(`[data-section="${key}"]`);
    if(el){ el.style.display = hiddenSections.includes(key) ? 'none' : ''; main.appendChild(el); }
  });
}

async function loadSite(){
  const res = await fetch('/content/site.json?cache=' + Date.now());
  const s = await res.json();

  document.title = s.seoTitle || s.brandName || 'Fiaz Ali Coaching';
  const meta = document.querySelector('meta[name="description"]');
  if(meta) meta.setAttribute('content', s.seoDescription || '');

  document.documentElement.style.setProperty('--bg', s.backgroundColor || '#030303');
  document.documentElement.style.setProperty('--card', s.cardColor || '#111');
  document.documentElement.style.setProperty('--main', s.mainTextColor || '#fff');
  document.documentElement.style.setProperty('--body', s.bodyTextColor || '#d0d0d0');
  document.documentElement.style.setProperty('--gold', s.goldColor || '#f4d77e');
  document.documentElement.style.setProperty('--btntext', s.buttonTextColor || '#fff');
  document.documentElement.style.setProperty('--hero', `url("${s.heroImage || ''}")`);
  document.documentElement.style.setProperty('--about', `url("${s.aboutImage || ''}")`);
  const ic = s.imageControls || {};
  const heroIc = ic.heroImage || {};
  const aboutIc = ic.aboutImage || {};
  document.documentElement.style.setProperty('--hero-img-x', (heroIc.x ?? s.layout?.heroImageFocusX ?? 72) + '%');
  document.documentElement.style.setProperty('--hero-img-y', (heroIc.y ?? s.layout?.heroImageFocusY ?? 50) + '%');
  document.documentElement.style.setProperty('--hero-img-zoom', (heroIc.zoom ?? 100) + '%');
  document.documentElement.style.setProperty('--about-img-x', (aboutIc.x ?? 50) + '%');
  document.documentElement.style.setProperty('--about-img-y', (aboutIc.y ?? 50) + '%');
  document.documentElement.style.setProperty('--about-img-zoom', (aboutIc.zoom ?? 100) + '%');

  applyLayout(s);
  applySectionOrder(s);
  applyTextStyles(s);

  const logo = document.getElementById('logo');
  if(logo) logo.src = s.logo || '';

  const nav = document.getElementById('navLinks');
  if(nav) nav.innerHTML = safeArray(s.navLinks).map(x => `<a href="${x.url || '#'}">${x.label || ''}</a>`).join('');

  textIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.textContent = s[id] || '';
      el.setAttribute('data-builder-field', id);
    }
  });

  const primary = document.getElementById('primaryBtn');
  if(primary){ primary.textContent = s.primaryButtonText || ''; primary.href = s.primaryButtonLink || '#contact'; primary.setAttribute('data-builder-field','primaryButtonText'); }
  const secondary = document.getElementById('secondaryBtn');
  if(secondary){ secondary.textContent = s.secondaryButtonText || ''; secondary.href = s.secondaryButtonLink || '#services'; secondary.setAttribute('data-builder-field','secondaryButtonText'); }
  const primary2 = document.getElementById('primaryBtn2');
  if(primary2){ primary2.textContent = s.primaryButtonText || 'Book Free Consultation'; primary2.href = s.primaryButtonLink || '#contact'; primary2.setAttribute('data-builder-field','primaryButtonText'); }

  const stats = document.getElementById('stats');
  if(stats) stats.innerHTML = safeArray(s.stats).map(x => `<div class="stat"><strong class="metal">${x.number || ''}</strong><span>${x.label || ''}</span></div>`).join('');

  const aboutPoints = document.getElementById('aboutPoints');
  if(aboutPoints) aboutPoints.innerHTML = safeArray(s.aboutPoints).map(p => `<div class="list-item"><span class="dot"></span><p>${p}</p></div>`).join('');

  const services = document.getElementById('servicesCards');
  if(services) services.innerHTML = safeArray(s.services).map(x => `<div class="card"><small>${x.small || ''}</small><h3>${x.title || ''}</h3><p>${x.text || ''}</p></div>`).join('');

  const results = document.getElementById('resultsGrid');
  if(results) results.innerHTML = safeArray(s.results).map((x,i) => {
    const ric = (s.imageControls && s.imageControls.results && s.imageControls.results[String(i)]) || {};
    const pos = `${ric.x ?? 50}% ${ric.y ?? 50}%`;
    const size = `${ric.zoom ?? 100}%`;
    return `<div class="result" data-image-field="results.${i}.image" style="background-image:url('${x.image || ''}');background-position:${pos};background-size:${size} auto;background-repeat:no-repeat"><span>${x.label || ''}</span></div>`;
  }).join('');

  const packages = document.getElementById('packages');
  if(packages) packages.innerHTML = safeArray(s.packages).map(x => `<div class="price-card ${x.featured ? 'featured' : ''}"><h3>${x.name || ''}</h3><div class="price metal">${x.price || ''}</div><ul>${safeArray(x.items).map(i => `<li>${i}</li>`).join('')}</ul><a class="btn ${x.featured ? 'btn-primary' : 'btn-secondary'}" href="${s.primaryButtonLink || '#contact'}">${x.button || 'Enquire'}</a></div>`).join('');

  const faqs = document.getElementById('faqs');
  if(faqs) faqs.innerHTML = safeArray(s.faqs).map((x,i) => `<details ${i===0?'open':''}><summary>${x.question || ''}</summary><p>${x.answer || ''}</p></details>`).join('');

  const email = document.getElementById('email');
  if(email){ email.href = `mailto:${s.email || ''}`; email.textContent = s.emailButtonText || 'Email Me'; email.setAttribute('data-builder-field','emailButtonText'); }

  ['instagram','tiktok','youtube'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.href = s[id] || '#';
  });
}
loadSite();
