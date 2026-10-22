// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// Stand-in Gmail chrome for the marketing render page.
//
// The e2e fixture (e2e/fixture/inbox.js) is the Gmail-shaped DOM the real
// extension runs on. This file only dresses it: a top bar with a search box,
// a navigation column, the rounded message pane, and Gmail-like row styling
// for the cells Gmail's own stylesheet would draw (checkbox, star, chips).
// Everything Inbundly adds (bundle rows, date headings, glance, buttons, the
// bundling switch) is drawn by the extension build itself.
//
// Guardrails from the visuals plan: no Gmail or Google logos, no Google app
// icons. The header shows a neutral "Mail" wordmark and a generic avatar.

const ICONS = {
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    pencil: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    inbox: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z',
    star: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
    starFilled: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
    send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
    draft: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    more: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
    label: 'M17.63 5.84A2 2 0 0 0 16 5L5 5.01A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2l11 .01c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z',
    archive: 'M20.54 5.23l-1.39-1.68A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23A1.95 1.95 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
    trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    envelope: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    dots: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
};

function svgUrl(path, color = '#000') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function icon(path, cls = 'rg-icon') {
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
}

const THEMES = {
    light: {
        page: '#f6f8fc', pane: '#ffffff', text: '#202124', muted: '#5f6368',
        navText: '#202124', navActive: '#d3e3fd', search: '#e9eef6',
        compose: '#c2e7ff', border: 'rgba(100, 121, 143, 0.122)',
        selected: '#c2dbff', icon: '#444746', starOff: '#80868b',
        hover: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
        circle: 'rgba(32, 33, 36, 0.1)', avatar: '#7b5ea7',
    },
    dark: {
        page: '#131314', pane: '#202124', text: '#e8eaed', muted: '#9aa0a6',
        navText: '#e3e3e3', navActive: '#41464d', search: '#2f3033',
        compose: '#37393b', border: 'rgba(255, 255, 255, 0.1)',
        selected: '#3c4a5c', icon: '#c4c7c5', starOff: '#9aa0a6',
        hover: '0 1px 2px 0 rgba(0,0,0,.6), 0 1px 3px 1px rgba(0,0,0,.3)',
        circle: 'rgba(255, 255, 255, 0.16)', avatar: '#9f86c0',
    },
};

/**
 * The stand-in chrome as inboxPage() extension points.
 *   theme   'light' | 'dark'
 *   nav     show the navigation column (false for the narrow clip frames)
 *   search  text in the search box (search-results scenes)
 *   labels  [{ name, color }] for the navigation's Labels list
 *   rowHeight  CSS px per message row (the plan asks ~44 so text survives
 *              the stores' 640x400 downscale)
 *   transparent  page background transparent (raw row renders for designers);
 *              the pane keeps a near-invisible white so the extension still
 *              detects a light theme
 */
