// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// Clip recorder: a deterministic screenshot sequence encoded with ffmpeg.
//
// Each frame is a real screenshot of the page(s) at DPR 2. The timeline moves
// the mouse (Playwright input, so hover states are real) and clicks; a click
// takes no clip time, and the extension's repaint is captured on the next
// frame. Frames are downscaled with Lanczos and encoded to WebM (VP9) for the
// extension and MP4 (H.264) for the site.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const FPS = 24;

function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

class ClipRecorder {
    /**
     * panels: [{ page, css: { x, y }, clip? }] laid side by side, each
     * screenshotted at DPR 2 (optionally cropped to `clip`, CSS px) and placed
     * at its CSS offset in the frame.
     */
    constructor({ name, panels, width, height, frameDir }) {
        this.name = name;
        this.panels = panels;
        this.width = width;
        this.height = height;
        this.frameDir = frameDir;
        this.frames = 0;
        this.last = null;
        this.mouse = new Map();
        fs.rmSync(frameDir, { recursive: true, force: true });
        fs.mkdirSync(frameDir, { recursive: true });
    }

    async capture() {
        const composites = [];
        for (const panel of this.panels) {
            // `clip` (CSS px) crops a page that is taller than its panel.
            const buf = await panel.page.screenshot({ type: 'png', clip: panel.clip });
            composites.push({ input: buf, left: panel.css.x * 2, top: panel.css.y * 2 });
        }
        if (composites.length === 1 && composites[0].left === 0 && composites[0].top === 0) {
            return composites[0].input;
        }
        return sharp({
            create: { width: this.width * 2, height: this.height * 2, channels: 3, background: '#ffffff' },
        }).composite(composites).png().toBuffer();
    }

    async write(buf) {
        fs.writeFileSync(path.join(this.frameDir, String(this.frames).padStart(4, '0') + '.png'), buf);
        this.frames += 1;
    }

    /** One fresh frame. */
    async frame() {
        this.last = await this.capture();
        await this.write(this.last);
    }

    /** Hold the current picture until `seconds` into the clip. */
    async holdUntil(seconds) {
        if (!this.last) {
            await this.frame();
        }
        while (this.frames < Math.round(seconds * FPS)) {
            await this.write(this.last);
        }
    }

    /** Glide the mouse on `page` to (x, y) CSS px, arriving at `seconds`. */
    async moveTo(page, x, y, seconds) {
        const from = this.mouse.get(page) || { x, y };
        const startFrame = this.frames;
        const endFrame = Math.round(seconds * FPS);
        const n = Math.max(1, endFrame - startFrame);
        for (let i = 1; i <= n; i++) {
            const k = easeInOut(i / n);
            await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
            await this.frame();
        }
        this.mouse.set(page, { x, y });
    }

    /** Put the mouse somewhere without spending clip time. */
    async place(page, x, y) {
        await page.mouse.move(x, y);
        this.mouse.set(page, { x, y });
    }

    /** Click at the mouse position, then let the extension repaint. */
    async click(page, settleMs = 700) {
        const at = this.mouse.get(page);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(settleMs);
        // Re-assert the pointer position so hover follows a repainted list.
        await page.mouse.move(at.x + 0.01, at.y);
        await page.mouse.move(at.x, at.y);
        await page.waitForTimeout(60);
        await this.frame();
    }

    /** Crossfade from the current picture back to frame 0 over `seconds`. */
    async crossfadeToStart(seconds) {
        const first = fs.readFileSync(path.join(this.frameDir, '0000.png'));
        const a = await sharp(this.last).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const b = await sharp(first).removeAlpha().raw().toBuffer();
        const n = Math.round(seconds * FPS);
        for (let i = 1; i <= n; i++) {
            const k = i / (n + 1);
            const out = Buffer.alloc(a.data.length);
            for (let p = 0; p < out.length; p++) {
                out[p] = Math.round(a.data[p] * (1 - k) + b[p] * k);
            }
            const png = await sharp(out, { raw: a.info }).png().toBuffer();
            await this.write(png);
        }
    }

    /**
     * Encode frames to <out>/<name>.webm (VP9, the in-extension format),
     * <name>.mp4 (H.264, site fallback) and <name>-poster.png (frame 0, also
     * the loop point).
     */
    encode(outDir, { crf = 30 } = {}) {
        const input = path.join(this.frameDir, '%04d.png');
        const scale = `scale=${this.width}:${this.height}:flags=lanczos,format=yuv420p`;
        const webm = path.join(outDir, `${this.name}.webm`);
        const mp4 = path.join(outDir, `${this.name}.mp4`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', input,
            '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0',
            '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1', '-g', String(FPS * 10),
            '-an', webm]);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', input,
            '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'stillimage',
            '-movflags', '+faststart', '-an', mp4]);
        return sharp(path.join(this.frameDir, '0000.png'))
            .resize(this.width, this.height, { kernel: 'lanczos3' })
            .removeAlpha()
            .png({ compressionLevel: 9 })
            .toFile(path.join(outDir, `${this.name}-poster.png`))
            .then(() => ({ webm, mp4 }));
    }
}

module.exports = { ClipRecorder, FPS };
