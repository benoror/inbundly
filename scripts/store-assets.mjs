#!/usr/bin/env node
/*
 * Regenerate the Chrome Web Store icon into store-assets/chrome/ from the
 * committed extension icon in dist/icons/.
 *
 *   node scripts/store-assets.mjs
 *
 * Output (24-bit PNG, no alpha):
 *   store-assets/chrome/icon-128.png   store icon (128x128)
 *
 * The rest of store-assets/ is not generated here:
 *   store-assets/chrome/    captioned 1280x800 screenshots, promo tile 440x280,
 *                           marquee 1400x560 (Hero B)
 *   store-assets/firefox/   the same screenshots without captions
 *   store-assets/brand/     logo and icon design sources, old README banner,
 *                           GitHub social preview (Hero A, 1280x640)
 *   store-assets/clips/     short loops (WebM, MP4, poster)
 * The screenshots and clips come from marketing/render (see its README); the
 * captions, heroes, and promo art were composed from those renders outside
 * the repo. The site's own images live in docs/assets/.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'store-assets/chrome');
mkdirSync(out, { recursive: true });

const NAVY = '#2B2B36';

// Store icon 128 (no alpha)
await sharp(resolve(root, 'dist/icons/inbundly-dark-128.png')).resize(128, 128).flatten({ background: NAVY }).png().toFile(resolve(out, 'icon-128.png'));

console.log('✓ store-assets/chrome/icon-128.png');
