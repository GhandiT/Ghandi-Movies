/**
 * GHANDI MOVIES — Collection
 * Reads collections.json (built from collections.txt). Shows a picker of
 * franchises, then one franchise's films oldest -> newest. Deep link:
 * collection.html#marvel-cinematic-universe-mcu
 */
(function () {
  "use strict";
  const C = window.Common, Core = window.GhandiCore;
  const $ = (id) => document.getElementById(id);
  const els = {
    state: $("state"), picker: $("picker"), cgrid: $("collection-grid"), detail: $("detail"), heading: $("detail-heading"),
    count: $("detail-count"), grid: $("grid"), back: $("back"), q: $("q"), qLabel: $("q-label"), lede: $("lede"),
  };
  let collections = [], current = null;

  init();

  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "collection";

  async function init() {
    C.showSkeletons(els.cgrid, 6);
    const r = await C.loadJson("collections.json");
    els.cgrid.removeAttribute("aria-busy");
    if (!r.ok || !r.data || !Array.isArray(r.data.collections)) {
      els.cgrid.textContent = "";
      C.notice(els.state, { title: "Collections couldn't be loaded", message: C.describeError(r.ok ? { kind: "parse" } : r.error, "collections.json"), retry: () => { els.state.hidden = true; init(); } });
      return;
    }
    const used = new Set();
    collections = r.data.collections
      .filter((c) => c && typeof c.name === "string" && c.name.trim() && Array.isArray(c.movies))
      .map((c) => {
        const n = Core.normalizeList(c.movies);
        let slug = slugify(c.name), k = 2;
        while (used.has(slug)) slug = `${slugify(c.name)}-${k++}`;
        used.add(slug);
        const ok = n.ok.slice().sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
        return { name: c.name.trim(), slug, ok, failed: n.failed };
      });
    els.state.hidden = true;
    if (!collections.length) {
      els.cgrid.textContent = "";
      C.notice(els.state, { title: "No collections yet", message: "Add numbered collections to collections.txt (for example “1. Marvel Cinematic Universe”) and run the update workflow.", info: true, center: true });
      return;
    }
    els.back.addEventListener("click", () => show(null));
    let t = null;
    els.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(applySearch, 120); });
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  function fromHash() {
    const slug = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    const c = collections.find((x) => x.slug === slug);
    show(c || null, { updateHash: false, focus: false });
  }

  function show(c, { updateHash = true, focus = true } = {}) {
    current = c;
    els.q.value = "";
    if (c) {
      els.picker.hidden = true;
      els.detail.hidden = false;
      els.heading.textContent = c.name;
      els.lede.textContent = "Oldest to newest. Select a poster for full details.";
      els.qLabel.textContent = `Search within ${c.name}`;
      els.q.placeholder = "Search this collection…";
      if (updateHash) history.pushState(null, "", `#${c.slug}`);
      document.title = `${c.name} — Collection — Ghandi Movies`;
      renderDetail();
      if (focus) els.heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: C.reduceMotion() ? "auto" : "smooth" });
    } else {
      els.detail.hidden = true;
      els.picker.hidden = false;
      els.lede.textContent = "Pick a collection to see its films from oldest to newest.";
      els.qLabel.textContent = "Search collections";
      els.q.placeholder = "Search collections or film titles…";
      document.title = "Collection — Ghandi Movies";
      if (updateHash && location.hash) history.pushState(null, "", location.pathname + location.search);
      renderPicker(collections);
    }
  }

  function applySearch() {
    if (current) return renderDetail();
    const q = els.q.value;
    renderPicker(q.trim() ? collections.filter((c) => Core.matchesQuery({ _hay: Core.fold(c.name) }, q) || c.ok.some((m) => Core.matchesQuery(m, q))) : collections);
  }

  function renderPicker(list) {
    els.cgrid.textContent = "";
    els.state.hidden = true;
    if (!list.length) return C.notice(els.state, { title: "No collections match", message: "Try a different spelling.", info: true });
    list.forEach((c) => {
      const cover = C.el("div", { className: "collection-cover", attrs: { "aria-hidden": "true" } });
      cover.appendChild(C.el("span", { className: "cover-mono", text: Array.from(c.name.replace(/[^\p{L}\p{N} ]/gu, "").trim())[0] || "•" }));
      c.ok.filter((m) => m.poster).slice(0, 3).forEach((m) => {
        const cell = C.el("div", { className: "cv" });
        const img = C.el("img", { attrs: { src: m.poster, alt: "", width: "100", height: "150", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" } });
        img.addEventListener("error", () => img.remove(), { once: true });
        cell.appendChild(img);
        cover.appendChild(cell);
      });
      const total = c.ok.length + c.failed.length;
      const b = C.el("button", {
        className: "collection-card", attrs: { type: "button", "aria-label": `Open ${c.name}, ${total} title${total === 1 ? "" : "s"}` },
        children: [cover, C.el("div", { className: "collection-meta", children: [C.el("h3", { text: c.name }), C.el("p", { text: `${total} title${total === 1 ? "" : "s"}` })] })],
      });
      b.addEventListener("click", () => show(c));
      els.cgrid.appendChild(b);
    });
  }

  function renderDetail() {
    const q = els.q.value;
    const shown = Core.filterMovies(current.ok, { query: q });
    const total = current.ok.length + current.failed.length;
    C.renderGrid(els.grid, shown, q.trim() ? [] : current.failed);
    els.count.textContent = q.trim() ? `${shown.length} of ${current.ok.length} match` : `${total} title${total === 1 ? "" : "s"}${current.failed.length ? ` · ${current.failed.length} couldn't be matched` : ""}`;
    els.state.hidden = true;
    if (!shown.length) C.notice(els.state, { title: "No titles match", message: "Try a different spelling.", info: true });
  }
})();
