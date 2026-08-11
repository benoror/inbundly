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

# Build store-ready ZIPs for both stores → packages/
package:
    node scripts/package.mjs

# Build just one store's ZIP
package-chrome:
    node scripts/package.mjs chrome
package-firefox:
    node scripts/package.mjs firefox
