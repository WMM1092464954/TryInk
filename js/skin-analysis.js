// ── Skin Analysis Module ──
// 皮肤色采样、纹理提取、皮肤检测

window.SkinAnalysis = (function () {
  'use strict';

  // YCbCr 色彩空间皮肤检测
  function isSkinPixel(r, g, b) {
    const y  = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.169 * r - 0.331 * g + 0.500 * b;
    const cr = 128 + 0.500 * r - 0.419 * g - 0.081 * b;
    return (y > 60) && (cb > 77 && cb < 127) && (cr > 133 && cr < 173);
  }

  // 从照片中纹身位置周围采样皮肤颜色
  function sampleSkinColor(photoCtx, x, y, radius) {
    const r = Math.max(0, Math.round(radius));
    const sx = Math.max(0, Math.round(x - r));
    const sy = Math.max(0, Math.round(y - r));
    const sw = Math.min(r * 2, photoCtx.canvas.width - sx);
    const sh = Math.min(r * 2, photoCtx.canvas.height - sy);
    if (sw <= 0 || sh <= 0) return { r: 180, g: 150, b: 130, brightness: 153 };

    const imageData = photoCtx.getImageData(sx, sy, sw, sh);
    const d = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < d.length; i += 4) {
      if (isSkinPixel(d[i], d[i + 1], d[i + 2])) {
        sumR += d[i];
        sumG += d[i + 1];
        sumB += d[i + 2];
        count++;
      }
    }

    if (count < 10) {
      // 没检测到足够的皮肤像素，用区域平均色
      for (let i = 0; i < d.length; i += 4) {
        sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2]; count++;
      }
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    return {
      r: avgR, g: avgG, b: avgB,
      brightness: (avgR + avgG + avgB) / 3
    };
  }

  // 提取皮肤纹理（高频分量）
  function extractSkinTexture(photoCtx, x, y, size) {
    const sx = Math.max(0, Math.round(x - size / 2));
    const sy = Math.max(0, Math.round(y - size / 2));
    const sw = Math.min(Math.round(size), photoCtx.canvas.width - sx);
    const sh = Math.min(Math.round(size), photoCtx.canvas.height - sy);
    if (sw <= 0 || sh <= 0) return null;

    const imageData = photoCtx.getImageData(sx, sy, sw, sh);
    const d = imageData.data;
    const len = sw * sh;

    // 转灰度
    const gray = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    }

    // 简单 3x3 box blur
    const blurred = new Float32Array(len);
    for (let row = 0; row < sh; row++) {
      for (let col = 0; col < sw; col++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const r2 = row + dy, c2 = col + dx;
            if (r2 >= 0 && r2 < sh && c2 >= 0 && c2 < sw) {
              sum += gray[r2 * sw + c2];
              cnt++;
            }
          }
        }
        blurred[row * sw + col] = sum / cnt;
      }
    }

    // 高通 = 原始 - 模糊 + 128（中心化）
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = sw;
    textureCanvas.height = sh;
    const tCtx = textureCanvas.getContext('2d');
    const tData = tCtx.createImageData(sw, sh);
    const td = tData.data;

    for (let i = 0; i < len; i++) {
      const val = Math.max(0, Math.min(255, gray[i] - blurred[i] + 128));
      td[i * 4] = val;
      td[i * 4 + 1] = val;
      td[i * 4 + 2] = val;
      td[i * 4 + 3] = 255;
    }

    tCtx.putImageData(tData, 0, 0);
    return textureCanvas;
  }

  // 根据肤色调整纹身墨色
  function tintTattooForSkin(tattooCanvas, skinColor) {
    const c = document.createElement('canvas');
    c.width = tattooCanvas.width;
    c.height = tattooCanvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(tattooCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imageData.data;
    const skinBri = skinColor.brightness / 255;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue; // 跳过透明像素

      // 深色皮肤上纹身墨色更深，浅色皮肤上更鲜明
      const factor = 0.4 + 0.6 * skinBri;
      // 轻微染上皮肤色调
      d[i]     = Math.min(255, d[i] * factor + skinColor.r * 0.05);
      d[i + 1] = Math.min(255, d[i + 1] * factor + skinColor.g * 0.05);
      d[i + 2] = Math.min(255, d[i + 2] * factor + skinColor.b * 0.05);
    }

    ctx.putImageData(imageData, 0, 0);
    return c;
  }

  return {
    sampleSkinColor,
    extractSkinTexture,
    tintTattooForSkin,
    isSkinPixel
  };
})();
