require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const CF_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;

const DESIGNS_DIR = path.join(__dirname, 'designs');
const CATALOG_PATH = path.join(__dirname, 'data', 'library-catalog.json');

// Design definitions: { prompt, style, bodyPart, tags }
const DESIGN_DEFS = [
  // Minimalist
  { prompt: 'small crescent moon', style: 'minimalist', bodyPart: 'wrist', tags: ['moon', 'celestial'] },
  { prompt: 'tiny heart outline', style: 'minimalist', bodyPart: 'wrist', tags: ['heart', 'love'] },
  { prompt: 'small paper airplane', style: 'minimalist', bodyPart: 'ankle', tags: ['travel', 'freedom'] },
  // Fine Line
  { prompt: 'delicate rose with stem', style: 'fine-line', bodyPart: 'arm', tags: ['rose', 'flower'] },
  { prompt: 'butterfly with detailed wings', style: 'fine-line', bodyPart: 'shoulder', tags: ['butterfly', 'nature'] },
  { prompt: 'constellation of stars connected by lines', style: 'fine-line', bodyPart: 'back', tags: ['stars', 'celestial'] },
  // Traditional
  { prompt: 'eagle with spread wings', style: 'traditional', bodyPart: 'chest', tags: ['eagle', 'bird', 'freedom'] },
  { prompt: 'anchor with rope', style: 'traditional', bodyPart: 'arm', tags: ['anchor', 'nautical'] },
  { prompt: 'classic skull with roses', style: 'traditional', bodyPart: 'arm', tags: ['skull', 'rose'] },
  // Blackwork
  { prompt: 'mandala circle pattern', style: 'blackwork', bodyPart: 'back', tags: ['mandala', 'geometric'] },
  { prompt: 'tree of life silhouette', style: 'blackwork', bodyPart: 'arm', tags: ['tree', 'nature'] },
  { prompt: 'wolf head silhouette', style: 'blackwork', bodyPart: 'chest', tags: ['wolf', 'animal'] },
  // Japanese
  { prompt: 'koi fish swimming upstream', style: 'japanese', bodyPart: 'arm', tags: ['koi', 'fish'] },
  { prompt: 'cherry blossom branch', style: 'japanese', bodyPart: 'shoulder', tags: ['cherry blossom', 'flower'] },
  { prompt: 'dragon coiling', style: 'japanese', bodyPart: 'back', tags: ['dragon', 'mythical'] },
  // Watercolor
  { prompt: 'hummingbird in flight', style: 'watercolor', bodyPart: 'shoulder', tags: ['bird', 'nature'] },
  { prompt: 'watercolor phoenix rising', style: 'watercolor', bodyPart: 'back', tags: ['phoenix', 'mythical'] },
  { prompt: 'abstract watercolor feather', style: 'watercolor', bodyPart: 'arm', tags: ['feather', 'abstract'] },
  // Dotwork
  { prompt: 'geometric elephant', style: 'dotwork', bodyPart: 'arm', tags: ['elephant', 'animal'] },
  { prompt: 'sacred geometry flower of life', style: 'dotwork', bodyPart: 'back', tags: ['sacred geometry', 'spiritual'] },
  { prompt: 'dotwork sun and moon', style: 'dotwork', bodyPart: 'chest', tags: ['sun', 'moon', 'celestial'] },
  // Realistic
  { prompt: 'realistic lion portrait', style: 'realistic', bodyPart: 'arm', tags: ['lion', 'animal', 'portrait'] },
  { prompt: 'realistic compass with map', style: 'realistic', bodyPart: 'chest', tags: ['compass', 'travel'] },
  { prompt: 'realistic eye with reflection', style: 'realistic', bodyPart: 'arm', tags: ['eye', 'portrait'] },
  // Neo-Traditional
  { prompt: 'fox head with flowers', style: 'neo-traditional', bodyPart: 'arm', tags: ['fox', 'animal', 'flower'] },
  { prompt: 'owl perched on branch', style: 'neo-traditional', bodyPart: 'chest', tags: ['owl', 'bird'] },
  { prompt: 'snake wrapped around dagger', style: 'neo-traditional', bodyPart: 'arm', tags: ['snake', 'dagger'] },
  // Tribal
  { prompt: 'tribal armband pattern', style: 'tribal', bodyPart: 'arm', tags: ['band', 'pattern'] },
  { prompt: 'tribal turtle', style: 'tribal', bodyPart: 'shoulder', tags: ['turtle', 'animal'] },
  { prompt: 'tribal sun design', style: 'tribal', bodyPart: 'back', tags: ['sun', 'celestial'] },
  // Geometric
  { prompt: 'geometric wolf head', style: 'geometric', bodyPart: 'arm', tags: ['wolf', 'animal'] },
  { prompt: 'geometric mountain landscape', style: 'geometric', bodyPart: 'arm', tags: ['mountain', 'nature'] },
  { prompt: 'geometric arrow compass', style: 'geometric', bodyPart: 'wrist', tags: ['arrow', 'compass'] },
];

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

async function generateOne(prompt, style) {
  const styleHint = STYLE_PROMPTS[style] || '';
  const isColor = COLOR_STYLES.has(style);
  const fullPrompt = isColor
    ? `tattoo design of ${prompt}, ${styleHint}, on clean white background, centered, single isolated design, lots of white space, no background`
    : `vector tattoo design of ${prompt}, ${styleHint}, solid black ink on pure white background, flat design, centered, single isolated design, lots of white space, no background`;

  const steps = style === 'realistic' ? 15 : 10;
  const seed = Math.floor(Math.random() * 1000000);

  const resp = await fetch(CF_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: fullPrompt,
      negative_prompt: 'square shape, rectangular, filling entire frame, noise, text, watermark, person, skin, blurry, bad quality, deformed',
      width: 512, height: 512,
      num_steps: steps, guidance: 10, seed
    })
  });

  if (!resp.ok) throw new Error(`API ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function main() {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN in .env');
    process.exit(1);
  }

  const catalog = [];
  const total = DESIGN_DEFS.length;

  for (let i = 0; i < total; i++) {
    const def = DESIGN_DEFS[i];
    const id = String(i + 1).padStart(3, '0');
    const filename = `${id}.png`;
    const filepath = path.join(DESIGNS_DIR, filename);

    // Skip if already generated
    if (fs.existsSync(filepath)) {
      console.log(`[${i + 1}/${total}] Skip (exists): ${def.prompt}`);
      catalog.push({
        id, title: def.prompt, style: def.style,
        bodyPart: def.bodyPart, tags: def.tags,
        image: `/designs/${filename}`,
        colorMode: COLOR_STYLES.has(def.style)
      });
      continue;
    }

    console.log(`[${i + 1}/${total}] Generating: ${def.prompt} (${def.style})...`);
    try {
      const buffer = await generateOne(def.prompt, def.style);
      fs.writeFileSync(filepath, buffer);
      catalog.push({
        id, title: def.prompt, style: def.style,
        bodyPart: def.bodyPart, tags: def.tags,
        image: `/designs/${filename}`,
        colorMode: COLOR_STYLES.has(def.style)
      });
      console.log(`  -> saved ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
    } catch (err) {
      console.error(`  -> FAILED: ${err.message}`);
    }

    // Rate limit: small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`\nDone! ${catalog.length} designs in catalog.`);
}

main();
