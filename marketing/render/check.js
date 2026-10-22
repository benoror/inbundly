#!/usr/bin/env node
// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// Check every rendered asset against the visuals plan: pixel size, file
// size, no alpha / no color profile on store PNGs, clip codec, length, loop
// point, and the 1.2 MB in-extension clip budget. Exits non-zero on a miss.
//
//   node marketing/render/check.js [dir]   (default /workspace/inbundly-store-assets)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const DIR = path.resolve(process.argv[2] || process.env.RENDER_OUT || '/workspace/inbundly-store-assets');
const MB = 1024 * 1024;

const STORE = { width: 1280, height: 800, maxBytes: 1 * MB, alpha: false };
const POSTER = { width: 960, height: 600, maxBytes: 1 * MB, alpha: false };
const EXPECT = {
    's1-inbox-bundles-light.png': STORE,
    's2-sender-glance-dark.png': STORE,
    's3-starred-popout-light.png': STORE,
    's4-archive-skips-starred-dark.png': STORE,
    's5-options-light.png': STORE,
    's-alt-k-keyboard-dark.png': STORE,
    's-alt-v-search-light.png': STORE,
    'hero-a-raw-unbundled-light.png': { width: 1100, height: 900, maxBytes: 1 * MB, alpha: false },
    'hero-a-raw-bundled-light.png': { width: 1100, height: 900, maxBytes: 1 * MB, alpha: false },
    'tile-raw-row-travel.png': { width: 2400, alpha: true },
    'tile-raw-row-receipts.png': { width: 2400, alpha: true },
    'tile-raw-row-family.png': { width: 2400, alpha: true },
};
const CLIPS = [
    'c1-starred-popout',
    'c2-heading-archive-skips-starred',
    'c3-label-combinations',
    'c4-sender-bundles',
];
for (const c of CLIPS) {
    EXPECT[`${c}-poster.png`] = POSTER;
}

const problems = [];
const rows = [];
const kb = n => (n / 1024).toFixed(1) + ' KB';

function probe(file) {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt:format=duration',
        '-of', 'json', file]).toString();
    const j = JSON.parse(out);
    return { ...j.streams[0], duration: Number(j.format.duration) };
}

async function frameDiff(file, duration) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inbundly-check-'));
    const a = path.join(tmp, 'first.png');
    const b = path.join(tmp, 'last.png');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-frames:v', '1', a]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.05', '-i', file, '-frames:v', '1', '-update', '1', b]);
    const [x, y] = await Promise.all([a, b].map(f => sharp(f).removeAlpha().raw().toBuffer()));
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
        sum += Math.abs(x[i] - y[i]);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    return sum / x.length;   // mean abs difference per channel, 0..255
}

(async () => {
    for (const [file, want] of Object.entries(EXPECT)) {
        const p = path.join(DIR, file);
        if (!fs.existsSync(p)) {
            problems.push(`${file}: missing`);
            continue;
        }
        const meta = await sharp(p).metadata();
        const bytes = fs.statSync(p).size;
        rows.push([file, `${meta.width}x${meta.height}`, kb(bytes),
            `${meta.channels}ch${meta.hasAlpha ? ' alpha' : ''}${meta.icc ? ' ICC' : ''}`]);
        if (want.width && meta.width !== want.width) {
            problems.push(`${file}: width ${meta.width}, want ${want.width}`);
        }
        if (want.height && meta.height !== want.height) {
            problems.push(`${file}: height ${meta.height}, want ${want.height}`);
        }
        if (want.maxBytes && bytes > want.maxBytes) {
            problems.push(`${file}: ${kb(bytes)} over ${kb(want.maxBytes)}`);
        }
        if (want.alpha === false && meta.hasAlpha) {
            problems.push(`${file}: has an alpha channel`);
        }
        if (want.alpha === true && !meta.hasAlpha) {
            problems.push(`${file}: no alpha channel`);
        }
        if (meta.icc) {
            problems.push(`${file}: embedded color profile`);
        }
        if (meta.format !== 'png') {
            problems.push(`${file}: not a PNG`);
        }
    }

    let webmTotal = 0;
    for (const c of CLIPS) {
        for (const ext of ['webm', 'mp4']) {
            const file = `${c}.${ext}`;
            const p = path.join(DIR, file);
            if (!fs.existsSync(p)) {
                problems.push(`${file}: missing`);
                continue;
            }
            const bytes = fs.statSync(p).size;
            const s = probe(p);
            const diff = await frameDiff(p, s.duration);
            rows.push([file, `${s.width}x${s.height}`, kb(bytes),
                `${s.codec_name} ${s.r_frame_rate}fps ${s.duration.toFixed(2)}s loop-diff ${diff.toFixed(2)}`]);
            const codec = ext === 'webm' ? 'vp9' : 'h264';
            if (s.codec_name !== codec) {
                problems.push(`${file}: codec ${s.codec_name}, want ${codec}`);
            }
            if (s.width !== 960 || s.height !== 600) {
                problems.push(`${file}: ${s.width}x${s.height}, want 960x600`);
            }
            if (s.duration < 4 || s.duration > 7.01) {
                problems.push(`${file}: ${s.duration}s, want 4 to 7 s`);
            }
            // Last frame must match frame 0 for a seamless loop (C2 ends
            // inside its crossfade, a step short of frame 0).
            if (diff > 3) {
                problems.push(`${file}: last frame differs from frame 0 (${diff.toFixed(2)})`);
            }
            if (ext === 'webm') {
                webmTotal += bytes;
                if (bytes > 400 * 1024) {
                    problems.push(`${file}: ${kb(bytes)} over the 400 KB per-clip cap`);
                }
            }
        }
    }
    rows.push(['WebM total (in-extension)', '', kb(webmTotal), 'budget 1.2 MB']);
    if (webmTotal > 1.2 * MB) {
        problems.push(`WebM total ${kb(webmTotal)} over 1.2 MB`);
    }

    const extra = fs.readdirSync(DIR).filter(f => !EXPECT[f] && !CLIPS.some(c => f === `${c}.webm` || f === `${c}.mp4`));
    const w = [0, 0, 0];
    rows.forEach(r => r.slice(0, 3).forEach((c, i) => { w[i] = Math.max(w[i], c.length); }));
    for (const r of rows) {
        console.log(`${r[0].padEnd(w[0])}  ${r[1].padEnd(w[1])}  ${r[2].padStart(w[2])}  ${r[3]}`);
    }
    if (extra.length) {
        console.log(`\nnot in the spec list: ${extra.join(', ')}`);
    }
    if (problems.length) {
        console.log('\nPROBLEMS:\n  ' + problems.join('\n  '));
        process.exit(1);
    }
    console.log('\nall checks pass');
})();
