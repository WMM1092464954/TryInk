// Cloudflare Pages Function — POST /api/generate
// Environment variables: CF_ACCOUNT_ID, CF_API_TOKEN

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

const COLOR_STYLES = new Set(['watercolor', 'neo-traditional', 'realistic']);

// Rate limiting via KV or in-memory (per-isolate)
const rateMap = new Map();

function checkRate(ip) {
  const now = Date.now();
  if (!rateMap.has(ip)) rateMap.set(ip, []);
  const hits = rateMap.get(ip).filter(t => now - t < 60000);
  if (hits.length >= 30) return false;
  hits.push(now);
  rateMap.set(ip, hits);
  return true;
}

async function generateOne(apiUrl, apiToken, fullPrompt, seed, numSteps) {
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
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

  const buffer = await resp.arrayBuffer();
  return buffer;
}

function isValidImage(buffer) {
  if (buffer.byteLength < 5000) return false;
  const head = new Uint8Array(buffer)[0];
  if (head !== 0xFF && head !== 0x89) return false;
  return true;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Rate limit
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkRate(ip)) {
    return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const { prompt, style } = await request.json();

  if (!prompt || !style) {
    return Response.json({ error: 'prompt and style are required' }, { status: 400 });
  }

  const accountId = env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return Response.json({ error: 'Cloudflare API not configured.' }, { status: 500 });
  }

  const cfModel = '@cf/bytedance/stable-diffusion-xl-lightning';
  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`;

  const styleHint = STYLE_PROMPTS[style] || '';
  const isColor = COLOR_STYLES.has(style);
  const fullPrompt = isColor
    ? `tattoo design of ${prompt}, ${styleHint}, on clean white background, centered, single isolated design, organic natural shape, lots of white space around the design, no square composition, no filling the entire canvas, no background`
    : `vector tattoo design of ${prompt}, ${styleHint}, solid black ink on pure white background, flat design, thick bold outlines, clean, simple, centered, single isolated design, organic natural shape, round or irregular edges, lots of white space around the design, no square composition, no filling the entire canvas, no background`;

  try {
    const baseSeed = Math.floor(Math.random() * 1000000);
    const steps = (style === 'realistic') ? 15 : 10;
    const promises = Array.from({ length: 8 }, (_, i) =>
      generateOne(apiUrl, apiToken, fullPrompt, baseSeed + i * 1000, steps).catch(() => null)
    );

    const buffers = await Promise.all(promises);
    const validImages = buffers
      .filter(b => b && isValidImage(b))
      .slice(0, 4)
      .map(b => `data:image/png;base64,${arrayBufferToBase64(b)}`);

    if (validImages.length === 0) {
      return Response.json({ error: 'All generated images were invalid. Try a different description.' }, { status: 500 });
    }

    return Response.json({ images: validImages, colorMode: isColor });
  } catch (err) {
    console.error('Cloudflare AI error:', err.message);
    return Response.json({ error: 'Failed to generate designs. Please try again.' }, { status: 500 });
  }
}
