// Renders the PWA icon set into public/ from an inline SVG design.
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });

// Globe with a check mark. `pad` shrinks content into the maskable safe zone.
function iconSvg({ rx, pad }) {
  const s = pad ? 0.72 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rx}" fill="#0b1220"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <circle cx="256" cy="256" r="168" fill="#0e1930" stroke="#38bdf8" stroke-width="16"/>
    <path d="M88 256h336" stroke="#38bdf8" stroke-width="10" fill="none"/>
    <ellipse cx="256" cy="256" rx="80" ry="168" stroke="#38bdf8" stroke-width="10" fill="none"/>
    <path d="M150 180q40-36 90-20t80-16" stroke="#1e5a8a" stroke-width="26" stroke-linecap="round" fill="none" opacity="0.8"/>
    <path d="M170 330q50 26 100 8" stroke="#1e5a8a" stroke-width="26" stroke-linecap="round" fill="none" opacity="0.8"/>
    <path d="M182 262l56 60 108-128" stroke="#0ca30c" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

const normal = Buffer.from(iconSvg({ rx: 100, pad: false }));
const maskable = Buffer.from(iconSvg({ rx: 0, pad: true }));

writeFileSync(join(pub, 'favicon.svg'), iconSvg({ rx: 100, pad: false }));

await sharp(normal).resize(192, 192).png().toFile(join(pub, 'pwa-192.png'));
await sharp(normal).resize(512, 512).png().toFile(join(pub, 'pwa-512.png'));
await sharp(normal).resize(180, 180).png().toFile(join(pub, 'apple-touch-icon.png'));
await sharp(maskable).resize(512, 512).png().toFile(join(pub, 'pwa-maskable-512.png'));

console.log('Icons written to public/.');
