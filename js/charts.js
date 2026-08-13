/* =============================================================
   charts.js — hand-rolled SVG charts (no libraries)

   Two chart forms, per the data's job:
   - categoryBars: horizontal bars, one fixed color per category
     (identity), value direct-labeled at each bar end.
   - monthlyColumns: single-series columns in the accent hue
     (magnitude over time), month labels below, values on hover.

   Mark specs: thin marks, 4px rounded data-end anchored to the
   baseline, hairline gridlines, muted axis text, hover tooltip.
   ============================================================= */

"use strict";

const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  /* Rounded on the data end only, square on the baseline end.
     side: "top" (columns) or "right" (horizontal bars). r caps
     at half the mark's thickness so tiny values still render. */
  function roundedRect(x, y, w, h, r, side) {
    if (side === "top") {
      r = Math.min(r, w / 2, h);
      return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
    }
    r = Math.min(r, h / 2, w);
    return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
  }

  /* "Nice" upper bound for an axis so gridline values are round. */
  function niceMax(value) {
    if (value <= 0) return 1;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    for (const mult of [1, 2, 2.5, 5, 10]) {
      if (value <= mult * base) return mult * base;
    }
    return 10 * base;
  }

  /* ---------- shared tooltip ---------- */

  const tooltip = () => document.getElementById("chart-tooltip");

  function showTooltip(evt, title, value) {
    const tt = tooltip();
    if (!tt) return;
    tt.innerHTML = "";
    const t = document.createElement("div");
    t.className = "tt-title";
    t.textContent = title;
    const v = document.createElement("div");
    v.className = "tt-value";
    v.textContent = value;
    tt.append(t, v);
    tt.hidden = false;
    moveTooltip(evt);
  }

  function moveTooltip(evt) {
    const tt = tooltip();
    if (!tt || tt.hidden) return;
    const pad = 12;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    const rect = tt.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
    tt.style.left = x + "px";
    tt.style.top = y + "px";
  }

  function hideTooltip() {
    const tt = tooltip();
    if (tt) tt.hidden = true;
  }

  function attachHover(mark, title, valueText) {
    mark.classList.add("mark");
    mark.addEventListener("mouseenter", (e) => showTooltip(e, title, valueText));
    mark.addEventListener("mousemove", moveTooltip);
    mark.addEventListener("mouseleave", hideTooltip);
  }

  /* =============================================================
     Horizontal category bars.
     items: [{ label, value, color, valueText }] — pre-sorted.
     ============================================================= */

  function categoryBars(container, items) {
    container.innerHTML = "";
    if (!items.length || items.every((d) => d.value === 0)) {
      emptyNote(container, "No expenses yet for this month.");
      return;
    }

    const shown = items.filter((d) => d.value > 0);
    const barH = 16, rowH = 44, labelH = 16;
    const width = 440, padLeft = 8, padRight = 74;
    const height = shown.length * rowH + 8;
    const max = Math.max(...shown.map((d) => d.value));
    const plotW = width - padLeft - padRight;

    const svg = el("svg", {
      class: "chart-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Bar chart of spending by category",
    });

    shown.forEach((d, i) => {
      const y = i * rowH + 4;
      const w = Math.max(3, (d.value / max) * plotW);

      // category name above its bar (text in ink tokens, not series color)
      svg.appendChild(el("text", { x: padLeft, y: y + labelH - 4, class: "cat-label" }, d.label));

      const bar = el("path", { d: roundedRect(padLeft, y + labelH, w, barH, 4, "right"), fill: d.color });
      attachHover(bar, d.label, d.valueText);
      svg.appendChild(bar);

      // direct value label at the bar end
      svg.appendChild(el("text", {
        x: padLeft + w + 8,
        y: y + labelH + barH - 4,
        class: "value-label",
      }, d.valueText));
    });

    // baseline
    svg.appendChild(el("line", {
      x1: padLeft, y1: 4, x2: padLeft, y2: height - 4, class: "baseline",
    }));

    container.appendChild(svg);
  }

  /* =============================================================
     Single-series monthly columns (accent hue).
     items: [{ label, value, valueText }] — chronological.
     ============================================================= */

  function monthlyColumns(container, items, accentColor) {
    container.innerHTML = "";
    if (!items.length || items.every((d) => d.value === 0)) {
      emptyNote(container, "No spending recorded yet.");
      return;
    }

    const width = 440, height = 240;
    const pad = { top: 14, right: 10, bottom: 26, left: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const max = niceMax(Math.max(...items.map((d) => d.value)));

    const svg = el("svg", {
      class: "chart-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Column chart of total spending for the last 6 months",
    });

    // hairline gridlines + tick labels at 0 / 50% / 100% of the nice max
    for (const frac of [0, 0.5, 1]) {
      const y = pad.top + plotH - frac * plotH;
      svg.appendChild(el("line", {
        x1: pad.left, y1: y, x2: width - pad.right, y2: y,
        class: frac === 0 ? "baseline" : "gridline",
      }));
      svg.appendChild(el("text", {
        x: pad.left - 6, y: y + 4, "text-anchor": "end",
      }, compactNumber(max * frac)));
    }

    const slot = plotW / items.length;
    const barW = Math.min(34, slot * 0.55);

    items.forEach((d, i) => {
      const x = pad.left + i * slot + (slot - barW) / 2;
      const h = max > 0 ? (d.value / max) * plotH : 0;
      const y = pad.top + plotH - h;

      if (d.value > 0) {
        const bar = el("path", { d: roundedRect(x, y, barW, h, 4, "top"), fill: accentColor });
        attachHover(bar, d.label, d.valueText);
        svg.appendChild(bar);
      }

      svg.appendChild(el("text", {
        x: x + barW / 2, y: height - 8, "text-anchor": "middle",
      }, d.label));

      // selective direct label: only the most recent month
      if (i === items.length - 1 && d.value > 0) {
        svg.appendChild(el("text", {
          x: x + barW / 2, y: y - 5, "text-anchor": "middle", class: "value-label",
        }, d.valueText));
      }
    });

    container.appendChild(svg);
  }

  function compactNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k";
    return String(Math.round(n * 100) / 100);
  }

  function emptyNote(container, text) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = text;
    container.appendChild(div);
  }

  return { categoryBars, monthlyColumns };
})();