function standIn({
    theme = 'light',
    nav = true,
    search = '',
    labels = [],
    inboxCount = '',
    rowHeight = 44,
    transparent = false,
} = {}) {
    const t = THEMES[theme];
    const css = `
<style id="render-standin">
  html, body { height: 100%; }
  body {
    margin: 0; background: ${transparent ? 'transparent' : t.page}; color: ${t.text};
    font: 14px/20px Roboto, Arial, sans-serif; overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  #fixture-search { display: none; }
  .rg-icon { width: 24px; height: 24px; color: ${t.icon}; flex: none; }
  #gb {
    height: 64px; display: flex; align-items: center; padding: 8px 16px 8px 16px;
    box-sizing: border-box;
  }
  .rg-brand { display: flex; align-items: center; gap: 18px; width: ${nav ? 222 : 120}px; flex: none; padding-left: 8px; }
  .rg-wordmark { font-size: 22px; line-height: 24px; color: ${t.muted}; letter-spacing: 0.2px; }
  .rg-searchwrap { flex: 1; max-width: 760px; min-width: 0; }
  #gb form {
    background: ${t.search}; border-radius: 24px; height: 48px;
    display: inline-flex !important; align-items: center; gap: 12px; padding: 0 16px;
    box-sizing: border-box; vertical-align: top;
    width: calc(100% - 100px) !important;
  }
  #gb form input {
    border: 0; background: transparent; outline: none; flex: 1; min-width: 0;
    font: 16px Roboto, Arial, sans-serif; color: ${t.text};
  }
  #gb form input::placeholder { color: ${t.muted}; }
  .rg-avatar {
    margin-left: auto; width: 32px; height: 32px; border-radius: 50%;
    background: ${t.avatar}; color: #fff; font: 500 15px/32px Roboto, Arial, sans-serif;
    text-align: center; flex: none;
  }
  .rg-body { display: flex; height: calc(100% - 64px); }
  .rg-nav { width: 256px; flex: none; padding-right: 16px; box-sizing: border-box; overflow: hidden; }
  .rg-compose {
    display: inline-flex; align-items: center; gap: 12px; margin: 0 0 16px 8px;
    height: 56px; padding: 0 24px 0 16px; border-radius: 16px; background: ${t.compose};
    font-weight: 500; color: ${t.text};
  }
  .rg-compose .rg-icon { color: ${t.text}; }
  .TO {
    display: flex; align-items: center; gap: 18px; height: 32px; padding: 0 12px 0 26px;
    border-radius: 0 16px 16px 0;
  }
  .TO.rg-active { background: ${t.navActive}; font-weight: 700; }
  .TO .nU { color: ${t.navText}; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .TO .rg-count { font-size: 12px; color: ${t.navText}; }
  .TO .rg-icon { width: 20px; height: 20px; }
  .rg-navhead { margin: 16px 0 4px 26px; font-size: 16px; font-weight: 500; color: ${t.navText}; }
  .bkK { flex: 1; min-width: 0; padding: 0 ${nav ? 16 : 12}px ${nav ? 16 : 12}px ${nav ? 0 : 12}px; }
  .bkK > .nH {
    background: ${transparent ? 'rgba(255, 255, 255, 0.004)' : t.pane}; border-radius: 16px; height: 100%; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .bkK .BltHke { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .bkK [role="tablist"] { display: none; }
  .bkK .UI { flex: 1; overflow: hidden; min-height: 0; }

  /* Toolbar above the list */
  .G-atb { display: flex; align-items: center; height: 48px; padding: 0 12px 0 20px; flex: none; gap: 4px; }
  .G-atb .G-Ni { display: inline-flex; gap: 4px; }
  .G-atb .T-I {
    width: 20px !important; height: 20px !important; margin: 0 10px; display: inline-block;
    background-color: ${t.icon}; -webkit-mask: no-repeat center / 20px;
  }
  .G-atb .T-I[act="7"] { -webkit-mask-image: ${svgUrl(ICONS.archive)}; }
  .G-atb .T-I[act="10"] { -webkit-mask-image: ${svgUrl(ICONS.trash)}; }
  .G-atb #fixture-envelope { -webkit-mask-image: ${svgUrl(ICONS.envelope)}; }
  .G-atb .T-I[data-tooltip="Snooze"] { -webkit-mask-image: ${svgUrl(ICONS.clock)}; }
  .G-atb .T-I[act="20"] { -webkit-mask-image: ${svgUrl(ICONS.refresh)}; }
  .rg-master-cb {
    width: 14px; height: 14px; border: 2px solid ${t.starOff}; border-radius: 2px;
    margin: 0 14px 0 6px; opacity: 0.8;
  }

  /* Message rows: the cells Gmail's stylesheet sizes and draws */
  table.F { width: 100%; border-collapse: collapse; table-layout: fixed; }
  tr.zA {
    display: flex; align-items: center; height: ${rowHeight}px; min-height: ${rowHeight}px;
    box-sizing: border-box; border-bottom: 1px solid ${t.border}; position: relative;
    cursor: pointer; color: ${t.text};
  }
  tr.zA:focus { outline: none; }
  .bkK .UI { font-size: 15px; }
  html.inbundly tr.bundle-row > td.apU { min-height: 20px; width: 34px; flex: none; background-position: 0 center; }
  tr.zA:not(.bundle-row):hover, tr.bundle-row:not(.visible):hover { box-shadow: ${t.hover}; z-index: 2; }
  tr.zA.x7:not(.bundle-row) { background: ${t.selected}; }
  tr.zA > td { display: block; padding: 0; white-space: nowrap; }
  tr.zA > td.PF { width: 10px; flex: none; }
  tr.zA > td.oZ-x3 { width: 34px; flex: none; display: flex; align-items: center; }
  tr.zA > td.apU { width: 34px; flex: none; display: flex; align-items: center; }
  tr.zA:not(.bundle-row) > td.yX { flex: 0 0 168px; padding-right: 24px; overflow: hidden; text-overflow: ellipsis; }
  tr.zA > td.yX .yW, tr.zA > td.yX .bA4 { overflow: hidden; text-overflow: ellipsis; }
  tr.zA > td.a4W { flex: 1 1 auto; min-width: 0; overflow: hidden; }
  tr.zA .xS, tr.zA .xT { display: flex; align-items: center; min-width: 0; overflow: hidden; }
  tr.zA .y6 { flex: none; max-width: 70%; overflow: hidden; text-overflow: ellipsis; }
  tr.zA .y2 { color: ${t.muted}; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  tr.zA .ar.as { order: -1; margin-right: 8px; flex: none; }
  tr.zA .at {
    font-size: 12px; line-height: 18px; padding: 0 6px; border-radius: 4px;
    background: ${theme === 'dark' ? 'rgba(255,255,255,.12)' : '#dde3ea'};
  }
  tr.zA > td.byZ, tr.zA > td.yf { flex: none; }
  tr.zA > td.xW { flex: 0 0 auto; min-width: 72px; text-align: right; padding-right: 18px; font-size: 12px; }
  tr.zE { font-weight: 700; }
  tr.zE .y2 { font-weight: 400; }

  /* Checkbox and star, as Gmail's sprites draw them */
  .oZ-jc {
    width: 14px !important; height: 14px !important; border: 2px solid ${t.starOff};
    border-radius: 2px; box-sizing: content-box; opacity: 0.8; margin-left: 4px; position: relative;
  }
  .oZ-jc[aria-checked="true"], .oZ-jc.T-Jo-Jp, .oZ-jc.T-Jo-ayH {
    background: ${theme === 'dark' ? '#8ab4f8' : '#1a73e8'}; border-color: transparent; opacity: 1;
  }
  .oZ-jc.T-Jo-ayH::after {
    content: ''; position: absolute; left: 3px; right: 3px; top: 6px; height: 2px; background: #fff;
  }
  td.apU .T-KT {
    width: 20px; height: 20px; display: inline-block; background-color: ${t.starOff};
    -webkit-mask: ${svgUrl(ICONS.star)} no-repeat center / 20px;
  }
  td.apU .T-KT img { display: none; }
  td.apU .T-KT.T-KT-Jp { background-color: #f4b400; -webkit-mask-image: ${svgUrl(ICONS.starFilled)}; }

  /* Gmail sizes its row archive button (.brq); the extension supplies the icon */
  .brq { width: 20px; height: 20px; display: inline-block; background-repeat: no-repeat; background-position: center; cursor: pointer; }
  html.inbundly .date-row { align-items: center; padding-right: 0; }
  html.inbundly .date-row .archive-bundle { opacity: 0.6; }

  /* Gmail's hover circle behind its row buttons (the extension sizes it) */
  .bqX { position: relative; }
  .bqX::before { content: ''; position: absolute; top: -8px; bottom: -8px; border-radius: 20px; }
  .bqX:hover::before { background: ${t.circle}; }

  /* Bundle row cells Gmail's stylesheet would size */
  tr.bundle-row > td.spacer { width: 0; flex: none; }
  tr.bundle-row > td.yX { flex: 0 0 180px; padding-right: 20px; }
  tr.bundle-row:not(.visible) > td.xY { align-items: center !important; }
  tr.bundle-row .bundle-senders { display: block; white-space: nowrap; color: ${t.muted}; }
  tr.bundle-row > td.flex-grow { flex: 1 1 0; }
  tr.bundle-row > td.bundle-date-cell { font-size: 12px; padding-right: 18px; text-align: right; }
  tr.bundle-row.visible { height: auto; }

  /* The bundling switch the extension adds next to the search box */
  html.inbundly .bundling-toggle { margin-top: 14px !important; margin-bottom: 0 !important; }
  html.inbundly .bundling-toggle a { display: block; }

  /* Mouse pointer overlay (headless Chromium paints no cursor) */
  #render-cursor {
    position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647;
    pointer-events: none; display: none;
  }
</style>`;

    const navLabels = labels.map(l => `
        <div class="TO" data-tooltip="${l.name}"><svg class="rg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="${l.color}" d="${ICONS.label}"/></svg><div class="nU">${l.name}</div></div>`).join('');

    const wrapBefore = `
<div id="gb">
  <div class="rg-brand">${icon(ICONS.menu)}<span class="rg-wordmark">Mail</span></div>
  <div class="rg-searchwrap"><form onsubmit="return false">${icon(ICONS.search)}<input placeholder="Search mail" value="${search}" aria-label="Search mail (stand-in)"></form></div>
  <div class="rg-avatar">A</div>
</div>
<div class="rg-body">
  ${nav ? `<div class="rg-nav">
    <div class="rg-compose">${icon(ICONS.pencil)}Compose</div>
    <div class="TO${search ? '' : ' rg-active'}" data-tooltip="Inbox">${icon(ICONS.inbox)}<div class="nU">Inbox</div><span class="rg-count">${inboxCount}</span></div>
    <div class="TO" data-tooltip="Starred">${icon(ICONS.star)}<div class="nU">Starred</div></div>
    <div class="TO" data-tooltip="Snoozed">${icon(ICONS.clock)}<div class="nU">Snoozed</div></div>
    <div class="TO" data-tooltip="Sent">${icon(ICONS.send)}<div class="nU">Sent</div></div>
    <div class="TO" data-tooltip="Drafts">${icon(ICONS.draft)}<div class="nU">Drafts</div></div>
    <div class="TO" data-tooltip="More">${icon(ICONS.more)}<div class="nU">More</div></div>
    <div class="rg-navhead">Labels</div>${navLabels}
  </div>` : `<div class="rg-nav" style="display:none"><div class="TO" data-tooltip="Inbox"><div class="nU">Inbox</div></div></div>`}
  <div class="bkK">`;

    const wrapAfter = `
  </div>
</div>`;

    const bodyEnd = `
<svg id="render-cursor" viewBox="0 0 22 22" aria-hidden="true">
  <path d="M3 1.5 L3 17.5 L7 13.7 L9.6 19.8 L12.4 18.6 L9.8 12.6 L15.2 12.6 Z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
</svg>
<script>
(function renderCursor() {
    const cursor = document.getElementById('render-cursor');
    window.__renderCursor = { show: true };
    document.addEventListener('mousemove', e => {
        if (!window.__renderCursor.show) { return; }
        cursor.style.display = 'block';
        cursor.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 1.5) + 'px)';
    }, true);
    // The toolbar gets Gmail's select-all box (decorative, left of Refresh).
    const atb = document.querySelector('.G-atb');
    if (atb) { atb.insertAdjacentHTML('afterbegin', '<span class="rg-master-cb"></span>'); }
})();
</script>`;

    return { head: css, wrapBefore, wrapAfter, bodyEnd };
}

/** The same cursor overlay, for a page we don't author (the Options page). */
const CURSOR_SNIPPET = `(() => {
    if (document.getElementById('render-cursor')) { return; }
    document.body.insertAdjacentHTML('beforeend', '<svg id="render-cursor" viewBox="0 0 22 22" style="position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;display:none"><path d="M3 1.5 L3 17.5 L7 13.7 L9.6 19.8 L12.4 18.6 L9.8 12.6 L15.2 12.6 Z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>');
    const cursor = document.getElementById('render-cursor');
    document.addEventListener('mousemove', e => {
        cursor.style.display = 'block';
        cursor.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 1.5) + 'px)';
    }, true);
})()`;

module.exports = { standIn, CURSOR_SNIPPET };
