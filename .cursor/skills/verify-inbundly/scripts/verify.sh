#!/usr/bin/env bash
# Inbundly verification runner (see ../SKILL.md).
#
#   scripts/verify.sh launch              build the extension, install what is missing
#   scripts/verify.sh doctor              read-only checks + a 2-thread load probe
#   scripts/verify.sh drive <feature>     walk one feature, then run its Playwright spec
#   scripts/verify.sh cleanup [RUN_ID]    remove scratch state of a run; evidence stays
#   scripts/verify.sh features            list the mapped features
#
# Every run has a RUN_ID (env RUN_ID, else the one `launch` minted, else a new
# timestamp). Evidence: <skill>/evidence/<RUN_ID>/. Scratch (Chromium
# profiles, Playwright temp): ${TMPDIR:-/tmp}/inbundly-verify/<RUN_ID>/.

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
EVIDENCE_ROOT="$SKILL_DIR/evidence"
SCRATCH_ROOT="${TMPDIR:-/tmp}/inbundly-verify"
CURRENT_RUN_FILE="$EVIDENCE_ROOT/.current-run"
EXPECTED_EXTENSION_ID="cpggdbckpaoikhddngoeepdedfkleiab"

FEATURES="core-bundling bundle-actions sender-bundles remember-open-bundle options-autosave"

# Run a command, mirror its output to the terminal and a log file (dropping
# Node's NO_COLOR/FORCE_COLOR warning noise), and return the command's own
# exit status rather than tee's.
run_logged() {
    local logfile="$1"
    shift
    local status
    set +e
    "$@" 2>&1 | grep -v -e NO_COLOR -e trace-warnings | tee "$logfile"
    status="${PIPESTATUS[0]}"
    set -e
    return "$status"
}

log()  { printf '%s\n' "$*"; }
ok()   { printf 'ok    %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; }
die()  { fail "$*"; exit 1; }

resolve_run_id() {
    if [ -n "${RUN_ID:-}" ]; then
        return
    fi
    if [ -f "$CURRENT_RUN_FILE" ]; then
        RUN_ID="$(cat "$CURRENT_RUN_FILE")"
    else
        RUN_ID="$(date +%Y%m%d-%H%M%S)"
    fi
}

run_dirs() {
    resolve_run_id
    EVIDENCE_DIR="$EVIDENCE_ROOT/$RUN_ID"
    SCRATCH_DIR="$SCRATCH_ROOT/$RUN_ID"
    mkdir -p "$EVIDENCE_DIR" "$SCRATCH_DIR"
    printf '%s' "$RUN_ID" > "$CURRENT_RUN_FILE"
}

# Chromium binary the harness will use (channel "chromium" needs the full
# build, not chromium-headless-shell).
chromium_path() {
    node -e "process.stdout.write(require('@playwright/test').chromium.executablePath())" 2>/dev/null || true
}

spec_for() {
    case "$1" in
        core-bundling)        echo "e2e/bundling.spec.js" ;;
        bundle-actions)       echo "e2e/bundle-actions.spec.js" ;;
        sender-bundles)       echo "e2e/sender-bundles.spec.js" ;;
        remember-open-bundle) echo "e2e/remember-open-bundle.spec.js" ;;
        options-autosave)     echo "e2e/bundle-actions.spec.js" ;;
        *) return 1 ;;
    esac
}

# Extra filters/suites per feature. options-autosave narrows the spec to the
# live storage flips and adds the jsdom options-page suite.
grep_for() {
    case "$1" in
        options-autosave) echo "flips live|in storage" ;;
        *) echo "" ;;
    esac
}
jest_for() {
    case "$1" in
        options-autosave) echo "test/OptionsPage.test.js test/Options.test.js" ;;
        *) echo "" ;;
    esac
}

cmd_launch() {
    run_dirs
    cd "$ROOT"
    log "RUN_ID=$RUN_ID"
    log "evidence: $EVIDENCE_DIR"
    log "scratch:  $SCRATCH_DIR"
    if [ ! -d node_modules/@playwright/test ]; then
        log "installing npm dependencies"
        npm install
    fi
    log "building dist/content.js"
    npm run build >"$EVIDENCE_DIR/build.log" 2>&1 || { cat "$EVIDENCE_DIR/build.log"; die "build failed (see $EVIDENCE_DIR/build.log)"; }
    local chromium
    chromium="$(chromium_path)"
    if [ -z "$chromium" ] || [ ! -x "$chromium" ]; then
        log "installing Playwright Chromium"
        npx playwright install chromium
    fi
    ok "ready: dist/content.js built; Chromium at $(chromium_path)"
    log "next: scripts/verify.sh doctor"
}

