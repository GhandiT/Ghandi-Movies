/**
 * GHANDI MOVIES — Home / Movie Collection
 * Reads movies.json (built by the GitHub Action). No OMDb calls, no API key.
 */
(function () {
  "use strict";
  const C = window.Common, Core = window.GhandiCore;
  const $ = (id) => document.getElementById(id);
  const els = {
    stats: $("stats"), grid: $("grid"), state: $("state"), count: $("result-count"),
    q: $("q"), sort: $("f-sort"), genre: $("f-genre"), year: $("f-year"), rating: $("f-rating"), type: $("f-type"), reset: $("f-reset"),
  };
  let movies = [], failed = [], untyped = 0, dupes = 0;

  init();

  async function init() {
    C.showSkeletons(els.grid, 14);
    const r = await C.loadMovieFile("movies.json");
    if (!r.ok) {
      els.grid.textContent = "";
      C.endLoading(els.grid);
      els.count.textContent = "";
      C.notice(els.state, { title: "The collection couldn't be loaded", message: C.describeError(r.error, "movies.json"), retry: () => { els.state.hidden = true; init(); } });
      return;
    }
    els.state.hidden = true;
    movies = r.list.ok;
    failed = r.list.failed;
    dupes = r.list.duplicates;
    untyped = movies.filter((m) => m.type === null).length;
    if (!movies.length && !failed.length) {
      els.grid.textContent = "";
      C.endLoading(els.grid);
      C.notice(els.state, { title: "The screen is empty", message: "Add titles to movies.txt (one per line) and run the update workflow.", info: true, center: true });
      return;
    }
    renderStats(r.generatedAt);
    fillSelect(els.genre, [...new Set(movies.flatMap((m) => m.genres))].sort(), "All genres");
    fillSelect(els.year, [...new Set(movies.map((m) => m.year).filter((y) => y !== null))].sort((a, b) => b - a), "All years");
    bind();
    render();
  }

  function fillSelect(select, values, allLabel) {
    select.textContent = "";
    select.appendChild(C.el("option", { text: allLabel, attrs: { value: "all" } }));
    values.forEach((v) => select.appendChild(C.el("option", { text: String(v), attrs: { value: String(v) } })));
  }

  /* ---------------- statistics ---------------- */

  function stat(label, value, title, note) {
    const box = C.el("div", { className: "stat" });
    box.appendChild(C.el("p", { className: "stat-label", text: label }));
    box.appendChild(C.el("p", { className: "stat-value", text: value }));
    if (title) box.appendChild(C.el("p", { className: "stat-title", text: title }));
    if (note) box.appendChild(C.el("p", { className: "stat-note", text: note }));
    return box;
  }

  function renderStats() {
    els.stats.textContent = "";
    if (!movies.length) return;
    const { best, tied } = Core.bestOf(movies);
    const oldest = Core.oldestRelease(movies);
    const recent = Core.mostRecentlyWatched(movies);

    els.stats.appendChild(stat("Total titles", String(movies.length), null, failed.length ? `${failed.length} more couldn't be matched on OMDb` : null));
    els.stats.appendChild(
      best ? stat("Highest rated", best.imdbRating.toFixed(1), best.title, tied > 1 ? `Tied with ${tied - 1} other${tied > 2 ? "s" : ""} (shown A–Z)` : "IMDb rating")
           : stat("Highest rated", "—", null, "No ratings available")
    );
    els.stats.appendChild(
      oldest ? stat("Oldest film", String(oldest.year), oldest.title, "By release year")
             : stat("Oldest film", "—", null, "No release years available")
    );
    if (recent) {
      const when = recent.basis === "date" ? formatDate(recent.date) : "Last in list";
      els.stats.appendChild(stat("Most recently watched", when, recent.movie.title, recent.basis === "date" ? "Watch date from movies.txt" : "No watch dates recorded: using the last entry of movies.txt"));
    }
    if (untyped) {
      const n = C.el("p", { className: "hint", text: `Movie / series labels are shown for titles refreshed by the updated workflow. ${untyped} title${untyped === 1 ? " has" : "s have"} no type yet: run “Update site data” with “Re-fetch every movie” once to add them.` });
      els.stats.after(n);
    }
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  }

  /* ---------------- filtering ---------------- */

  function bind() {
    [els.sort, els.genre, els.year, els.rating, els.type].forEach((s) => s.addEventListener("change", render));
    let t = null;
    els.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(render, 120); });
    els.reset.addEventListener("click", () => {
      els.q.value = "";
      els.sort.value = "my-order"; els.genre.value = "all"; els.year.value = "all"; els.rating.value = "0"; els.type.value = "all";
      render();
      els.q.focus();
    });
  }

  function render() {
    const filters = { query: els.q.value, genre: els.genre.value, year: els.year.value, minRating: els.rating.value, type: els.type.value };
    const list = Core.sortMovies(Core.filterMovies(movies, filters), els.sort.value);
    const filtering = filters.query.trim() || filters.genre !== "all" || filters.year !== "all" || Number(filters.minRating) > 0 || filters.type !== "all";
    // Titles OMDb couldn't match only show when nothing is being filtered.
    C.renderGrid(els.grid, list, filtering ? [] : failed, { animate: true });
    els.count.textContent = `${list.length} of ${movies.length} title${movies.length === 1 ? "" : "s"}${dupes ? ` · ${dupes} duplicate entr${dupes === 1 ? "y" : "ies"} hidden` : ""}`;

    els.state.hidden = true;
    if (!list.length) {
      let msg = "Try a different spelling, remove a filter, or reset everything.";
      if (filters.type === "series" && untyped === movies.length) msg = "Series labels aren't in the data yet. Run “Update site data” with “Re-fetch every movie” once, then reload.";
      C.notice(els.state, { title: "No titles match", message: msg, info: true });
    }
  }
})();
