// Playwright config for the e2e suite (see TESTING.md).
// The suite launches its own persistent contexts with the unpacked extension,
// so there is no shared `use.browserName` project here.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    // Each spec launches its own browser context with the extension; keep
    // workers low so CI runners don't thrash.
    workers: process.env.CI ? 2 : undefined,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['github']] : 'list',
});