cmd_doctor() {
    run_dirs
    cd "$ROOT"
    local status=0
    log "RUN_ID=$RUN_ID (evidence: $EVIDENCE_DIR)"

    local node_major
    node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$node_major" -ge 20 ]; then ok "node $(node -v)"; else fail "node >= 20 required (CI uses 20); found $(node -v 2>/dev/null || echo none)"; status=1; fi

    if [ -d node_modules/@playwright/test ]; then ok "node_modules present (@playwright/test $(node -p 'require("@playwright/test/package.json").version'))"; else fail "node_modules missing: run scripts/verify.sh launch"; status=1; fi

    local chromium
    chromium="$(chromium_path)"
    if [ -n "$chromium" ] && [ -x "$chromium" ]; then ok "Playwright Chromium: $chromium"; else fail "Playwright Chromium missing: npx playwright install chromium (on a fresh Linux box: npx playwright install --with-deps chromium, needs sudo)"; status=1; fi

    if [ -f dist/content.js ]; then
        local stale
        stale="$(find src -type f -newer dist/content.js | head -n 3)"
        if [ -z "$stale" ]; then ok "dist/content.js is newer than every file in src/"; else fail "dist/content.js is stale (newer: $(echo "$stale" | tr '\n' ' ')): run scripts/verify.sh launch"; status=1; fi
    else
        fail "dist/content.js missing: run scripts/verify.sh launch"; status=1
    fi

    local pkg_version manifest_version
    pkg_version="$(node -p 'require("./package.json").version')"
    manifest_version="$(node -p 'require("./dist/manifest.json").version')"
    if [ "$pkg_version" = "$manifest_version" ]; then ok "version $pkg_version (package.json == dist/manifest.json)"; else fail "version mismatch: package.json $pkg_version vs dist/manifest.json $manifest_version"; status=1; fi

    local leftovers
    leftovers="$(find "$SCRATCH_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name "$RUN_ID" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$leftovers" = "0" ]; then ok "no scratch left from other runs under $SCRATCH_ROOT"; else log "note  $leftovers other run(s) left scratch under $SCRATCH_ROOT: scripts/verify.sh cleanup <RUN_ID> when they are not in use"; fi

    if [ "$status" -ne 0 ]; then
        fail "doctor: not worth driving yet (fix the FAIL lines above)"
        return 1
    fi

    log "probe: loading the built extension against a 2-thread fixture"
    if TMPDIR="$SCRATCH_DIR" run_logged "$EVIDENCE_DIR/doctor.log" node "$SKILL_DIR/scripts/drive.js" doctor; then
        ok "doctor: extension $EXPECTED_EXTENSION_ID loads and bundles; worth driving"
    else
        fail "doctor: the extension did not load or bundle (see $EVIDENCE_DIR/doctor.log)"
        return 1
    fi
}

cmd_drive() {
    local feature="${1:-}"
    local spec
    spec="$(spec_for "$feature")" || { fail "unknown feature '$feature'"; log "features: $FEATURES"; return 2; }
    run_dirs
    cd "$ROOT"
    local out="$EVIDENCE_DIR/$feature"
    mkdir -p "$out"
    local result=PASS
    log "RUN_ID=$RUN_ID feature=$feature"
    log "evidence: $out"

    log "walk: node scripts/drive.js $feature"
    if ! TMPDIR="$SCRATCH_DIR" run_logged "$out/walk.log" node "$SKILL_DIR/scripts/drive.js" "$feature" --evidence "$out"; then
        result=FAIL
    fi

    local grep_expr
    grep_expr="$(grep_for "$feature")"
    log "spec: npx playwright test $spec${grep_expr:+ -g \"$grep_expr\"}"
    local -a pw=(npx playwright test "$spec" --reporter=list,json)
    if [ -n "$grep_expr" ]; then pw+=(-g "$grep_expr"); fi
    if ! TMPDIR="$SCRATCH_DIR" PLAYWRIGHT_JSON_OUTPUT_FILE="$out/playwright.json" run_logged "$out/playwright.log" "${pw[@]}"; then
        result=FAIL
    fi

    local jest_files
    jest_files="$(jest_for "$feature")"
    if [ -n "$jest_files" ]; then
        log "unit: npx jest $jest_files"
        # shellcheck disable=SC2086
        if ! run_logged "$out/jest.log" npx jest $jest_files; then
            result=FAIL
        fi
    fi

    printf '%s\n' "$result" > "$out/RESULT"
    printf -- '- %s %s (%s)\n' "$result" "$feature" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$EVIDENCE_DIR/summary.md"
    log "$feature: $result -> $out/RESULT"
    [ "$result" = PASS ]
}

cmd_cleanup() {
    local target="${1:-}"
    if [ -z "$target" ]; then
        resolve_run_id
        target="$RUN_ID"
    fi
    local scratch="$SCRATCH_ROOT/$target"
    if [ -d "$scratch" ]; then
        # Only processes started with our per-run scratch path on their
        # command line (Chromium --user-data-dir under it); never by name.
        local pids
        pids="$(pgrep -f -- "$scratch" || true)"
        if [ -n "$pids" ]; then
            log "stopping processes using $scratch: $(echo "$pids" | tr '\n' ' ')"
            # shellcheck disable=SC2086
            kill $pids 2>/dev/null || true
            sleep 1
            # shellcheck disable=SC2086
            kill -9 $pids 2>/dev/null || true
        fi
        rm -rf "$scratch"
        ok "removed scratch $scratch"
    else
        ok "no scratch for run $target"
    fi
    if [ -f "$CURRENT_RUN_FILE" ] && [ "$(cat "$CURRENT_RUN_FILE")" = "$target" ]; then
        rm -f "$CURRENT_RUN_FILE"
    fi
    if [ -d "$EVIDENCE_ROOT/$target" ]; then
        ok "evidence kept at $EVIDENCE_ROOT/$target"
    fi
}

case "${1:-}" in
    launch)   cmd_launch ;;
    doctor)   cmd_doctor ;;
    drive)    cmd_drive "${2:-}" ;;
    cleanup)  cmd_cleanup "${2:-}" ;;
    features) printf '%s\n' $FEATURES ;;
    *)
        sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
        exit 2
        ;;
esac
