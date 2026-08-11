#!/usr/bin/env node
/*
 * Build store-ready extension packages from dist/.
 *
 *   node scripts/package.mjs            # both targets
 *   node scripts/package.mjs chrome     # one target
 *   node scripts/package.mjs firefox
 *
 * The committed dist/manifest.json keeps `key` (pins the unpacked-dev extension
 * ID for chrome.storage.sync — see CLAUDE.md). The stores each need a different
 * manifest, so we transform a copy per target instead of touching dist/:
 *   - Chrome Web Store rejects `key` (it assigns the ID) — strip it.
 *   - Firefox AMO (MV3) needs a background.scripts fallback next to
 *     service_worker — add it, and keep browser_specific_settings.gecko.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const outDir = resolve(root, 'packages');
const stage = resolve(root, '.package-stage');

const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
const version = manifest.version;

const targets = {
    // Chrome Web Store: no `key` (store assigns the ID); drop Firefox-only settings.
    chrome(m) {
        delete m.key;
        delete m.browser_specific_settings;
    },
    // Firefox AMO: no `key`; MV3 event-page fallback alongside the service worker.
    firefox(m) {
        delete m.key;
        m.background = { service_worker: 'background.js', scripts: ['background.js'] };
    },
};

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(targets);
for (const name of names) {
    if (!targets[name]) {
        console.error(`Unknown target "${name}". Valid: ${Object.keys(targets).join(', ')}`);
        process.exit(1);
    }
}

console.log('• building content.js …');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

mkdirSync(outDir, { recursive: true });
for (const name of names) {
    const src = resolve(stage, name);
    rmSync(src, { recursive: true, force: true });
    cpSync(dist, src, { recursive: true });

    const m = JSON.parse(JSON.stringify(manifest));
    targets[name](m);
    writeFileSync(resolve(src, 'manifest.json'), JSON.stringify(m, null, 4) + '\n');

    const zip = resolve(outDir, `inbundly-${version}-${name}.zip`);
    rmSync(zip, { force: true });
    // Zip the *contents* so manifest.json sits at the archive root (stores require this).
    execSync(`zip -r -X "${zip}" . -x '*/.DS_Store' -x '.DS_Store'`, { cwd: src, stdio: 'ignore' });
    console.log(`✓ ${name}\t→ packages/inbundly-${version}-${name}.zip`);
}
rmSync(stage, { recursive: true, force: true });
console.log(`\nDone (v${version}). Upload the ZIPs from packages/.`);
