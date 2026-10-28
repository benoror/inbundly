#!/usr/bin/env node
/*
 * Regenerate the store icons: the Chrome Web Store icon from the committed
 * extension icon in dist/icons/, and the Microsoft Edge Add-ons logo from the
 * vector brand mark in store-assets/brand/.
 *
 *   node scripts/store-assets.mjs
 *
 * Output (24-bit PNG, no alpha):
 *   store-assets/chrome/icon-128.png   store icon (128x128)
 *   store-assets/edge/logo-300.png     Edge Add-ons logo (300x300)
 *
 * The rest of store-assets/ is not generated here:
 *   store-assets/chrome/    captioned 1280x800 screenshots, promo tile 440x280,
 *                           marquee 1400x560 (Hero B)
 *   store-assets/firefox/   the same screenshots without captions
 *   (Edge Add-ons reuses the store-assets/chrome/ screenshots and tiles.)
 *   store-assets/brand/     logo and icon design sources, old README banner,
 *                           GitHub social preview (Hero A, 1280x640)
 *   store-assets/clips/     short loops (WebM, MP4, poster)
 * The screenshots and clips come from marketing/render (see its README); the
 * captions, heroes, and promo art were composed from those renders outside
 * the repo. The site's own images live in docs/assets/.
 */
import { mkdirSync, readFileSync } from 'node:fs';
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

// Edge Add-ons logo 300x300 (1:1, no alpha). b_3.svg is the same mark as the
// extension icon, drawn as a solid square with the artwork cut out: fill the
// square navy and let the cream show through the cut-outs.
const CREAM = '#E9E3D7';
const edgeOut = resolve(root, 'store-assets/edge');
mkdirSync(edgeOut, { recursive: true });
const mark = readFileSync(resolve(root, 'store-assets/brand/b_3.svg'), 'utf8').replace('fill="#000000"', `fill="${NAVY}"`);
await sharp(Buffer.from(mark), { density: 300 }).resize(300, 300).flatten({ background: CREAM }).png().toFile(resolve(edgeOut, 'logo-300.png'));
console.log('✓ store-assets/edge/logo-300.png');
