/**
 * GHANDI MOVIES — core logic (pure functions, no DOM)
 * ---------------------------------------------------
 * Everything in here is data in -> data out, so it can be unit-tested in
 * Node (see tests/core.test.js) and is reused by every page in the browser
 * via window.GhandiCore.
 *
 * Nothing here ever builds HTML. Anything that came from JSON / text files
 * is treated as untrusted data; the DOM layer (common.js) only ever writes
 * it with textContent.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GhandiCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- tiny validators ---------------- */

  function isHttpUrl(str) {
    if (typeof str !== "string" || str.length === 0 || str.length > 2048) return false;
    try {
      const u = new URL(str);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  // "tt0448157" style ids only (OMDb/IMDb). Anything else is rejected.
  function validImdbId(id) {
    return typeof id === "string" && /^tt\d{5,12}$/.test(id) ? id : null;
  }

  function validWatchDate(s) {
    if (typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? s : null;
  }

  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v) => (typeof v === "string" && v.trim() ? v : null);
  const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);

  /* ---------------- normalisation ---------------- */

  // Lowercase, strip accents, collapse whitespace — for search.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMovie(m) {
    const title = str(m.title) || str(m.queriedTitle) || "Untitled";
    const imdbID = validImdbId(m.imdbID);
    const type = ["movie", "series", "episode"].includes(m.type) ? m.type : null; // null = not recorded yet
    const out = {
      key: imdbID || "q:" + fold(m.queriedTitle || title),
      queriedTitle: str(m.queriedTitle) || title,
      title,
      year: num(m.year),
      imdbID,
      imdbRating: num(m.imdbRating),
      poster: isHttpUrl(m.poster) ? m.poster : null,
      genres: strList(m.genres),
      cast: strList(m.cast),
      director: str(m.director),
      runtimeMinutes: num(m.runtimeMinutes),
      plot: str(m.plot),
      rated: str(m.rated),
      type,
      released: str(m.released),
      totalSeasons: num(m.totalSeasons),
      watchedOn: validWatchDate(m.watchedOn),
    };
    out._hay = fold([out.title, out.queriedTitle, out.director || "", ...out.cast, ...out.genres].join(" | "));
    return out;
  }

  function normalizeFailed(m) {
    return {
      queriedTitle: str(m.queriedTitle) || "Untitled",
      error: typeof m.error === "string" ? m.error : "unknown",
      message: typeof m.message === "string" ? m.message : "Could not load this title",
    };
  }

  // Takes the raw `movies` array from one of the generated JSON files and
  // returns { ok: [...], failed: [...], duplicates: n }. Entries that resolve
  // to the same IMDb id are collapsed (first one wins) so totals are honest.
  function normalizeList(rawList) {
    const ok = [];
    const failed = [];
    const seen = new Set();
    let duplicates = 0;
    (Array.isArray(rawList) ? rawList : []).forEach((m) => {
      if (!m || typeof m !== "object") return;
      if (m.ok === true) {
        const n = normalizeMovie(m);
        if (seen.has(n.key)) {
          duplicates++;
          return;
        }
        seen.add(n.key);
        n._order = ok.length;
        ok.push(n);
      } else if (m.ok === false) {
        failed.push(normalizeFailed(m));
      }
    });
    return { ok, failed, duplicates };
  }

  /* ---------------- search / filter / sort ---------------- */

  function matchesQuery(m, query) {
    const tokens = fold(query).split(" ").filter(Boolean);
    if (!tokens.length) return true;
    return tokens.every((t) => m._hay.includes(t));
  }

  function matchesType(m, contentType) {
    if (contentType === "series") return m.type === "series";
    if (contentType === "movies") return m.type === "movie" || m.type === null;
    return true;
  }

  function filterMovies(list, f = {}) {
    const minRating = Number(f.minRating) || 0;
    return list.filter((m) => {
      if (f.genre && f.genre !== "all" && !m.genres.includes(f.genre)) return false;
      if (f.year && f.year !== "all" && String(m.year) !== String(f.year)) return false;
      if (minRating > 0 && !(m.imdbRating !== null && m.imdbRating >= minRating)) return false;
      if (!matchesType(m, f.type)) return false;
      if (f.query && !matchesQuery(m, f.query)) return false;
      return true;
    });
  }

  function sortMovies(list, mode) {
    const c = [...list];
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    switch (mode) {
      case "rating-desc":
        return c.sort((a, b) => (b.imdbRating ?? -1) - (a.imdbRating ?? -1) || byTitle(a, b));
      case "rating-asc":
        return c.sort((a, b) => (a.imdbRating ?? 999) - (b.imdbRating ?? 999) || byTitle(a, b));
      case "year-desc":
        return c.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || byTitle(a, b));
      case "year-asc":
        return c.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || byTitle(a, b));
      case "alpha-asc":
        return c.sort(byTitle);
      case "alpha-desc":
        return c.sort((a, b) => byTitle(b, a));
      case "recent":
        return c.sort((a, b) => b._order - a._order);
      case "my-order":
      default:
        return c.sort((a, b) => a._order - b._order);
    }
  }

  /* ---------------- statistics ---------------- */

  // Highest IMDb rating; ties resolve alphabetically so it is deterministic.
  function bestOf(list) {
    const rated = list.filter((m) => m.imdbRating !== null);
    if (!rated.length) return { best: null, tied: 0 };
    const max = Math.max(...rated.map((m) => m.imdbRating));
    const tied = rated.filter((m) => m.imdbRating === max).sort((a, b) => a.title.localeCompare(b.title));
    return { best: tied[0], tied: tied.length };
  }

  // Oldest by RELEASE year (ties: first in list order).
  function oldestRelease(list) {
    const withYear = list.filter((m) => m.year !== null);
    if (!withYear.length) return null;
    return withYear.reduce((a, b) => (b.year < a.year ? b : a));
  }

  // Most recently WATCHED. Uses real watch dates when any exist; otherwise
  // falls back to the last entry in movies.txt and says so via `basis`.
  function mostRecentlyWatched(list) {
    if (!list.length) return null;
    const dated = list.filter((m) => m.watchedOn);
    if (dated.length) {
      const m = dated.reduce((a, b) => (b.watchedOn >= a.watchedOn ? b : a));
      return { movie: m, basis: "date", date: m.watchedOn };
    }
    return { movie: list[list.length - 1], basis: "list-order", date: null };
  }

  function countBy(list, keysOf) {
    const counts = new Map();
    list.forEach((m) => keysOf(m).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1)));
    return counts;
  }

  // Multi-genre titles count once in EACH of their genres.
  function genreCounts(list) {
    return [...countBy(list, (m) => m.genres).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function favoriteGenre(list) {
    const counts = genreCounts(list);
    if (!counts.length) return null;
    const [genre, count] = counts[0];
    const movies = list.filter((m) => m.genres.includes(genre)).sort((a, b) => (b.imdbRating ?? -1) - (a.imdbRating ?? -1));
    return { genre, count, movies };
  }

  // The release year with the most watched titles; ties go to the earlier year.
  function favoriteYear(list) {
    const counts = [...countBy(list, (m) => (m.year !== null ? [m.year] : [])).entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0]
    );
    if (!counts.length) return null;
    const [year, count] = counts[0];
    const movies = list.filter((m) => m.year === year).sort((a, b) => (b.imdbRating ?? -1) - (a.imdbRating ?? -1));
    return { year, count, movies };
  }

  // Each bar = number of titles carrying the genre; pct = share of ALL titles,
  // so percentages overlap (sum > 100%) and are explained on the page.
  function genreDistribution(list, { maxRows = 12 } = {}) {
    const total = list.length;
    if (!total) return { total, rows: [], hidden: 0, tags: 0 };
    const counts = genreCounts(list);
    const rows = counts.slice(0, maxRows).map(([genre, count]) => ({ genre, count, pct: (count / total) * 100 }));
    return { total, rows, hidden: Math.max(0, counts.length - maxRows), tags: counts.reduce((s, [, c]) => s + c, 0) };
  }

  // Total watch time. A series' OMDb runtime is ONE EPISODE, so series are
  // never added to the total. Entries whose type is not recorded yet are
  // counted (they are most likely films) but reported separately.
  function watchTime(list) {
    let minutes = 0;
    let counted = 0;
    let unknownType = 0;
    let excludedSeries = 0;
    let missingRuntime = 0;
    list.forEach((m) => {
      if (m.type === "series") {
        excludedSeries++;
        return;
      }
      if (m.runtimeMinutes === null) {
        missingRuntime++;
        return;
      }
      minutes += m.runtimeMinutes;
      counted++;
      if (m.type === null) unknownType++;
    });
    return { minutes, counted, unknownType, excludedSeries, missingRuntime };
  }

  function formatDuration(totalMinutes) {
    const m = Math.max(0, Math.round(totalMinutes));
    const days = Math.floor(m / 1440);
    const hours = Math.floor((m % 1440) / 60);
    const mins = m % 60;
    return { days, hours, mins, totalHours: Math.floor(m / 60) };
  }

  /* ---------------- text file parsers ---------------- */

  // artist.txt: one name per line. Blank lines and "#" comments are skipped,
  // names are trimmed/de-duplicated, and artistN numbering follows line order.
  function parseArtists(text) {
    if (typeof text !== "string") return [];
    const seen = new Set();
    const out = [];
    text.split(/\r?\n/).forEach((line) => {
      const name = line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
      if (!name || name.startsWith("#") || name.length > 120) return;
      const k = fold(name);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ name, index: out.length + 1 });
    });
    return out;
  }

  // about.txt: plain text -> paragraphs (blank-line separated), each a list of
  // lines (single line breaks preserved). Never interpreted as HTML.
  function parseParagraphs(text) {
    if (typeof text !== "string") return [];
    return text
      .replace(/\r\n?/g, "\n")
      .replace(/\u0000/g, "")
      .split(/\n{2,}/)
      .map((block) => block.split("\n").map((l) => l.replace(/\s+$/, "")))
      .map((lines) => lines.filter((l, i, a) => !(l === "" && (i === 0 || i === a.length - 1))))
      .filter((lines) => lines.length && lines.some((l) => l.trim()));
  }

  return {
    isHttpUrl,
    validImdbId,
    validWatchDate,
    fold,
    normalizeMovie,
    normalizeList,
    matchesQuery,
    filterMovies,
    sortMovies,
    bestOf,
    oldestRelease,
    mostRecentlyWatched,
    genreCounts,
    favoriteGenre,
    favoriteYear,
    genreDistribution,
    watchTime,
    formatDuration,
    parseArtists,
    parseParagraphs,
  };
});
