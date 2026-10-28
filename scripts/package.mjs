#!/usr/bin/env node
/*
 * Build store-ready extension packages from dist/.
 *
 *   node scripts/package.mjs            # every target
 *   node scripts/package.mjs chrome     # one target
 *   node scripts/package.mjs firefox
 *   node scripts/package.mjs edge
 *
 * The committed dist/manifest.json keeps `key` (pins the unpacked-dev extension
 * ID for chrome.storage.sync — see CLAUDE.md). The stores each need a different
 * manifest, so we transform a copy per target instead of touching dist/:
 *   - Chrome Web Store rejects `key` (it assigns the ID) — strip it.
 *   - Firefox AMO keeps browser_specific_settings.gecko (add-on ID and the
 *     data_collection_permissions declaration).
 *   - Microsoft Edge Add-ons takes the Chrome package as is: no `key`, no
 *     `update_url`, no Firefox-only settings, and no "Chrome" in the name or
 *     description (Microsoft's port guide).
 *
 * Archives are written with the `zip` CLI when it is on PATH, otherwise with a
 * small built-in writer (node:zlib deflate), so packaging needs no extra tools.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
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
    // Firefox AMO: no `key` (AMO uses browser_specific_settings.gecko.id).
    firefox(m) {
        delete m.key;
    },
    // Microsoft Edge Add-ons: same package as Chrome (Partner Center assigns the ID).
    edge(m) {
        delete m.key;
        delete m.update_url;
        delete m.browser_specific_settings;
    },
};

function hasZipCli() {
    try {
        execSync('zip -v', { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = resolve(dir, entry.name);
        if (entry.name === '.DS_Store') return [];
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}

// Minimal ZIP writer: deflated entries, no extra fields, fixed 1980 timestamps
// so rebuilding the same tree gives the same bytes.
function writeZip(srcDir, zipPath) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of listFiles(srcDir).sort()) {
        const name = Buffer.from(relative(srcDir, file).split(sep).join('/'));
        const data = readFileSync(file);
        const packed = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);           // version needed
        local.writeUInt16LE(0x0800, 6);       // UTF-8 names
        local.writeUInt16LE(8, 8);            // deflate
        local.writeUInt16LE(0, 10);           // time
        local.writeUInt16LE(0x21, 12);        // date: 1980-01-01
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);         // version made by
        local.copy(central, 6, 4, 30);        // shared header fields
        central.writeUInt16LE(0, 32);         // comment length
        central.writeUInt16LE(0, 34);         // disk number
        central.writeUInt16LE(0, 36);         // internal attributes
        central.writeUInt32LE(0, 38);         // external attributes
        central.writeUInt32LE(offset, 42);
        locals.push(local, name, packed);
        centrals.push(central, name);
        offset += local.length + name.length + packed.length;
    }
    const centralSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(centrals.length / 2, 8);
    end.writeUInt16LE(centrals.length / 2, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    writeFileSync(zipPath, Buffer.concat([...locals, ...centrals, end]));
}

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

const useZipCli = hasZipCli();
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
    if (useZipCli) {
        execSync(`zip -r -X "${zip}" . -x '*/.DS_Store' -x '.DS_Store'`, { cwd: src, stdio: 'ignore' });
    }
    else {
        writeZip(src, zip);
    }
    console.log(`✓ ${name}\t→ packages/inbundly-${version}-${name}.zip`);
}
rmSync(stage, { recursive: true, force: true });
console.log(`\nDone (v${version}). Upload the ZIPs from packages/.`);
