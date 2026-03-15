// ── Photo-to-Tattoo Converter ──
// Client-side edge detection to convert photos into tattoo stencils

window.PhotoConverter = (function () {
  'use strict';

  // Gaussian blur (3x3 kernel)
  function gaussianBlur(pixels, w, h) {
    const out = new Uint8ClampedArray(pixels.length);
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kSum = 16;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            sum += pixels[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const i = (y * w + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = sum / kSum;
        out[i + 3] = 255;
      }
    }
    return out;
  }

  // Sobel edge detection
  function sobelEdges(pixels, w, h) {
    const magnitude = new Float32Array(w * h);
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sx = 0, sy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            const val = pixels[idx];
            const ki = (ky + 1) * 3 + (kx + 1);
            sx += val * gx[ki];
            sy += val * gy[ki];
          }
        }
        magnitude[y * w + x] = Math.sqrt(sx * sx + sy * sy);
      }
    }
    return magnitude;
  }

  // Convert photo to tattoo stencil
  // Returns a canvas with black lines on white background
  function convertToStencil(imgElement, options) {
    options = options || {};
    const size = options.size || 512;
    const threshold = options.threshold || 40;  // 0-255, lower = more detail
    const lineThickness = options.lineThickness || 1;  // 1-3
    const invert = options.invert !== false;  // true = black lines on white

    // Draw to temp canvas
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Fit image maintaining aspect ratio
    const imgW = imgElement.naturalWidth || imgElement.width;
    const imgH = imgElement.naturalHeight || imgElement.height;
    const scale = Math.min(size / imgW, size / imgH);
    const dw = imgW * scale, dh = imgH * scale;
    const ox = (size - dw) / 2, oy = (size - dh) / 2;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(imgElement, ox, oy, dw, dh);

    // Get grayscale pixels
    const imageData = ctx.getImageData(0, 0, size, size);
    const d = imageData.data;

    // Convert to grayscale
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = gray;
    }

    // Apply blur
    const blurred = gaussianBlur(d, size, size);

    // Sobel edge detection
    const edges = sobelEdges(blurred, size, size);

    // Apply threshold and render
    const outData = ctx.createImageData(size, size);
    const out = outData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const edge = edges[y * size + x];
        const isEdge = edge > threshold;

        if (invert) {
          // Black lines on white background (matches AI output format)
          const val = isEdge ? 0 : 255;
          out[i] = out[i + 1] = out[i + 2] = val;
        } else {
          const val = isEdge ? 255 : 0;
          out[i] = out[i + 1] = out[i + 2] = val;
        }
        out[i + 3] = 255;
      }
    }

    ctx.putImageData(outData, 0, 0);

    // Optional: thicken lines by dilating
    if (lineThickness > 1) {
      const src = ctx.getImageData(0, 0, size, size);
      const dilated = ctx.createImageData(size, size);
      const r = lineThickness - 1;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          if (invert && src.data[idx] === 0) {
            // This is an edge pixel, expand it
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                const ny = y + dy, nx = x + dx;
                if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
                  const ni = (ny * size + nx) * 4;
                  dilated.data[ni] = dilated.data[ni + 1] = dilated.data[ni + 2] = 0;
                  dilated.data[ni + 3] = 255;
                }
              }
            }
          } else if (dilated.data[idx + 3] === 0) {
            dilated.data[idx] = dilated.data[idx + 1] = dilated.data[idx + 2] = 255;
            dilated.data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(dilated, 0, 0);
    }

    return c;
  }

  return { convertToStencil };
})();
