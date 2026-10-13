/**
 * GHANDI MOVIES — Pick a Movie
 * Picks a random title from the Watchlist only (watchlist.json). The pick is
 * instant; the reveal is a short CSS animation (skipped for reduced motion).
 */
(function () {
  "use strict";
  const C = window.Common;
  const $ = (id) => document.getElementById(id);
  const els = { btn: $("pick-btn"), status: $("pick-status"), result: $("pick-result"), state: $("state") };
  let pool = [], last = null, bound = false;

  init();

  async function init() {
    els.btn.disabled = true;
    els.status.textContent = "Loading the watchlist…";
    const r = await C.loadMovieFile("watchlist.json");
    if (!r.ok) {
      els.status.textContent = "";
      C.notice(els.state, { title: "The watchlist couldn't be loaded", message: C.describeError(r.error, "watchlist.json"), retry: () => { els.state.hidden = true; init(); } });
      return;
    }
    els.state.hidden = true;
    pool = r.list.ok;
    if (!pool.length) {
      els.status.textContent = "";
      C.notice(els.state, { title: "Nothing to pick from", message: "Your Watchlist is empty. Add titles to Watchlist.txt and run the update workflow.", info: true, center: true });
      return;
    }
    els.status.textContent = `${pool.length} title${pool.length === 1 ? "" : "s"} on the watchlist.`;
    els.btn.disabled = false;
    if (!bound) { bound = true; els.btn.addEventListener("click", pick); }
  }

  function choose() {
    if (pool.length === 1) return pool[0];
    const options = pool.filter((m) => m.key !== last);
    return options[Math.floor(Math.random() * options.length)];
  }

  function pick() {
    const m = choose();
    last = m.key;
    show(m);
    els.btn.textContent = "Pick again";
    els.status.textContent = `Tonight: ${m.title}.`;
  }

  function show(m) {
    const box = els.result;
    box.textContent = "";
    box.classList.remove("reveal");
    const info = C.el("div", { className: "pick-info" });
    info.appendChild(C.el("h2", { text: m.title }));
    const chips = C.el("div", { className: "chips" });
    if (m.type) chips.appendChild(C.el("span", { className: "chip is-type", text: C.TYPE_LABEL[m.type] }));
    if (m.year !== null) chips.appendChild(C.el("span", { className: "chip", text: String(m.year) }));
    if (m.imdbRating !== null) chips.appendChild(C.el("span", { className: "chip is-gold", text: `★ ${m.imdbRating.toFixed(1)} IMDb` }));
    info.appendChild(chips);
    info.appendChild(C.el("p", { className: "pick-plot", text: m.plot || "No plot summary is available for this title." }));
    const more = C.el("button", { className: "btn", text: "Full details", attrs: { type: "button", "aria-haspopup": "dialog" } });
    more.addEventListener("click", () => C.openDetail(m, more));
    info.appendChild(more);
    box.append(C.posterEl(m, { eager: true }), info);
    box.hidden = false;
    void box.offsetWidth; // restart the CSS animation on every pick
    box.classList.add("reveal");
  }
})();
