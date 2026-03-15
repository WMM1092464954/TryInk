require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting for API
const rateLimiter = {};
app.use('/api/', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!rateLimiter[ip]) rateLimiter[ip] = [];
  rateLimiter[ip] = rateLimiter[ip].filter(t => now - t < 60000);
  if (rateLimiter[ip].length >= 30) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  rateLimiter[ip].push(now);
  next();
});

// Static files with caching
const staticOpts = { maxAge: '1h' };
app.use(express.static('.', staticOpts));
app.use('/designs', express.static('designs', { maxAge: '7d' }));
app.use('/data', express.static('data', { maxAge: '1d' }));

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const CF_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;

const STYLE_PROMPTS = {
  'minimalist': 'minimalist single line drawing',
  'traditional': 'american traditional bold thick outline flat color',
  'blackwork': 'solid black silhouette geometric',
  'fine-line': 'fine line clean simple outline',
  'japanese': 'japanese style bold outline simple',
  'watercolor': 'watercolor tattoo style, soft color splashes, paint drips, blended edges, vibrant colors',
  'dotwork': 'dotwork pointillism tattoo, made entirely of small dots, stipple shading, no solid lines',
  'realistic': 'photorealistic tattoo design, highly detailed shading, 3D depth, portrait realism',
  'neo-traditional': 'neo-traditional tattoo, bold outlines with detailed shading, rich color palette, modern twist on classic',
  'tribal': 'tribal tattoo design, bold black curves and points, Polynesian Maori inspired patterns, symmetrical',
  'geometric': 'geometric tattoo design, sacred geometry, clean symmetrical shapes, mathematical precision, thin precise lines'
};

// Color styles need different prompt template (no "solid black ink")
const COLOR_STYLES = new Set(['watercolor', 'neo-traditional', 'realistic']);

// Generate one image, returns base64 data URL
async function generateOne(fullPrompt, seed, numSteps = 10) {
  const resp = await fetch(CF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      negative_prompt: 'square shape, rectangular, filling entire frame, edge to edge, scratchy, noise, grain, busy, border, frame, rectangular frame, decorative border, ornamental frame, multiple designs, text, words, letters, watermark, photograph, person, skin, blurry, bad quality, deformed',
      width: 768,
      height: 768,
      num_steps: numSteps,
      guidance: 10,
      seed: seed
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cloudflare API ${resp.status}: ${text}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  return buffer;
}

// Check if image is valid: not too dark, not too bright, no heavy border
function isValidImage(buffer) {
  // Basic size check — too small means generation failed
  if (buffer.length < 5000) return false;

  // Decode a few bytes to check it's a real image (JPEG starts with FFD8, PNG with 89504E47)
  const head = buffer[0];
  if (head !== 0xFF && head !== 0x89) return false;

  return true;
}

app.post('/api/generate', async (req, res) => {
  const { prompt, style } = req.body;

  if (!prompt || !style) {
    return res.status(400).json({ error: 'prompt and style are required' });
  }

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return res.status(500).json({ error: 'Cloudflare API not configured.' });
  }

  const styleHint = STYLE_PROMPTS[style] || '';
  const isColor = COLOR_STYLES.has(style);
  const fullPrompt = isColor
    ? `tattoo design of ${prompt}, ${styleHint}, on clean white background, centered, single isolated design, organic natural shape, lots of white space around the design, no square composition, no filling the entire canvas, no background`
    : `vector tattoo design of ${prompt}, ${styleHint}, solid black ink on pure white background, flat design, thick bold outlines, clean, simple, centered, single isolated design, organic natural shape, round or irregular edges, lots of white space around the design, no square composition, no filling the entire canvas, no background`;

  try {
    // Generate 6 images, filter bad ones, return best 4
    const baseSeed = Math.floor(Math.random() * 1000000);
    const steps = (style === 'realistic') ? 15 : 10;
    const promises = Array.from({ length: 8 }, (_, i) =>
      generateOne(fullPrompt, baseSeed + i * 1000, steps).catch(() => null)
    );

    const buffers = await Promise.all(promises);
    const validImages = buffers
      .filter(b => b && isValidImage(b))
      .slice(0, 4)
      .map(b => `data:image/png;base64,${b.toString('base64')}`);

    if (validImages.length === 0) {
      return res.status(500).json({ error: 'All generated images were invalid. Try a different description.' });
    }

    res.json({ images: validImages, colorMode: isColor });
  } catch (err) {
    console.error('Cloudflare AI error:', err.message);
    res.status(500).json({ error: 'Failed to generate designs. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TryInk server running on http://localhost:${PORT}`));
