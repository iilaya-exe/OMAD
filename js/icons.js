/* =============================================================
   icons.js — inline SVG icon set (stroke style, 24×24 grid)
   No emoji, no external icon fonts: each icon is a small
   hand-written SVG that inherits `currentColor`.

   Usage:
     Icons.svg("plus", 16)          → SVG markup string
     <span data-icon="plus"></span> → filled in by Icons.mount()
   ============================================================= */

"use strict";

const Icons = (() => {
  const PATHS = {
    wallet:
      '<path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v3"/>' +
      '<path d="M3 6v13a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/>' +
      '<path d="M21 12h-4a2 2 0 0 0 0 4h4v-4z"/>',
    receipt:
      '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/>' +
      '<path d="M9.5 7.5h5M9.5 11.5h5"/>',
    tag:
      '<path d="M12.6 2.6L21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6z"/>' +
      '<circle cx="7.5" cy="7.5" r="1.5"/>',
    calendar:
      '<rect x="3" y="4" width="18" height="17" rx="2"/>' +
      '<path d="M8 2v4M16 2v4M3 9h18"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trophy:
      '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
      '<path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>' +
      '<path d="M12 15v3M8 22c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5M4 22h16"/>',
    pencil:
      '<path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    trash:
      '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
      '<path d="M10 11v6M14 11v6"/>',
    sun:
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:
      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
    database:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/>' +
      '<path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>' +
      '<path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    alert:
      '<path d="M10.3 3.6L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/>' +
      '<path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M4 12l5 5L20 7"/>',
    inbox:
      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>' +
      '<path d="M5 4h14l3 8v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7l3-8z"/>',
  };

  function svg(name, size = 16) {
    const body = PATHS[name];
    if (!body) return "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
      `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
      `stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  /* Fill every <span data-icon="name" [data-icon-size="18"]> under root. */
  function mount(root) {
    for (const el of (root || document).querySelectorAll("[data-icon]")) {
      el.innerHTML = svg(el.dataset.icon, Number(el.dataset.iconSize) || 16);
    }
  }

  return { svg, mount };
})();
