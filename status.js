/**
 * GHANDI MOVIES — My Status
 * Everything is computed from movies.json (+ artist.txt for the artist
 * rotator). No external services are contacted.
 */
(function () {
  "use strict";
  const C = window.Common, Core = window.GhandiCore;
  const $ = (id) => document.getElementById(id);
  const ROTATE_MS = 30000;
  const IMG_EXTS = ["webp", "jpg", "jpeg", "png", "avif"]; // tried in this order for assets/artists/artistN.*

  const state = $("state"), content = $("status-content");
  let movies = [];

  init();

  async function init() {
    state.hidden = false;
    C.notice(state, { title: "Loading your statistics…", info: true });
    const r = await C.loadMovieFile("movies.json");
    if (!r.ok) {
      C.notice(state, { title: "Statistics couldn't be loaded", message: C.describeError(r.error, "movies.json"), retry: init });
      return;
    }
    movies = r.list.ok;
    if (!movies.length) {
      C.notice(state, { title: "Nothing to show yet", message: "Add titles to movies.txt and run the update workflow, then come back.", info: true, center: true });
      return;
    }
    state.hidden = true;
    content.hidden = false;
    safe(renderBest);
    safe(renderWatchTime);
    safe(renderGenre);
    safe(renderYear);
    safe(renderDistribution);
    loadArtists(); // async; failures are contained inside
  }

  // One failing section must not take the rest of the page down.
  function safe(fn) {
    try { fn(); } catch (err) { console.error(`Status section "${fn.name}" failed:`, err); }
  }

  /* ---------------- best movie / series ---------------- */

  function renderBestInto(id, pool, emptyMsg) {
    const box = $(id);
    box.textContent = "";
    const { best, tied } = Core.bestOf(pool);
    if (!best) { box.appendChild(C.el("p", { className: "hint", text: emptyMsg })); return; }
    const info = C.el("div", { children: [C.el("h3", { text: best.title }), C.el("p", { className: "big", text: `★ ${best.imdbRating.toFixed(1)}` })] });
    info.firstChild.after(C.el("p", { className: "hint", text: [best.year, best.type ? C.TYPE_LABEL[best.type] : null].filter(Boolean).join(" · ") }));
    if (tied > 1) info.appendChild(C.el("p", { className: "hint", text: `Tied with ${tied - 1} other title${tied > 2 ? "s" : ""} at ${best.imdbRating.toFixed(1)}; shown alphabetically.` }));
    info.appendChild(C.el("p", { className: "hint", text: "Select for details" }));
    const btn = C.el("button", { className: "feature", attrs: { type: "button", "aria-haspopup": "dialog", "aria-label": `${best.title}, rated ${best.imdbRating.toFixed(1)}. Open details` }, children: [C.posterEl(best), info] });
    btn.addEventListener("click", () => C.openDetail(best, btn));
    box.appendChild(btn);
  }

  function renderBest() {
    renderBestInto("best-movie", movies.filter((m) => m.type !== "series"), "No rated movies yet.");
    const hasTypes = movies.some((m) => m.type !== null);
    if (movies.some((m) => m.type === null)) {
      $("best-movie").appendChild(C.el("p", { className: "hint mt-12", text: "Some titles have no movie/series label yet, so this may include a series until the data is refreshed." }));
    }
    renderBestInto("best-series", movies.filter((m) => m.type === "series"),
      hasTypes ? "No rated series in the archive yet." : "Series aren't labelled in the data yet. Run “Update site data” with “Re-fetch every movie” once and the best series will appear here.");
  }

  /* ---------------- total watch time ---------------- */

  function renderWatchTime() {
    const box = $("watch-time");
    box.textContent = "";
    const w = Core.watchTime(movies);
    const d = Core.formatDuration(w.minutes);
    const grid = C.el("div", { className: "time-grid", attrs: { role: "text", "aria-label": `${d.days} days, ${d.hours} hours and ${d.mins} minutes` } });
    [[d.days, "days"], [d.hours, "hours"], [d.mins, "min"]].forEach(([n, u]) => grid.appendChild(C.el("p", { className: "time-unit", children: [document.createTextNode(String(n)), C.el("small", { text: u })] })));
    box.appendChild(grid);
    box.appendChild(C.el("p", { className: "hint mt-12", text: `That is ${d.totalHours.toLocaleString()} hours across ${w.counted} film${w.counted === 1 ? "" : "s"} with a known runtime.` }));
    const notes = [];
    if (w.excludedSeries) notes.push(`${w.excludedSeries} series ${w.excludedSeries === 1 ? "is" : "are"} not included: OMDb only provides one episode's length, not how many episodes were watched.`);
    if (w.unknownType) notes.push(`${w.unknownType} title${w.unknownType === 1 ? " has" : "s have"} no movie/series label yet and ${w.unknownType === 1 ? "is" : "are"} counted by their listed runtime (an estimate). Re-fetching all titles once adds the labels.`);
    if (w.missingRuntime) notes.push(`${w.missingRuntime} title${w.missingRuntime === 1 ? " has" : "s have"} no runtime on OMDb and ${w.missingRuntime === 1 ? "is" : "are"} left out.`);
    if (notes.length) box.appendChild(C.el("div", { className: "method", children: notes.map((t) => C.el("p", { text: t })) }));
  }

  /* ---------------- favorite genre / year ---------------- */

  function renderGenre() {
    const fg = Core.favoriteGenre(movies);
    const h = $("genre-h"), strip = $("genre-strip");
    strip.textContent = "";
    if (!fg) { h.textContent = "No genre data yet"; return; }
    h.textContent = `${fg.genre} · ${fg.count} title${fg.count === 1 ? "" : "s"}`;
    $("genre-note").textContent = "Titles with several genres count once in each of their genres. Ties go to the genre that comes first alphabetically.";
    fg.movies.forEach((m) => strip.appendChild(C.buildCard(m, { animate: false })));
  }

  function renderYear() {
    const fy = Core.favoriteYear(movies);
    const sec = $("year-reveal");
    if (!fy) { $("year-h").textContent = "—"; $("year-count").textContent = "No release years available."; sec.classList.add("in"); return; }
    $("year-h").textContent = String(fy.year);
    $("year-count").textContent = `${fy.count} title${fy.count === 1 ? "" : "s"} released in ${fy.year} — more than any other year.`;
    const box = $("year-posters");
    box.textContent = "";
    fy.movies.forEach((m, i) => {
      const card = C.buildCard(m, { animate: false });
      card.style.setProperty("--i", String(Math.min(i, 14)));
      card.style.setProperty("--tilt", `${((i % 5) - 2) * 1.4}deg`);
      box.appendChild(card);
    });
    if (C.reduceMotion() || !("IntersectionObserver" in window)) { sec.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { sec.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(sec);
  }

  /* ---------------- genre distribution ---------------- */

  function renderDistribution() {
    const box = $("distribution");
    box.textContent = "";
    const dist = Core.genreDistribution(movies, { maxRows: 12 });
    if (!dist.rows.length) { box.appendChild(C.el("p", { className: "hint", text: "No genre data yet." })); return; }
    const list = C.el("ul", { className: "bars", attrs: { "aria-label": "Titles per genre" } });
    dist.rows.forEach((r) => {
      const fill = C.el("span", { className: "bar-fill" });
      fill.style.setProperty("--w", `${r.pct.toFixed(1)}%`);
      list.appendChild(C.el("li", { className: "bar-row", children: [
        C.el("span", { className: "bar-label", text: r.genre }),
        C.el("span", { className: "bar-track", attrs: { "aria-hidden": "true" }, children: [fill] }),
        C.el("span", { className: "bar-val", text: `${r.count} · ${Math.round(r.pct)}%` }),
      ] }));
    });
    box.appendChild(list);
    box.appendChild(C.el("p", { className: "method", text: `How to read this: each bar is the share of your ${dist.total} titles that carry that genre. A title can have up to three genres, so the percentages overlap and add up to more than 100%.${dist.hidden ? ` ${dist.hidden} rarer genre${dist.hidden === 1 ? " is" : "s are"} not shown.` : ""}` }));
  }

  /* ---------------- favorite artist ---------------- */

  async function loadArtists() {
    const box = $("artist");
    const r = await C.loadText("artist.txt");
    const artists = r.ok ? Core.parseArtists(r.text.slice(0, 20000)) : [];
    if (!artists.length) {
      box.textContent = "";
      const msg = !r.ok && !r.missing
        ? "artist.txt couldn't be loaded right now."
        : r.ok ? "artist.txt is empty. Add one name per line." : "No artist.txt found. Create it next to index.html with one artist name per line; images go in assets/artists/ as artist1.webp, artist2.webp, …";
      box.appendChild(C.el("p", { className: "hint", text: msg }));
      if (!r.ok && !r.missing) { const b = C.el("button", { className: "btn mt-12", text: "Try again", attrs: { type: "button" } }); b.addEventListener("click", loadArtists); box.appendChild(b); }
      return;
    }
    rotator(box, artists);
  }

  const imgCache = new Map(); // artist index -> url | null

  function findImage(index) {
    if (imgCache.has(index)) return Promise.resolve(imgCache.get(index));
    return new Promise((resolve) => {
      const tryExt = (i) => {
        if (i >= IMG_EXTS.length) { imgCache.set(index, null); return resolve(null); }
        const url = `assets/artists/artist${index}.${IMG_EXTS[i]}`;
        const img = new Image();
        img.onload = () => { imgCache.set(index, url); resolve(url); };
        img.onerror = () => tryExt(i + 1);
        img.src = url;
      };
      tryExt(0);
    });
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join("");
  }

  function rotator(box, artists) {
    box.textContent = "";
    let i = 0, timer = null, paused = C.reduceMotion(), token = 0;
    const photo = C.el("div", { className: "artist-photo" });
    const name = C.el("p", { className: "artist-name", attrs: { "aria-live": "polite" } });
    const sub = C.el("p", { className: "hint" });
    const stage = C.el("div", { className: "artist-stage", children: [name, sub] });
    const text = C.el("div");
    const controls = C.el("div", { className: "artist-controls" });
    const prev = C.el("button", { className: "icon-btn", attrs: { type: "button", "aria-label": "Previous artist" }, children: [C.icon("left")] });
    const next = C.el("button", { className: "icon-btn", attrs: { type: "button", "aria-label": "Next artist" }, children: [C.icon("right")] });
    const pause = C.el("button", { className: "icon-btn", attrs: { type: "button" } });
    const dots = C.el("div", { className: "dots", attrs: { role: "group", "aria-label": "Choose artist" } });
    const dotEls = artists.map((a, k) => {
      const d = C.el("button", { className: "dot", attrs: { type: "button", "aria-label": `Show ${a.name}` } });
      d.addEventListener("click", () => go(k));
      dots.appendChild(d);
      return d;
    });
    const multi = artists.length > 1;
    if (multi) controls.append(prev, dots, next, pause);
    text.append(stage, controls);
    box.appendChild(C.el("div", { className: "artist", children: [photo, text] }));

    function setPause() {
      pause.textContent = "";
      pause.appendChild(C.icon(paused ? "play" : "pause"));
      pause.setAttribute("aria-label", paused ? "Resume automatic rotation" : "Pause automatic rotation");
    }

    async function draw(k) {
      const a = artists[k], my = ++token;
      const url = await findImage(a.index);
      if (my !== token) return;
      photo.textContent = "";
      if (url) {
        const img = C.el("img", { attrs: { src: url, alt: a.name, width: "460", height: "575", decoding: "async" } });
        img.addEventListener("error", () => { img.remove(); photo.appendChild(C.el("div", { className: "artist-initials", text: initials(a.name), attrs: { "aria-hidden": "true" } })); }, { once: true });
        photo.appendChild(img);
      } else photo.appendChild(C.el("div", { className: "artist-initials", text: initials(a.name), attrs: { "aria-hidden": "true" } }));
      name.textContent = a.name;
      sub.textContent = multi ? `${k + 1} of ${artists.length}` : "";
      dotEls.forEach((d, n) => (n === k ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
      stage.classList.remove("is-fading");
    }

    function go(k) {
      i = (k + artists.length) % artists.length;
      if (C.reduceMotion() || !photo.firstChild) draw(i);
      else { stage.classList.add("is-fading"); setTimeout(() => draw(i), 350); }
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (multi && !paused && !document.hidden) timer = setTimeout(() => go(i + 1), ROTATE_MS);
    }

    prev.addEventListener("click", () => go(i - 1));
    next.addEventListener("click", () => go(i + 1));
    pause.addEventListener("click", () => { paused = !paused; setPause(); schedule(); });
    document.addEventListener("visibilitychange", schedule);
    box.addEventListener("mouseenter", () => clearTimeout(timer));
    box.addEventListener("mouseleave", schedule);
    box.addEventListener("focusin", () => clearTimeout(timer));
    box.addEventListener("focusout", schedule);

    setPause();
    draw(0);
    schedule();
  }
})();
