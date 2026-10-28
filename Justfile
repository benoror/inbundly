# Inbundly tasks — run `just <recipe>` (https://github.com/casey/just)

# Build dist/content.js
build:
    npm run build

# Rebuild on save
watch:
    npm run watch

# Run the Jest suite
test:
    npm test

# Build store-ready ZIPs for every store (Chrome, Firefox, Edge) → packages/
package:
    node scripts/package.mjs

# Build just one store's ZIP
package-chrome:
    node scripts/package.mjs chrome
package-firefox:
    node scripts/package.mjs firefox
package-edge:
    node scripts/package.mjs edge

# Regenerate the store icons → store-assets/chrome/icon-128.png, store-assets/edge/logo-300.png
store-assets:
    node scripts/store-assets.mjs
