/**
 * GHANDI MOVIES — shared browser layer
 * ------------------------------------
 * Loaded by every page after core.js. It mounts the shared chrome (cinema
 * background, header, hamburger drawer, footer, back-to-top, detail dialog),
 * handles the theme, and offers helpers the page scripts reuse (data loading
 * with retry, poster cards, the movie detail dialog).
 *
 * SECURITY: every value coming from JSON/text files is untrusted. All DOM is
 * built with createElement + textContent — there is no innerHTML anywhere in
 * this project. URLs are validated (http/https only; IMDb ids are pattern
 * checked) before being used as src/href.
 */
window.Common = (function () {
  "use strict";

  const Core = window.GhandiCore;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PAGES = [
    { id: "home", href: "index.html", label: "Home / Movie Collection" },
    { id: "status", href: "status.html", label: "My Status" },
    { id: "watchlist", href: "watchlist.html", label: "Watchlist & Rewatchs" },
    { id: "collection", href: "collection.html", label: "Collection" },
    { id: "pick", href: "random.html", label: "Pick a Movie" },
    { id: "about", href: "about.html", label: "About & Credits" },
  ];
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- DOM helpers ---------------- */

  function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined && opts.text !== null) node.textContent = String(opts.text);
    if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) if (v !== null && v !== undefined) node.setAttribute(k, v);
    if (opts.children) opts.children.forEach((c) => c && node.appendChild(c));
    return node;
  }

  function svg(paths, { className } = {}) {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    if (className) s.setAttribute("class", className);
    paths.forEach((d) => {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      s.appendChild(p);
    });
    return s;
  }
  const ICONS = {
    sun: ["M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
    moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
    close: ["M6 6l12 12M18 6L6 18"],
    up: ["M12 19V5M5 12l7-7 7 7"],
    search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M21 21l-4.3-4.3"],
    left: ["M15 18l-6-6 6-6"],
    right: ["M9 6l6 6-6 6"],
    pause: ["M8 5v14M16 5v14"],
    play: ["M7 4l13 8-13 8z"],
  };
  const icon = (name, cls) => svg(ICONS[name], { className: cls });

  /* ---------------- safe storage ---------------- */

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  };

  /* ---------------- theme + cinema artwork ---------------- */

  const artProbed = new Set();
  // Fade the optional artwork in only after it has really loaded; if the
  // files are missing the CSS fallback simply stays visible.
  function probeArt(theme) {
    if (artProbed.has(theme)) return;
    artProbed.add(theme);
    const mobile = window.matchMedia && window.matchMedia("(max-width: 760px), (max-aspect-ratio: 4/5)").matches;
    const urls = (mobile ? [`assets/bg/cinema-${theme}-mobile.webp`] : []).concat(`assets/bg/cinema-${theme}.webp`);
    const tryNext = (i) => {
      if (i >= urls.length) return;
      const img = new Image();
      img.onload = () => document.documentElement.classList.add(`art-${theme}-ready`);
      img.onerror = () => tryNext(i + 1);
      img.src = urls[i];
    };
    tryNext(0);
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f1e6d3" : "#0b0508");
    document.querySelectorAll(".theme-toggle").forEach((b) => {
      b.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      b.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    });
    probeArt(theme);
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    store.set("theme", next);
    applyTheme(next);
  }

  function themeButton() {
    const b = el("button", { className: "icon-btn theme-toggle", attrs: { type: "button", title: "Toggle dark / light theme" } });
    b.append(icon("sun", "i-sun"), icon("moon", "i-moon"));
    b.addEventListener("click", toggleTheme);
    return b;
  }

  /* ---------------- shared chrome ---------------- */

  let drawer = null;

  function mountChrome() {
    const page = document.body.getAttribute("data-page") || "";
    const main = document.getElementById("main");

    const bg = el("div", { className: "cinema-bg", attrs: { "aria-hidden": "true" } });
    ["cb-curtains", "cb-screen", "cb-beam", "cb-seats", "cb-art cb-art-dark", "cb-art cb-art-light", "cb-vignette"].forEach((c) =>
      bg.appendChild(el("div", { className: c }))
    );

    const skip = el("a", { className: "skip-link", text: "Skip to content", attrs: { href: "#main" } });

    const brand = el("a", { className: "brand", attrs: { href: "index.html", "aria-label": "Ghandi Movies — home" } });
    brand.append(
      el("img", { className: "brand-mark", attrs: { src: "assets/img/logo-128.webp", width: "42", height: "42", alt: "", decoding: "async" } }),
      el("span", { className: "brand-name", children: [document.createTextNode("Ghandi "), el("span", { text: "Movies" })] })
    );

    const hamburger = el("button", {
      className: "icon-btn hamburger",
      attrs: { type: "button", "aria-label": "Open menu", "aria-expanded": "false", "aria-controls": "nav-drawer" },
      children: [el("span", { className: "hamburger-bars", children: [el("i"), el("i"), el("i")] })],
    });

    const header = el("header", {
      className: "site-header",
      children: [el("div", { className: "header-inner", children: [brand, themeButton(), hamburger] })],
    });

    // drawer
    const list = el("ul", { className: "nav-list" });
    PAGES.forEach((p) => {
      const a = el("a", { text: p.label, attrs: { href: p.href } });
      if (p.id === page) a.setAttribute("aria-current", "page");
      list.appendChild(el("li", { children: [a] }));
    });
    const closeBtn = el("button", { className: "icon-btn", attrs: { type: "button", "aria-label": "Close menu" }, children: [icon("close")] });
    drawer = el("nav", {
      className: "nav-drawer",
      attrs: { id: "nav-drawer", "aria-label": "Main navigation", "data-open": "false", inert: "" },
      children: [
        el("div", { className: "nav-backdrop" }),
        el("div", { className: "nav-panel", children: [el("div", { className: "nav-panel-head", children: [el("span", { text: "Menu" }), closeBtn] }), list] }),
      ],
    });

    const footer = el("footer", {
      className: "site-footer",
      children: [
        el("div", {
          className: "foot-panel",
          children: [
            document.createTextNode("Film data and ratings from "),
            el("a", { text: "OMDb", attrs: { href: "https://www.omdbapi.com/", target: "_blank", rel: "noopener noreferrer" } }),
            document.createTextNode(" (IMDb ratings). A personal archive by Ghandi A.T."),
          ],
        }),
      ],
    });

    const top = el("button", { attrs: { id: "back-to-top", type: "button", "aria-label": "Back to top", hidden: "" }, children: [icon("up")] });

    document.body.prepend(bg, skip, header, drawer);
    if (main) main.after(footer, top);
    else document.body.append(footer, top);

    setupDrawer(hamburger, closeBtn, main, footer);
    setupBackToTop(top);
  }

  function setupDrawer(toggle, closeBtn, main, footer) {
    const panel = drawer.querySelector(".nav-panel");
    const isOpen = () => drawer.getAttribute("data-open") === "true";
    function open() {
      if (isOpen()) return;
      drawer.removeAttribute("inert");
      drawer.setAttribute("data-open", "true");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      document.body.classList.add("nav-open");
      [main, footer].forEach((n) => n && n.setAttribute("inert", ""));
      (drawer.querySelector('a[aria-current="page"]') || drawer.querySelector("a")).focus();
    }
    function close({ restoreFocus = true } = {}) {
      if (!isOpen()) return;
      drawer.setAttribute("data-open", "false");
      drawer.setAttribute("inert", "");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      document.body.classList.remove("nav-open");
      [main, footer].forEach((n) => n && n.removeAttribute("inert"));
      if (restoreFocus) toggle.focus();
    }
    toggle.addEventListener("click", () => (isOpen() ? close() : open()));
    closeBtn.addEventListener("click", () => close());
    drawer.querySelector(".nav-backdrop").addEventListener("click", () => close({ restoreFocus: false }));
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => close({ restoreFocus: false })));
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") { // keep focus inside the drawer panel
        const f = [...panel.querySelectorAll("a, button")].filter((n) => !n.disabled);
        const all = f;
        const i = all.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); all[all.length - 1].focus(); }
        else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0].focus(); }
      }
    });
  }

  function setupBackToTop(btn) {
    let ticking = false;
    const update = () => { btn.hidden = window.scrollY < 520; ticking = false; };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }));
    update();
  }

  /* ---------------- data loading ---------------- */

  async function request(path, { timeoutMs = 15000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(path, { cache: "no-cache", signal: ctl.signal });
      return { res };
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      return { error: { kind: err && err.name === "AbortError" ? "timeout" : offline ? "offline" : "network" } };
    } finally {
      clearTimeout(timer);
    }
  }

  // Resolves to { ok:true, data } or { ok:false, error:{kind,status?} }. Never throws.
  async function loadJson(path) {
    const r = await request(path);
    if (r.error) return { ok: false, error: r.error };
    if (!r.res.ok) return { ok: false, error: { kind: r.res.status === 404 ? "missing" : "http", status: r.res.status } };
    try {
      return { ok: true, data: await r.res.json() };
    } catch {
      return { ok: false, error: { kind: "parse" } };
    }
  }

  // Resolves to { ok:true, text } or { ok:false, missing, error }. Never throws.
  async function loadText(path) {
    const r = await request(path);
    if (r.error) return { ok: false, missing: false, error: r.error };
    if (!r.res.ok) return { ok: false, missing: r.res.status === 404, error: { kind: r.res.status === 404 ? "missing" : "http", status: r.res.status } };
    try {
      return { ok: true, text: await r.res.text() };
    } catch {
      return { ok: false, missing: false, error: { kind: "parse" } };
    }
  }

  function describeError(err, file) {
    switch (err && err.kind) {
      case "offline": return `You appear to be offline, so ${file} couldn't be loaded.`;
      case "timeout": return `Loading ${file} took too long.`;
      case "missing": return `${file} was not found. If this is a fresh deployment, run the “Update site data” workflow once (Actions tab).`;
      case "parse": return `${file} was found but isn't valid JSON. It is generated automatically — re-run the update workflow.`;
      case "http": return `The server answered ${err.status} when loading ${file}.`;
      default: return `${file} couldn't be loaded (network problem).`;
    }
  }

  // Loads a generated movie list file and returns { ok, list:{ok,failed,duplicates}, generatedAt } or { ok:false, error }.
  async function loadMovieFile(path) {
    const r = await loadJson(path);
    if (!r.ok) return r;
    const d = r.data;
    const raw = d && Array.isArray(d.movies) ? d.movies : null;
    if (!raw) return { ok: false, error: { kind: "parse" } };
    return { ok: true, list: Core.normalizeList(raw), generatedAt: d.generatedAt || null };
  }

  /* ---------------- states: skeleton / notice ---------------- */

  function showSkeletons(grid, n = 12) {
    grid.textContent = "";
    grid.setAttribute("aria-busy", "true");
    for (let i = 0; i < n; i++) {
      grid.appendChild(el("div", { className: "card skeleton", attrs: { "aria-hidden": "true" }, children: [el("div", { className: "poster" }), el("div", { className: "bar" })] }));
    }
  }
  function endLoading(grid) { grid.removeAttribute("aria-busy"); }

  function notice(container, { title, message, retry, info = false, center = false }) {
    container.textContent = "";
    const box = el("div", { className: `notice${info ? " is-info" : ""}${center ? " notice-center" : ""}`, attrs: { role: info ? "status" : "alert" } });
    box.appendChild(el("h2", { text: title }));
    if (message) box.appendChild(el("p", { text: message }));
    if (retry) {
      const b = el("button", { className: "btn btn-primary", text: "Try again", attrs: { type: "button" } });
      b.addEventListener("click", retry);
      box.appendChild(b);
    }
    container.appendChild(box);
    container.hidden = false;
    return box;
  }

  /* ---------------- posters + cards ---------------- */

  const BACK_LABEL = { home: "Back to collection", collection: "Back to collection", watchlist: "Back to watchlist", pick: "Back to the pick", status: "Back to status" };
  const TYPE_LABEL = { movie: "Movie", series: "Series", episode: "Episode" };

  function posterEl(m, { eager = false } = {}) {
    const wrap = el("div", { className: "poster" });
    const fallback = () => wrap.appendChild(el("div", { className: "poster-fallback", text: m.title, attrs: { role: "img", "aria-label": `${m.title} (no poster available)` } }));
    if (m.poster) {
      const img = el("img", { attrs: { src: m.poster, alt: `Poster of ${m.title}`, width: "300", height: "450", decoding: "async", referrerpolicy: "no-referrer" } });
      if (!eager) img.setAttribute("loading", "lazy");
      img.addEventListener("error", () => { img.remove(); fallback(); }, { once: true });
      wrap.appendChild(img);
    } else fallback();
    return wrap;
  }

  function cardLabel(m) {
    const bits = [m.title];
    if (m.type) bits.push(TYPE_LABEL[m.type]);
    if (m.year !== null) bits.push(String(m.year));
    if (m.imdbRating !== null) bits.push(`IMDb ${m.imdbRating.toFixed(1)}`);
    return bits.join(", ");
  }

  function buildCard(m, { onOpen, index = 0, animate = true } = {}) {
    const poster = posterEl(m);
    if (m.type) poster.appendChild(el("span", { className: `badge badge-type${m.type === "movie" ? " is-movie" : ""}`, text: TYPE_LABEL[m.type] }));
    if (m.imdbRating !== null) poster.appendChild(el("span", { className: "badge badge-rating", text: `★ ${m.imdbRating.toFixed(1)}` }));
    const detail = [m.genres.slice(0, 3).join(", "), m.year !== null ? String(m.year) : ""].filter(Boolean);
    poster.appendChild(
      el("div", { className: "card-hover", attrs: { "aria-hidden": "true" }, children: [el("b", { text: m.year !== null ? String(m.year) : "Year unknown" }), el("span", { text: m.genres.slice(0, 3).join(" · ") || "Genre unknown" })] })
    );
    const card = el("button", {
      className: "card" + (animate ? " card-in" : ""),
      attrs: { type: "button", "aria-haspopup": "dialog", "aria-label": `${cardLabel(m)}. Open details` },
      children: [poster, el("h3", { className: "card-title", text: m.title }), el("p", { className: "card-sub", text: detail.join(" · ") || "—" })],
    });
    if (animate) card.style.animationDelay = `${Math.min(index, 14) * 25}ms`;
    card.addEventListener("click", () => (onOpen || openDetail)(m, card));
    return card;
  }

  function buildErrorCard(f) {
    const reason = { invalid_api_key: "API key problem", rate_limited: "Rate limited", not_found: "Not found", timeout: "Timed out", network_error: "Network error", http_error: "Network error", malformed_response: "Bad response" }[f.error] || "Unavailable";
    const poster = el("div", { className: "poster", children: [el("div", { className: "poster-fallback", text: reason })] });
    return el("div", { className: "card is-error", attrs: { role: "group", "aria-label": `${f.queriedTitle}: ${reason}` }, children: [poster, el("h3", { className: "card-title", text: f.queriedTitle }), el("p", { className: "card-sub", text: f.message })] });
  }

  function renderGrid(grid, movies, failed = [], opts = {}) {
    grid.textContent = "";
    endLoading(grid);
    const frag = document.createDocumentFragment();
    movies.forEach((m, i) => {
      try { frag.appendChild(buildCard(m, { index: i, ...opts })); }
      catch (err) { console.error("Skipped a card that failed to render:", m && m.title, err); }
    });
    failed.forEach((f) => frag.appendChild(buildErrorCard(f)));
    grid.appendChild(frag);
  }

  /* ---------------- detail dialog ---------------- */

  let dlg = null;
  let dlgBody = null;
  let lastTrigger = null;

  function ensureDialog() {
    if (dlg) return;
    const back = el("button", { className: "btn detail-back", attrs: { type: "button", "data-close": "" }, children: [icon("left"), el("span", { text: BACK_LABEL[document.body.getAttribute("data-page")] || "Close" })] });
    const closeX = el("button", { className: "icon-btn", attrs: { type: "button", "aria-label": "Close details", "data-close": "" }, children: [icon("close")] });
    dlgBody = el("div", { className: "detail-body" });
    dlg = el("dialog", { className: "detail", attrs: { "aria-labelledby": "detail-title" }, children: [el("div", { className: "detail-bar", children: [back, themeButton(), closeX] }), dlgBody] });
    document.body.appendChild(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) closeDetail(); });
    dlg.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      dlgBody.textContent = "";
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
      lastTrigger = null;
    });
    applyTheme(currentTheme()); // sync the new toggle's label
  }

  function fact(dl, label, value) {
    if (value === null || value === undefined || value === "") return;
    dl.appendChild(el("dt", { text: label }));
    const dd = el("dd");
    if (value instanceof Node) dd.appendChild(value); else dd.textContent = value;
    dl.appendChild(dd);
  }

  function fmtRuntime(m) {
    if (m.runtimeMinutes === null) return null;
    const h = Math.floor(m.runtimeMinutes / 60), mm = m.runtimeMinutes % 60;
    const t = h ? `${h} h${mm ? ` ${mm} min` : ""}` : `${mm} min`;
    return m.type === "series" ? `${t} per episode` : t;
  }

  function openDetail(m, trigger) {
    if (!m) return;
    ensureDialog();
    lastTrigger = trigger || document.activeElement;
    dlgBody.textContent = "";

    const info = el("div", { className: "detail-info" });
    info.appendChild(el("h2", { text: m.title, attrs: { id: "detail-title" } }));
    const chips = el("div", { className: "chips" });
    if (m.type) chips.appendChild(el("span", { className: "chip is-type", text: TYPE_LABEL[m.type] }));
    if (m.year !== null) chips.appendChild(el("span", { className: "chip", text: String(m.year) }));
    if (m.imdbRating !== null) chips.appendChild(el("span", { className: "chip is-gold", text: `★ ${m.imdbRating.toFixed(1)} IMDb` }));
    if (m.rated) chips.appendChild(el("span", { className: "chip", text: m.rated }));
    if (chips.childNodes.length) info.appendChild(chips);
    info.appendChild(el("p", { className: "detail-plot", text: m.plot || "No plot summary is available for this title." }));

    const dl = el("dl", { className: "facts" });
    fact(dl, "Released", m.released || (m.year !== null ? String(m.year) : null));
    fact(dl, "Runtime", fmtRuntime(m));
    if (m.type === "series") fact(dl, "Seasons", m.totalSeasons !== null ? String(m.totalSeasons) : null);
    fact(dl, "Genre", m.genres.join(", "));
    fact(dl, "Director", m.director);
    fact(dl, "Cast", m.cast.join(", "));
    fact(dl, "Watched on", m.watchedOn);
    if (m.imdbID) fact(dl, "IMDb ID", m.imdbID);
    info.appendChild(dl);

    if (m.imdbID) {
      const a = el("a", { className: "btn btn-primary", text: "Open on IMDb", attrs: { href: `https://www.imdb.com/title/${m.imdbID}/`, target: "_blank", rel: "noopener noreferrer" } });
      info.appendChild(el("div", { className: "detail-actions", children: [a] }));
    }

    dlgBody.append(posterEl(m, { eager: true }), info);
    dlgBody.scrollTop = 0;
    document.body.classList.add("dialog-open");
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
  }

  function closeDetail() {
    if (!dlg || !dlg.open) return;
    if (typeof dlg.close === "function") dlg.close(); else { dlg.removeAttribute("open"); dlg.dispatchEvent(new Event("close")); }
  }

  /* ---------------- boot ---------------- */

  function boot() {
    mountChrome();
    applyTheme(currentTheme());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { el, icon, svg, store, reduceMotion, loadJson, loadText, loadMovieFile, describeError, showSkeletons, endLoading, notice, posterEl, buildCard, buildErrorCard, renderGrid, openDetail, closeDetail, TYPE_LABEL, fmtRuntime };
})();
