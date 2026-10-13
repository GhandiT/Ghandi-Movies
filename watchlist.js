/**
 * GHANDI MOVIES — Watchlist & Rewatchs
 * Reads watchlist.json (built from Watchlist.txt by scripts/fetch-watchlist.js).
 */
(function () {
  "use strict";
  const C = window.Common, Core = window.GhandiCore;
  const $ = (id) => document.getElementById(id);
  const els = { grid: $("grid"), state: $("state"), count: $("result-count"), q: $("q") };
  let list = [], failed = [], dupes = 0, bound = false;

  init();

  async function init() {
    C.showSkeletons(els.grid, 12);
    const r = await C.loadMovieFile("watchlist.json");
    if (!r.ok) {
      els.grid.textContent = "";
      C.endLoading(els.grid);
      C.notice(els.state, { title: "The watchlist couldn't be loaded", message: C.describeError(r.error, "watchlist.json"), retry: () => { els.state.hidden = true; init(); } });
      return;
    }
    els.state.hidden = true;
    list = r.list.ok;
    failed = r.list.failed;
    dupes = r.list.duplicates;
    if (!list.length && !failed.length) {
      els.grid.textContent = "";
      C.endLoading(els.grid);
      C.notice(els.state, { title: "Your watchlist is empty", message: "Add titles to Watchlist.txt (one per line) and run the update workflow.", info: true, center: true });
      return;
    }
    if (!bound) {
      bound = true;
      let t = null;
      els.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(render, 120); });
    }
    render();
  }

  function render() {
    const q = els.q.value;
    const shown = Core.filterMovies(list, { query: q });
    C.renderGrid(els.grid, shown, q.trim() ? [] : failed);
    els.count.textContent = `${shown.length} of ${list.length} title${list.length === 1 ? "" : "s"}${failed.length && !q.trim() ? ` · ${failed.length} couldn't be matched` : ""}${dupes ? ` · ${dupes} duplicate entr${dupes === 1 ? "y" : "ies"} hidden` : ""}`;
    els.state.hidden = true;
    if (!shown.length) C.notice(els.state, { title: "No titles match", message: "Try a different spelling.", info: true });
  }
})();
