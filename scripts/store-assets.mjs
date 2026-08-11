#!/usr/bin/env node
/*
 * Regenerate the brand store graphics into store-assets/ from the committed
 * design sources (assets/ + dist/). Screenshots are NOT generated here — those
 * are captured manually and kept out of git.
 *
 *   node scripts/store-assets.mjs
 *
 * Outputs (all 24-bit PNG, no alpha):
 *   store-assets/icon-128.png                 store icon (128x128)
 *   store-assets/promo-small-440x280.png      Chrome small promo tile
 *   store-assets/promo-marquee-1400x560.png   Chrome marquee tile
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'store-assets');
mkdirSync(out, { recursive: true });

const CREAM = '#F4EDE3', NAVY = '#2B2B36';
const font = opentype.parse(readFileSync('/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf').buffer);

function textSvg(str, color, opacity = 1) {
    const p = font.getPath(str, 0, 0, 100);
    const b = p.getBoundingBox();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x1} ${b.y1} ${b.x2 - b.x1} ${b.y2 - b.y1}"><path d="${p.toPathData(2)}" fill="${color}" opacity="${opacity}"/></svg>`;
}
const png = (buf) => sharp(buf).png();
async function wordmark(h) {
    const logo = readFileSync(resolve(root, 'dist/options/assets/inbundly-logo.svg'), 'utf8').replace(/currentColor/g, NAVY);
    return sharp(Buffer.from(logo), { density: 600 }).resize({ height: h }).png().toBuffer();
}
async function tagline(str, h) {
    return sharp(Buffer.from(textSvg(str, NAVY, 0.72)), { density: 96 }).resize({ height: h }).png().toBuffer();
}
const icon = (side) => sharp(resolve(root, 'assets/b_3.png'), { limitInputPixels: false }).resize(side, side).png().toBuffer();
const meta = (b) => sharp(b).metadata();

// Store icon 128 (no alpha)
await sharp(resolve(root, 'dist/icons/inbundly-dark-128.png')).resize(128, 128).flatten({ background: NAVY }).png().toFile(resolve(out, 'icon-128.png'));

// Small promo tile 440x280
{
    const W = 440, H = 280;
    const [ic, wm, tg] = [await icon(128), await wordmark(40), await tagline('Inbox bundles for Gmail', 18)];
    const [wmM, tgM] = [await meta(wm), await meta(tg)];
    await sharp({ create: { width: W, height: H, channels: 3, background: CREAM } }).composite([
        { input: ic, left: Math.round((W - 128) / 2), top: 44 },
        { input: wm, left: Math.round((W - wmM.width) / 2), top: 190 },
        { input: tg, left: Math.round((W - tgM.width) / 2), top: 190 + wmM.height + 12 },
    ]).flatten({ background: CREAM }).removeAlpha().png().toFile(resolve(out, 'promo-small-440x280.png'));
}

// Marquee 1400x560
{
    const W = 1400, H = 560;
    const [ic, wm, tg] = [await icon(300), await wordmark(120), await tagline('Google Inbox-style bundles for Gmail — and more.', 40)];
    const wmM = await meta(wm);
    const iconX = 170, textX = iconX + 300 + 70, top = Math.round((H - (120 + 30 + 40)) / 2);
    await sharp({ create: { width: W, height: H, channels: 3, background: CREAM } }).composite([
        { input: ic, left: iconX, top: Math.round((H - 300) / 2) },
        { input: wm, left: textX, top },
        { input: tg, left: textX + 4, top: top + wmM.height + 28 },
    ]).flatten({ background: CREAM }).removeAlpha().png().toFile(resolve(out, 'promo-marquee-1400x560.png'));
}

console.log('✓ store-assets: icon-128, promo-small-440x280, promo-marquee-1400x560');
