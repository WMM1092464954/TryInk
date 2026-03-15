// ── Tattoo Blend Module ──
// 多层混合渲染 + 边缘羽化

window.TattooBlend = (function () {
  'use strict';

  const _featherCache = new Map();

  // 创建边缘羽化蒙版
  function createFeatherMask(size, featherWidth) {
    featherWidth = featherWidth || Math.max(8, size * 0.08);
    const key = size + '_' + Math.round(featherWidth);
    if (_featherCache.has(key)) return _featherCache.get(key);

    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    const innerR = size / 2 - featherWidth;
    const outerR = size / 2;
    const cx = size / 2, cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, Math.max(0, innerR), cx, cy, outerR);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    _featherCache.set(key, c);
    return c;
  }

  // 对纹身应用边缘羽化
  function applyFeather(tattooCanvas) {
    const size = tattooCanvas.width;
    const mask = createFeatherMask(size);

    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    ctx.drawImage(tattooCanvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);

    return c;
  }

  // 多层混合渲染纹身到画布
  // photoCtx: 已绘制照片的 canvas context
  // tattooSrc: 处理后的纹身 canvas（已去白底、已着色）
  // skinTexture: 皮肤纹理 canvas（可为 null）
  // t: { x, y, size, rot, alpha }
  function renderBlended(photoCtx, tattooSrc, skinTexture, t, colorMode) {
    const feathered = applyFeather(tattooSrc);

    if (colorMode) {
      // ── Color tattoo blend: preserve original colors ──
      // Layer 1: Main color layer
      photoCtx.save();
      photoCtx.globalAlpha = t.alpha * 0.75;
      photoCtx.globalCompositeOperation = 'source-over';
      photoCtx.translate(t.x, t.y);
      photoCtx.rotate(t.rot * Math.PI / 180);
      photoCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      photoCtx.restore();

      // Layer 2: Subtle multiply for skin interaction
      photoCtx.save();
      photoCtx.globalAlpha = t.alpha * 0.15;
      photoCtx.globalCompositeOperation = 'multiply';
      photoCtx.translate(t.x, t.y);
      photoCtx.rotate(t.rot * Math.PI / 180);
      photoCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      photoCtx.restore();
    } else {
      // ── Black ink blend ──
      // Layer 1: Multiply blend
      photoCtx.save();
      photoCtx.globalAlpha = t.alpha * 0.85;
      photoCtx.globalCompositeOperation = 'multiply';
      photoCtx.translate(t.x, t.y);
      photoCtx.rotate(t.rot * Math.PI / 180);
      photoCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      photoCtx.restore();

      // Layer 2: Darken
      photoCtx.save();
      photoCtx.globalAlpha = t.alpha * 0.25;
      photoCtx.globalCompositeOperation = 'darken';
      photoCtx.translate(t.x, t.y);
      photoCtx.rotate(t.rot * Math.PI / 180);
      photoCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      photoCtx.restore();
    }

    // Layer 3: Skin texture
    if (skinTexture) {
      const tmpCvs = document.createElement('canvas');
      tmpCvs.width = photoCtx.canvas.width;
      tmpCvs.height = photoCtx.canvas.height;
      const tmpCtx = tmpCvs.getContext('2d');

      tmpCtx.translate(t.x, t.y);
      tmpCtx.rotate(t.rot * Math.PI / 180);
      tmpCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      tmpCtx.setTransform(1, 0, 0, 1, 0, 0);

      tmpCtx.globalCompositeOperation = 'source-in';
      tmpCtx.drawImage(skinTexture,
        Math.round(t.x - t.size / 2), Math.round(t.y - t.size / 2),
        t.size, t.size,
        Math.round(t.x - t.size / 2), Math.round(t.y - t.size / 2),
        t.size, t.size
      );

      photoCtx.save();
      photoCtx.globalAlpha = colorMode ? 0.15 : 0.25;
      photoCtx.globalCompositeOperation = 'soft-light';
      photoCtx.drawImage(tmpCvs, 0, 0);
      photoCtx.restore();
    }

    // Layer 4: Overlay (skip for color mode)
    if (!colorMode) {
      photoCtx.save();
      photoCtx.globalAlpha = t.alpha * 0.1;
      photoCtx.globalCompositeOperation = 'overlay';
      photoCtx.translate(t.x, t.y);
      photoCtx.rotate(t.rot * Math.PI / 180);
      photoCtx.drawImage(feathered, -t.size / 2, -t.size / 2, t.size, t.size);
      photoCtx.restore();
    }
  }

  // 简单渲染（拖拽中使用，性能优先）
  function renderSimple(photoCtx, tattooSrc, t) {
    photoCtx.save();
    photoCtx.globalAlpha = t.alpha;
    photoCtx.globalCompositeOperation = 'multiply';
    photoCtx.translate(t.x, t.y);
    photoCtx.rotate(t.rot * Math.PI / 180);
    photoCtx.drawImage(tattooSrc, -t.size / 2, -t.size / 2, t.size, t.size);
    photoCtx.restore();
  }

  return {
    renderBlended,
    renderSimple,
    applyFeather,
    createFeatherMask
  };
})();
