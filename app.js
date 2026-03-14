(function () {
  'use strict';

  // ── State ──
  const S = {
    credits: 3,
    style: 'fine-line',
    design: null,
    photo: null,
    tattoo: { x: 300, y: 350, size: 120, rot: 0, alpha: 0.85 },
    drag: false,
    off: { x: 0, y: 0 }
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ── Style pills ──
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    $$('.pill').forEach(b => b.classList.remove('active'));
    p.classList.add('active');
    S.style = p.dataset.style;
  }));

  // ── Gallery cards → select style ──
  $$('.gallery-card').forEach(c => c.addEventListener('click', () => {
    if (!c.dataset.style) return;
    S.style = c.dataset.style;
    $$('.pill').forEach(p => p.classList.toggle('active', p.dataset.style === S.style));
    $('#generate').scrollIntoView({ behavior: 'smooth' });
  }));

  // ── Generate ──
  $('#generateBtn').addEventListener('click', generate);

  function generate() {
    const prompt = $('#prompt').value.trim();
    if (!prompt) {
      $('#prompt').style.borderColor = '#ef4444';
      setTimeout(() => $('#prompt').style.borderColor = '', 1500);
      return;
    }
    if (S.credits <= 0) { paywall(); return; }

    const btn = $('#generateBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Generating...';

    // TODO: replace with Replicate API call via Cloud Function
    setTimeout(() => {
      S.credits--;
      $('#creditsNote').textContent = S.credits > 0
        ? S.credits + ' free generation' + (S.credits > 1 ? 's' : '') + ' remaining'
        : 'Free generations used — upgrade for more';
      renderResults(prompt);
      btn.disabled = false;
      btn.textContent = 'Generate Designs';
    }, 2000);
  }

  // ── Render result cards ──
  function renderResults(prompt) {
    const el = $('#results');
    el.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'result-card';
      const cvs = drawTattoo(prompt, S.style, i);
      card.appendChild(cvs);
      const wm = document.createElement('div');
      wm.className = 'wm';
      wm.textContent = 'TRYINK';
      card.appendChild(wm);
      card.addEventListener('click', () => {
        $$('.result-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        S.design = cvs;
        drawPreview();
        $('#dlFree').disabled = false;
        $('#dlHD').disabled = false;
      });
      el.appendChild(card);
    }
  }

  // ── Demo tattoo drawing (placeholder until AI connected) ──
  function drawTattoo(prompt, style, v) {
    const sz = 400, c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const x = c.getContext('2d');
    x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, sz, sz);
    const seed = hash(prompt + v), r = rng(seed);
    x.strokeStyle = styleColor(style);
    x.fillStyle = x.strokeStyle;
    x.lineWidth = style === 'fine-line' || style === 'minimalist' ? 1.5 : 2.5;
    x.lineCap = 'round';

    if (style === 'tribal' || style === 'blackwork') drawTribal(x, sz, r);
    else if (style === 'japanese') drawWave(x, sz, r);
    else if (style === 'dotwork') drawDots(x, sz, r);
    else if (style === 'watercolor') drawWater(x, sz, r);
    else drawLine(x, sz, r);

    x.fillStyle = 'rgba(255,255,255,.5)';
    x.font = '13px Inter,sans-serif'; x.textAlign = 'center';
    x.fillText(prompt.length > 30 ? prompt.slice(0, 30) + '...' : prompt, sz / 2, sz - 16);
    x.fillStyle = 'rgba(168,85,247,.7)'; x.font = '11px Inter,sans-serif';
    x.fillText(style.toUpperCase(), sz / 2, 24);
    return c;
  }

  function styleColor(s) {
    return { 'fine-line':'#e0e0e0', traditional:'#e04040', japanese:'#c06040',
      tribal:'#fff', watercolor:'#80b0ff', blackwork:'#fff', minimalist:'#d0d0d0',
      'neo-traditional':'#e08040', dotwork:'#a0a0a0', realistic:'#c0c0c0' }[s] || '#fff';
  }

  function drawLine(x, sz, r) {
    const c = sz / 2, n = 5 + (r() * 8 | 0);
    x.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2 - Math.PI / 2, d = 60 + r() * 80;
      i === 0 ? x.moveTo(c + Math.cos(a) * d, c + Math.sin(a) * d) : x.lineTo(c + Math.cos(a) * d, c + Math.sin(a) * d);
    }
    x.closePath(); x.stroke();
    for (let i = 0; i < 6; i++) {
      x.beginPath();
      x.moveTo(c + (r() - .5) * 120, c + (r() - .5) * 120);
      x.quadraticCurveTo(c + (r() - .5) * 60, c + (r() - .5) * 60, c + (r() - .5) * 120, c + (r() - .5) * 120);
      x.stroke();
    }
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(c + (r() - .5) * 160, c + (r() - .5) * 160, 4 + r() * 12, 0, Math.PI * 2); x.stroke(); }
  }

  function drawTribal(x, sz, r) {
    const c = sz / 2;
    for (let i = 0; i < 12; i++) {
      x.save(); x.translate(c, c); x.rotate(i / 12 * Math.PI * 2 + r() * .3);
      x.beginPath(); x.moveTo(0, -20);
      x.lineTo(15 + r() * 20, -(60 + r() * 80));
      x.lineTo(-15 - r() * 20, -(60 + r() * 80));
      x.closePath(); x.fill(); x.restore();
    }
  }

  function drawWave(x, sz, r) {
    const c = sz / 2;
    for (let w = 0; w < 5; w++) {
      x.beginPath();
      const yb = 80 + w * 50 + r() * 20;
      for (let px = 40; px < sz - 40; px += 2) {
        const y = yb + Math.sin(px * .04 + w + r()) * (20 + r() * 15);
        px === 40 ? x.moveTo(px, y) : x.lineTo(px, y);
      }
      x.stroke();
    }
    x.beginPath(); x.arc(c + r() * 40, 100 + r() * 40, 25 + r() * 15, 0, Math.PI * 2); x.stroke();
  }

  function drawDots(x, sz, r) {
    const c = sz / 2;
    for (let i = 0; i < 300; i++) {
      const a = r() * Math.PI * 2, d = r() * 140;
      x.beginPath(); x.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1 + r() * 3, 0, Math.PI * 2); x.fill();
    }
  }

  function drawWater(x, sz, r) {
    for (let i = 0; i < 8; i++) {
      const px = sz * .2 + r() * sz * .6, py = sz * .2 + r() * sz * .6, rd = 30 + r() * 60, h = 180 + r() * 160;
      const g = x.createRadialGradient(px, py, 0, px, py, rd);
      g.addColorStop(0, 'hsla(' + h + ',70%,60%,.4)');
      g.addColorStop(1, 'hsla(' + h + ',70%,60%,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rd, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5;
    drawLine(x, sz, r);
  }

  // ── Photo upload ──
  const overlay = $('#uploadOverlay');
  overlay.addEventListener('click', () => $('#photoUpload').click());
  overlay.addEventListener('dragover', e => { e.preventDefault(); overlay.style.borderColor = 'var(--ac)'; });
  overlay.addEventListener('dragleave', () => overlay.style.borderColor = '');
  overlay.addEventListener('drop', e => { e.preventDefault(); overlay.style.borderColor = ''; if (e.dataTransfer.files[0]) loadPhoto(e.dataTransfer.files[0]); });
  $('#photoUpload').addEventListener('change', e => { if (e.target.files[0]) loadPhoto(e.target.files[0]); });

  function loadPhoto(file) {
    const rd = new FileReader();
    rd.onload = e => {
      const img = new Image();
      img.onload = () => { S.photo = img; overlay.classList.add('hidden'); S.tattoo.x = 300; S.tattoo.y = 350; drawPreview(); };
      img.src = e.target.result;
    };
    rd.readAsDataURL(file);
  }

  // ── Canvas preview ──
  const cvs = $('#previewCanvas'), ctx = cvs.getContext('2d');

  function drawPreview() {
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    if (S.photo) {
      const sc = Math.max(w / S.photo.width, h / S.photo.height);
      const dw = S.photo.width * sc, dh = S.photo.height * sc;
      ctx.drawImage(S.photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
    }
    if (S.design) {
      const t = S.tattoo;
      ctx.save(); ctx.globalAlpha = t.alpha;
      ctx.translate(t.x, t.y); ctx.rotate(t.rot * Math.PI / 180);
      ctx.drawImage(S.design, -t.size / 2, -t.size / 2, t.size, t.size);
      ctx.restore();
      // watermark
      ctx.save(); ctx.globalAlpha = .15; ctx.font = '28px Inter,sans-serif';
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.translate(w / 2, h / 2); ctx.rotate(-.4);
      ctx.fillText('TRYINK PREVIEW', 0, 0); ctx.restore();
    }
  }

  // ── Drag tattoo ──
  cvs.addEventListener('mousedown', e => startDrag(e.offsetX * (cvs.width / cvs.clientWidth), e.offsetY * (cvs.height / cvs.clientHeight), e));
  cvs.addEventListener('mousemove', e => moveDrag(e.offsetX * (cvs.width / cvs.clientWidth), e.offsetY * (cvs.height / cvs.clientHeight)));
  cvs.addEventListener('mouseup', () => S.drag = false);
  cvs.addEventListener('touchstart', e => { const r = cvs.getBoundingClientRect(), t = e.touches[0]; startDrag((t.clientX - r.left) * cvs.width / r.width, (t.clientY - r.top) * cvs.height / r.height, e); });
  cvs.addEventListener('touchmove', e => { const r = cvs.getBoundingClientRect(), t = e.touches[0]; moveDrag((t.clientX - r.left) * cvs.width / r.width, (t.clientY - r.top) * cvs.height / r.height); });
  cvs.addEventListener('touchend', () => S.drag = false);

  function startDrag(mx, my, e) {
    if (!S.design) return;
    const t = S.tattoo, half = t.size / 2;
    if (mx > t.x - half && mx < t.x + half && my > t.y - half && my < t.y + half) {
      S.drag = true; S.off.x = mx - t.x; S.off.y = my - t.y; e.preventDefault();
    }
  }
  function moveDrag(mx, my) {
    if (!S.drag) return;
    S.tattoo.x = mx - S.off.x; S.tattoo.y = my - S.off.y; drawPreview();
  }

  // ── Sliders ──
  $('#ctrlSize').addEventListener('input', e => { S.tattoo.size = +e.target.value; drawPreview(); });
  $('#ctrlRotation').addEventListener('input', e => { S.tattoo.rot = +e.target.value; drawPreview(); });
  $('#ctrlOpacity').addEventListener('input', e => { S.tattoo.alpha = +e.target.value / 100; drawPreview(); });

  // ── Downloads ──
  $('#dlFree').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'tryink-preview.png'; a.href = cvs.toDataURL('image/png'); a.click();
  });
  $('#dlHD').addEventListener('click', paywall);
  if ($('#buyPack')) $('#buyPack').addEventListener('click', paywall);
  if ($('#buySingle')) $('#buySingle').addEventListener('click', paywall);

  function paywall() {
    alert('PayPal payment coming soon!\n\n$2 per design or $5 for 10 designs.');
  }

  // ── Utilities ──
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function rng(a) { return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  drawPreview();
})();
