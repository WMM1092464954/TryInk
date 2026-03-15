(function () {
  'use strict';

  // ── State ──
  const S = {
    credits: 50,
    style: 'minimalist',
    design: null,       // HTMLImageElement or HTMLCanvasElement
    designUrl: null,    // HD image URL for paid download
    photo: null,
    tattoo: { x: 300, y: 350, size: 120, rot: 0, alpha: 0.85 },
    surface: 'flat',    // flat, cylinder-h, cylinder-v, sphere
    curvature: 0,       // 0~100
    colorMode: false,   // true for color styles (watercolor, neo-traditional, realistic)
    drag: false,
    off: { x: 0, y: 0 }
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ── Color styles set ──
  const COLOR_STYLES = new Set(['watercolor', 'neo-traditional', 'realistic']);

  // ── Style pills (generator only) ──
  $$('#stylePills .pill').forEach(p => p.addEventListener('click', () => {
    $$('#stylePills .pill').forEach(b => b.classList.remove('active'));
    p.classList.add('active');
    S.style = p.dataset.style;
    S.colorMode = COLOR_STYLES.has(S.style);
  }));

  // ── Design tabs ──
  $$('.design-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.design-tab').forEach(t => t.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    const panelMap = { ai: 'tabAi', convert: 'tabConvert', library: 'tabLibrary' };
    const panel = document.getElementById(panelMap[target]);
    if (panel) panel.classList.add('active');
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

  async function generate() {
    const prompt = $('#prompt').value.trim();
    if (!prompt) {
      $('#prompt').style.borderColor = '#ef4444';
      setTimeout(() => $('#prompt').style.borderColor = '', 1500);
      return;
    }
    if (S.credits <= 0) { initPayPalPayment('pack'); return; }

    const btn = $('#generateBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Generating...';
    $('#results').innerHTML = '<div class="results-placeholder"><span class="spinner" style="width:32px;height:32px;border-width:3px"></span><p>Creating your tattoo designs...</p></div>';

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: S.style
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      S.credits--;
      if (window.TryInkAuth) window.TryInkAuth.saveCredits(S.credits);
      if (data.colorMode !== undefined) S.colorMode = data.colorMode;
      $('#creditsNote').textContent = S.credits > 0
        ? S.credits + ' free generation' + (S.credits > 1 ? 's' : '') + ' remaining'
        : 'Free generations used — upgrade for more';

      renderResults(data.images);
      // Save first design to history
      if (window.TryInkAuth && data.images.length > 0) {
        window.TryInkAuth.saveDesign({ prompt: prompt, style: S.style });
      }
    } catch (err) {
      $('#results').innerHTML = '<div class="results-placeholder"><p style="color:#ef4444">Failed to generate: ' + err.message + '<br>Please try again.</p></div>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Designs';
    }
  }

  // ── Render result cards (from AI image URLs) ──
  function renderResults(imageUrls) {
    const el = $('#results');
    el.innerHTML = '';
    imageUrls.forEach(url => {
      const card = document.createElement('div');
      card.className = 'result-card';

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;

      const imgEl = document.createElement('img');
      imgEl.crossOrigin = 'anonymous';
      imgEl.src = url;
      imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      card.appendChild(imgEl);

      const wm = document.createElement('div');
      wm.className = 'wm';
      wm.textContent = 'TRYINK';
      card.appendChild(wm);

      card.addEventListener('click', () => {
        $$('.result-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (img.complete && img.naturalWidth) { selectDesign(img, url); }
        else { img.onload = () => selectDesign(img, url); }
      });

      el.appendChild(card);
    });
  }

  // ── Select design (used by results, library, converter) ──
  function selectDesign(img, url) {
    S.design = img;
    S.designUrl = url;
    drawPreview();
    $('#dlFree').disabled = false;
    $('#dlHD').disabled = false;
    if (S.photo) $('#fusionBtn').disabled = false;
    enableShareBtns();
  }
  window.TryInk = {
    selectDesign,
    setColorMode: (v) => { S.colorMode = v; },
    setCredits: (n) => { S.credits = n; $('#creditsNote').textContent = n > 0 ? n + ' generation' + (n > 1 ? 's' : '') + ' remaining' : 'Free generations used — upgrade for more'; }
  };

  // ── Photo upload ──
  const overlay = $('#uploadOverlay');
  overlay.addEventListener('click', () => $('#photoUpload').click());
  overlay.addEventListener('dragover', e => { e.preventDefault(); overlay.style.borderColor = 'var(--ac)'; });
  overlay.addEventListener('dragleave', () => overlay.style.borderColor = '');
  overlay.addEventListener('drop', e => { e.preventDefault(); overlay.style.borderColor = ''; if (e.dataTransfer.files[0]) loadPhoto(e.dataTransfer.files[0]); });
  $('#photoUpload').addEventListener('change', e => { if (e.target.files[0]) loadPhoto(e.target.files[0]); });
  $('#changePhotoBtn').addEventListener('click', () => { $('#photoUpload').value = ''; $('#photoUpload').click(); });

  function loadPhoto(file) {
    const rd = new FileReader();
    rd.onload = e => {
      const img = new Image();
      img.onload = () => { S.photo = img; overlay.classList.add('hidden'); $('#changePhotoBtn').style.display = ''; S.tattoo.x = 300; S.tattoo.y = 350; drawPreview(); if (S.design) $('#fusionBtn').disabled = false; };
      img.src = e.target.result;
    };
    rd.readAsDataURL(file);
  }

  // ── Canvas preview ──
  const cvs = $('#previewCanvas'), ctx = cvs.getContext('2d');

  // ── Remove background: light pixels → transparent, dark pixels → ink ──
  const _bgCache = new WeakMap();
  function getTransparentTattoo(img) {
    if (_bgCache.has(img)) return _bgCache.get(img);
    const c = document.createElement('canvas');
    const sz = Math.min(img.naturalWidth || img.width, 512);
    c.width = sz; c.height = sz;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, sz, sz);
    const id = x.getImageData(0, 0, sz, sz);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (brightness > 200) {
        d[i + 3] = 0;
      } else if (brightness > 120) {
        d[i + 3] = Math.round(255 * (1 - (brightness - 120) / 80));
      }
    }
    x.putImageData(id, 0, 0);
    _bgCache.set(img, c);
    return c;
  }

  // ── Skin analysis cache ──
  let _skinCache = { photoId: null, x: 0, y: 0, color: null, texture: null };

  function getSkinData(photoCtx, t) {
    const key = (S.photo ? S.photo.src : '') + '_' + Math.round(t.x) + '_' + Math.round(t.y);
    if (_skinCache.photoId === key) return _skinCache;

    const color = window.SkinAnalysis.sampleSkinColor(photoCtx, t.x, t.y, t.size * 0.8);
    const texture = window.SkinAnalysis.extractSkinTexture(photoCtx, t.x, t.y, t.size);

    _skinCache = { photoId: key, color, texture };
    return _skinCache;
  }

  // ── Prepared tattoo cache (tinted + transparent) ──
  const _tintCache = new WeakMap();

  function getPreparedTattoo(img, skinColor) {
    const modeKey = S.colorMode ? 'color' : 'bw';
    const cacheKey = modeKey + '_' + Math.round(skinColor.r) + '_' + Math.round(skinColor.g) + '_' + Math.round(skinColor.b);
    if (_tintCache.has(img) && _tintCache.get(img).key === cacheKey) {
      return _tintCache.get(img).canvas;
    }
    const transparent = getTransparentTattoo(img);
    // Color mode: skip skin tinting to preserve original colors
    const result = S.colorMode ? transparent : window.SkinAnalysis.tintTattooForSkin(transparent, skinColor);
    _tintCache.set(img, { key: cacheKey, canvas: result });
    return result;
  }

  function drawPhoto() {
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    if (S.photo) {
      const sc = Math.max(w / S.photo.width, h / S.photo.height);
      const dw = S.photo.width * sc, dh = S.photo.height * sc;
      ctx.drawImage(S.photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
    }
  }

  function drawWatermark() {
    const w = cvs.width, h = cvs.height;
    ctx.save(); ctx.globalAlpha = .15; ctx.font = '28px Inter,sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.translate(w / 2, h / 2); ctx.rotate(-.4);
    ctx.fillText('TRYINK PREVIEW', 0, 0); ctx.restore();
  }

  // ── Render tattoo with mesh warp support ──
  function renderTattooWarped(targetCtx, tattooSrc, t, alpha, compositeOp) {
    if (S.curvature > 0 && S.surface !== 'flat') {
      // 网格变形渲染
      // 先将纹身绘制到临时 canvas（应用旋转）
      const tmpCvs = document.createElement('canvas');
      tmpCvs.width = tattooSrc.width; tmpCvs.height = tattooSrc.height;
      const tmpCtx = tmpCvs.getContext('2d');
      if (t.rot !== 0) {
        tmpCtx.translate(tmpCvs.width / 2, tmpCvs.height / 2);
        tmpCtx.rotate(t.rot * Math.PI / 180);
        tmpCtx.drawImage(tattooSrc, -tmpCvs.width / 2, -tmpCvs.height / 2);
      } else {
        tmpCtx.drawImage(tattooSrc, 0, 0);
      }

      var controlPoints = window.BodyModels.generateControlPoints(t, S.surface, S.curvature);
      window.MeshWarp.renderWarped(
        targetCtx, tmpCvs, controlPoints,
        window.BodyModels.GRID_COLS, window.BodyModels.GRID_ROWS,
        alpha, compositeOp
      );
    } else {
      // 平面渲染（无变形）
      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      if (compositeOp) targetCtx.globalCompositeOperation = compositeOp;
      targetCtx.translate(t.x, t.y);
      targetCtx.rotate(t.rot * Math.PI / 180);
      targetCtx.drawImage(tattooSrc, -t.size / 2, -t.size / 2, t.size, t.size);
      targetCtx.restore();
    }
  }

  function drawPreview() {
    drawPhoto();
    if (!S.design) return;

    const t = S.tattoo;

    if (blendMode && S.photo) {
      // ── Enhanced realistic blend with warp ──
      const skinData = getSkinData(ctx, t);
      const prepared = getPreparedTattoo(S.design, skinData.color);
      const feathered = window.TattooBlend.applyFeather(prepared);

      if (S.colorMode) {
        // ── Color tattoo blend: preserve original colors ──
        // Layer 1: Main color layer (source-over for vivid colors)
        renderTattooWarped(ctx, feathered, t, t.alpha * 0.75, 'source-over');
        // Layer 2: Subtle multiply for skin interaction
        renderTattooWarped(ctx, feathered, t, t.alpha * 0.15, 'multiply');
      } else {
        // ── Black ink blend ──
        // Layer 1: Multiply
        renderTattooWarped(ctx, feathered, t, t.alpha * 0.85, 'multiply');
        // Layer 2: Darken
        renderTattooWarped(ctx, feathered, t, t.alpha * 0.25, 'darken');
      }

      // Layer 3: Skin texture (only for flat, skip for warped — too expensive)
      if (skinData.texture && S.curvature === 0) {
        const tmpCvs = document.createElement('canvas');
        tmpCvs.width = ctx.canvas.width; tmpCvs.height = ctx.canvas.height;
        const tmpCtx = tmpCvs.getContext('2d');
        tmpCtx.translate(t.x, t.y); tmpCtx.rotate(t.rot * Math.PI / 180);
        tmpCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
        tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
        tmpCtx.globalCompositeOperation = 'source-in';
        tmpCtx.drawImage(skinData.texture,
          Math.round(t.x - t.size / 2), Math.round(t.y - t.size / 2), t.size, t.size,
          Math.round(t.x - t.size / 2), Math.round(t.y - t.size / 2), t.size, t.size);
        ctx.save(); ctx.globalAlpha = S.colorMode ? 0.15 : 0.25;
        ctx.globalCompositeOperation = 'soft-light';
        ctx.drawImage(tmpCvs, 0, 0); ctx.restore();
      }

      // Layer 4: Overlay (skip for color mode — washes out colors)
      if (!S.colorMode) {
        renderTattooWarped(ctx, feathered, t, t.alpha * 0.1, 'overlay');
      }

    } else if (blendMode) {
      const src = getTransparentTattoo(S.design);
      renderTattooWarped(ctx, src, t, t.alpha, 'multiply');
    } else {
      // ── Normal mode ──
      renderTattooWarped(ctx, S.design, t, t.alpha, null);
    }

    drawWatermark();
  }

  // ── Optimized drag preview (simpler rendering while dragging) ──
  function drawPreviewFast() {
    drawPhoto();
    if (!S.design) return;
    const t = S.tattoo;
    const src = blendMode ? getTransparentTattoo(S.design) : S.design;
    ctx.save();
    ctx.globalAlpha = t.alpha;
    if (blendMode) ctx.globalCompositeOperation = 'multiply';
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot * Math.PI / 180);
    ctx.drawImage(src, -t.size / 2, -t.size / 2, t.size, t.size);
    ctx.restore();
  }

  // ── Drag tattoo ──
  cvs.addEventListener('mousedown', e => startDrag(e.offsetX * (cvs.width / cvs.clientWidth), e.offsetY * (cvs.height / cvs.clientHeight), e));
  cvs.addEventListener('mousemove', e => moveDrag(e.offsetX * (cvs.width / cvs.clientWidth), e.offsetY * (cvs.height / cvs.clientHeight)));
  cvs.addEventListener('mouseup', () => { if (S.drag) { S.drag = false; drawPreview(); } });
  cvs.addEventListener('touchstart', e => { const r = cvs.getBoundingClientRect(), t = e.touches[0]; startDrag((t.clientX - r.left) * cvs.width / r.width, (t.clientY - r.top) * cvs.height / r.height, e); });
  cvs.addEventListener('touchmove', e => { const r = cvs.getBoundingClientRect(), t = e.touches[0]; moveDrag((t.clientX - r.left) * cvs.width / r.width, (t.clientY - r.top) * cvs.height / r.height); });
  cvs.addEventListener('touchend', () => { if (S.drag) { S.drag = false; drawPreview(); } });

  function startDrag(mx, my, e) {
    if (!S.design) return;
    const t = S.tattoo, half = t.size / 2;
    if (mx > t.x - half && mx < t.x + half && my > t.y - half && my < t.y + half) {
      S.drag = true; S.off.x = mx - t.x; S.off.y = my - t.y; e.preventDefault();
    }
  }
  function moveDrag(mx, my) {
    if (!S.drag) return;
    S.tattoo.x = mx - S.off.x; S.tattoo.y = my - S.off.y;
    drawPreviewFast(); // 拖拽中用快速渲染
  }

  // ── Sliders ──
  $('#ctrlSize').addEventListener('input', e => { S.tattoo.size = +e.target.value; drawPreview(); });
  $('#ctrlRotation').addEventListener('input', e => { S.tattoo.rot = +e.target.value; drawPreview(); });
  $('#ctrlOpacity').addEventListener('input', e => { S.tattoo.alpha = +e.target.value / 100; drawPreview(); });
  $('#ctrlCurvature').addEventListener('input', e => { S.curvature = +e.target.value; drawPreview(); });
  $('#ctrlSurface').addEventListener('change', e => {
    S.surface = e.target.value;
    // 选择身体部位后自动设置默认弯曲度
    if (S.surface !== 'flat' && S.curvature === 0) {
      S.curvature = 40;
      $('#ctrlCurvature').value = 40;
    }
    drawPreview();
  });

  // ── Realistic Blend Toggle ──
  let blendMode = false;

  $('#fusionBtn').addEventListener('click', () => {
    if (!S.design || !S.photo) {
      alert('Please select a design and upload a photo first.');
      return;
    }
    blendMode = !blendMode;
    $('#fusionBtn').textContent = blendMode ? 'Switch to Normal Preview' : 'Realistic Blend — Tattoo on Skin';
    $('#fusionNote').textContent = blendMode ? 'Skin-matched blend with texture and feathered edges' : 'Click to blend tattoo into your skin naturally';
    drawPreview();
  });

  // ── Downloads ──
  $('#dlFree').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'tryink-preview.png'; a.href = cvs.toDataURL('image/png'); a.click();
  });

  $('#dlHD').addEventListener('click', () => initPayPalPayment('single'));
  if ($('#buyPack')) $('#buyPack').addEventListener('click', () => initPayPalPayment('pack'));
  if ($('#buySingle')) $('#buySingle').addEventListener('click', () => initPayPalPayment('single'));

  // ── PayPal Integration ──
  function initPayPalPayment(type) {
    const amount = type === 'pack' ? '5.00' : '2.00';
    const description = type === 'pack' ? 'TryInk Design Pack (10 designs)' : 'TryInk Single HD Download';

    // Check if PayPal SDK is loaded
    if (typeof paypal === 'undefined') {
      alert('Payment system is loading. Please try again in a moment.');
      return;
    }

    // Create a modal for PayPal button
    let modal = $('#paypal-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'paypal-modal';
      modal.innerHTML = '<div class="paypal-modal-backdrop"></div><div class="paypal-modal-content"><h3>Complete Payment</h3><p class="paypal-modal-info"></p><div id="paypal-button-container"></div><button class="btn btn-outline paypal-modal-close">Cancel</button></div>';
      document.body.appendChild(modal);
      modal.querySelector('.paypal-modal-backdrop').addEventListener('click', () => modal.classList.remove('active'));
      modal.querySelector('.paypal-modal-close').addEventListener('click', () => modal.classList.remove('active'));
    }

    modal.querySelector('.paypal-modal-info').textContent = description + ' — $' + amount;
    modal.classList.add('active');

    // Clear previous PayPal button and render new one
    const container = $('#paypal-button-container');
    container.innerHTML = '';

    paypal.Buttons({
      createOrder: function (data, actions) {
        return actions.order.create({
          purchase_units: [{
            description: description,
            amount: { value: amount }
          }]
        });
      },
      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          modal.classList.remove('active');
          onPaymentSuccess(type, details);
        });
      },
      onCancel: function () {
        modal.classList.remove('active');
      },
      onError: function (err) {
        modal.classList.remove('active');
        alert('Payment failed. Please try again.');
        console.error('PayPal error:', err);
      }
    }).render('#paypal-button-container');
  }

  function onPaymentSuccess(type, details) {
    if (type === 'pack') {
      S.credits += 10;
      if (window.TryInkAuth) window.TryInkAuth.saveCredits(S.credits);
      $('#creditsNote').textContent = S.credits + ' generation' + (S.credits > 1 ? 's' : '') + ' remaining';
      alert('Thank you! 10 design credits added to your account.');
    } else {
      // Single HD download — trigger watermark-free download
      downloadHD();
      alert('Thank you! Your HD design is downloading.');
    }
  }

  function downloadHD() {
    if (!S.design || !S.photo) return;
    const hdCvs = document.createElement('canvas');
    hdCvs.width = 1200; hdCvs.height = 1400;
    const hctx = hdCvs.getContext('2d');
    const w = hdCvs.width, h = hdCvs.height;

    // Draw photo
    const sc = Math.max(w / S.photo.width, h / S.photo.height);
    const dw = S.photo.width * sc, dh = S.photo.height * sc;
    hctx.drawImage(S.photo, (w - dw) / 2, (h - dh) / 2, dw, dh);

    // Draw tattoo (scaled up proportionally)
    const scaleX = w / cvs.width, scaleY = h / cvs.height;
    const t = S.tattoo;
    const hdT = {
      x: t.x * scaleX, y: t.y * scaleY,
      size: t.size * Math.min(scaleX, scaleY),
      rot: t.rot, alpha: t.alpha
    };

    if (blendMode) {
      const skinData = getSkinData(hctx, hdT);
      const prepared = getPreparedTattoo(S.design, skinData.color);
      window.TattooBlend.renderBlended(hctx, prepared, skinData.texture, hdT, S.colorMode);
    } else {
      hctx.save(); hctx.globalAlpha = hdT.alpha;
      hctx.translate(hdT.x, hdT.y);
      hctx.rotate(hdT.rot * Math.PI / 180);
      hctx.drawImage(S.design, -hdT.size / 2, -hdT.size / 2, hdT.size, hdT.size);
      hctx.restore();
    }

    const a = document.createElement('a');
    a.download = 'tryink-hd-design.png';
    a.href = hdCvs.toDataURL('image/png');
    a.click();
  }

  // ── Photo-to-Tattoo Converter ──
  const convDrop = $('#converterDrop');
  const convPreview = $('#converterPreview');
  const convControls = $('#converterControls');
  let convSourceImg = null;

  if (convDrop) {
    convDrop.addEventListener('click', () => $('#converterFileInput').click());
    convDrop.addEventListener('dragover', e => { e.preventDefault(); convDrop.style.borderColor = 'var(--ac)'; });
    convDrop.addEventListener('dragleave', () => convDrop.style.borderColor = '');
    convDrop.addEventListener('drop', e => { e.preventDefault(); convDrop.style.borderColor = ''; if (e.dataTransfer.files[0]) loadConverterImage(e.dataTransfer.files[0]); });
    $('#converterFileInput').addEventListener('change', e => { if (e.target.files[0]) loadConverterImage(e.target.files[0]); });
  }

  function loadConverterImage(file) {
    const rd = new FileReader();
    rd.onload = e => {
      const img = new Image();
      img.onload = () => {
        convSourceImg = img;
        runConversion();
        convDrop.classList.add('hidden');
        convPreview.style.display = '';
        convControls.style.display = '';
      };
      img.src = e.target.result;
    };
    rd.readAsDataURL(file);
  }

  function runConversion() {
    if (!convSourceImg || !window.PhotoConverter) return;
    const threshold = +$('#ctrlThreshold').value;
    const thickness = +$('#ctrlThickness').value;
    const result = window.PhotoConverter.convertToStencil(convSourceImg, {
      size: 512, threshold: threshold, lineThickness: thickness
    });
    const ctx2 = convPreview.getContext('2d');
    ctx2.clearRect(0, 0, 512, 512);
    ctx2.drawImage(result, 0, 0);
  }

  if ($('#ctrlThreshold')) {
    $('#ctrlThreshold').addEventListener('input', runConversion);
    $('#ctrlThickness').addEventListener('input', runConversion);
  }

  if ($('#useStencilBtn')) {
    $('#useStencilBtn').addEventListener('click', () => {
      if (!convPreview) return;
      S.colorMode = false;
      selectDesign(convPreview, convPreview.toDataURL());
      $('#preview').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ── Share buttons ──
  function enableShareBtns() {
    $('#shareTwitter').disabled = false;
    $('#sharePinterest').disabled = false;
    $('#shareCopy').disabled = false;
  }

  $('#shareTwitter').addEventListener('click', () => {
    const text = encodeURIComponent('Check out my custom tattoo design made with TryInk!');
    const url = encodeURIComponent(window.location.origin);
    window.open('https://x.com/intent/tweet?text=' + text + '&url=' + url, '_blank', 'width=550,height=420');
  });

  $('#sharePinterest').addEventListener('click', () => {
    const imgData = cvs.toDataURL('image/jpeg', 0.85);
    const desc = encodeURIComponent('Custom AI tattoo design by TryInk');
    const url = encodeURIComponent(window.location.origin);
    window.open('https://pinterest.com/pin/create/button/?url=' + url + '&description=' + desc, '_blank', 'width=550,height=520');
  });

  $('#shareCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      const btn = $('#shareCopy');
      btn.textContent = '\u2713';
      setTimeout(() => { btn.innerHTML = '&#128279;'; }, 1500);
    });
  });

  // ── Mobile menu ──
  const mobileToggle = $('#mobileToggle');
  const mobileNav = $('#mobileNav');
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      mobileToggle.textContent = mobileNav.classList.contains('open') ? '\u2715' : '\u2630';
    });
  }
  window.closeMobileNav = function () {
    if (mobileNav) mobileNav.classList.remove('open');
    if (mobileToggle) mobileToggle.textContent = '\u2630';
  };

  drawPreview();
})();
