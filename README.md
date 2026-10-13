# Ghandi Movies

A personal, cinematic movie archive. You keep plain text lists; GitHub Actions looks the titles up on OMDb and writes JSON; a static website (no framework, no build step, no backend) shows it as posters on a cinema screen.

```
movies.txt  Watchlist.txt  collections.txt        <- you edit these
        │  (push to main, or run the workflow by hand)
        ▼
GitHub Actions  ──►  OMDb API   (key lives only in the OMDB_API_KEY secret)
        │
        ▼
movies.json  watchlist.json  collections.json    <- generated, committed back
        │
        ▼
GitHub Pages serves index.html, status.html, … (static files only)
```

The browser **never** talks to OMDb and never sees an API key. It only reads the generated JSON files and three optional plain-text files (`about.txt`, `artist.txt`). No analytics, no cookies, no third-party requests (fonts are self-hosted). The only thing stored in the browser is your theme choice.

## Pages

| Page | File | Data source |
|---|---|---|
| Home / Movie Collection | `index.html` + `script.js` | `movies.json` |
| My Status | `status.html` + `status.js` | `movies.json`, `artist.txt`, `assets/artists/` |
| Watchlist & Rewatchs | `watchlist.html` + `watchlist.js` | `watchlist.json` |
| Collection | `collection.html` + `collection.js` | `collections.json` |
| Pick a Movie | `random.html` + `random.js` | `watchlist.json` (only) |
| About & Credits | `about.html` + `about.js` | `about.txt` |

Shared code: `core.js` (pure logic: normalising, search, filters, statistics, parsers; unit-tested), `common.js` (header, menu, theme, cards, detail dialog), `style.css` (design system, themes, CSS cinema background), `theme-init.js` (applies the saved theme before first paint).

## Run it locally

Any static server works (the pages load JSON with `fetch`, so opening the files by double-click will not work):

```bash
python3 -m http.server 8000        # then open http://localhost:8000
node --test tests/core.test.js     # unit tests (Node 18+)
```

All links and assets are relative, so the site works at the root of a domain *and* under a GitHub Pages sub-path (`https://you.github.io/ghandi-movies/`).

## Deploy to GitHub Pages

1. Get a free key at <https://www.omdbapi.com/apikey.aspx> and activate it from the email.
2. Create a GitHub repository and push this folder to the `main` branch.
3. **Settings → Secrets and variables → Actions → New repository secret**: name `OMDB_API_KEY`, value = your key.
4. **Settings → Pages**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
5. **Actions → Update site data → Run workflow**. Tick **“Re-fetch every movie”** the first time after upgrading (see “One-time refresh” below).

## Updating your data

* **movies.txt**: one title per line. Optionally add the date you watched it: `Inception | 2024-03-14` (format `YYYY-MM-DD`). Lines without a date keep working. Watch dates are only ever shown if *you* wrote them.
* **Watchlist.txt**: one title per line (unchanged format and filename). Feeds the Watchlist page and Pick a Movie.
* **collections.txt**: unchanged format: a header such as `1. Marvel Cinematic Universe (MCU)` followed by one title per line.
* Push the change to `main`; the workflow runs automatically and commits the refreshed JSON. Titles already fetched are reused from the cache, so only new lines cost API requests.
* Titles OMDb cannot match are shown as a clearly-labelled error card (the rest of the site is unaffected). Use the exact IMDb title, or add the year, e.g. `The Mask 1994`.

### One-time refresh (movie / series labels)
Your existing JSON files were generated before the site could tell movies from series, so they have no `type`, `released` or `totalSeasons`. The updated scripts add them. Old entries keep working and are upgraded automatically on the next workflow run; if an upgrade request fails (rate limit, network) the old entry is kept untouched. Until then:

* movie / series badges are hidden, “Series only” shows a hint instead of results, “Movies only” includes every unlabelled title;
* Best Series, series seasons and the series exclusion from watch time need the labels. The pages say so wherever a number is affected.

The free OMDb tier allows 1,000 requests per day; a full re-fetch of this project is about 360 requests (titles shared between files are fetched once), well inside the daily limit.

## OMDb integration (and its limits)

* Done at build time in `scripts/` (Node 20, no dependencies). The key is read from `OMDB_API_KEY`, never written to disk or JSON, and the scripts refuse to write output that contains it.
* Stored per title: title, year, release date, type, IMDb id, IMDb rating, poster URL (http/https only), genres, cast, director, runtime, plot, rating, season count (series).
* Ratings shown are the IMDb rating field only. Missing values are stored as `null` and shown as “unknown”; nothing is estimated or invented.
* Poster images are loaded by the visitor's browser directly from the URL OMDb returns (not copied into the repo), lazily, with reserved dimensions and a styled text fallback.
* **Because the browser never calls OMDb, search covers the titles in your archive only** (titles, directors, genres, cast). OMDb has no actor-filmography endpoint, and a key embedded in client-side JavaScript could never be kept secret, so a live “search the whole internet” box was deliberately not added.
* A series' OMDb runtime is *one episode*. Total watch time therefore excludes known series and says so; it never multiplies by episodes you might have watched.

## My Status: how things are counted

* **Best movie / best series**: highest IMDb rating; ties are shown alphabetically and the tie is stated.
* **Total watch time**: sum of runtimes of non-series titles that have a runtime; notes list exclusions.
* **Favorite genre**: genre with the most titles. A title with several genres counts once in each of them (ties: alphabetical).
* **Genre distribution**: each bar is the share of *all* titles carrying that genre, so bars overlap and add up to more than 100%. The page explains this.
* **Favorite year**: release year with the most titles (ties: earlier year). Revealed with a lightweight scroll-triggered animation (IntersectionObserver; no scroll-jacking; shown instantly with reduced motion).
* **Home stats**: *Oldest film* is by **release year**. *Most recently watched* uses real watch dates from `movies.txt` when present; otherwise it shows the last entry of `movies.txt` and says no dates are recorded.

## artist.txt and artist images

Create `artist.txt` next to `index.html` (see `artist.example.txt`): one name per line. Blank lines and lines starting with `#` are ignored.

```
Tom Hanks
Meryl Streep
```

Line N uses the image `assets/artists/artistN.<ext>` (numbering follows the order of names, ignoring blanks/comments/duplicates):

| Line | Image file (recommended) |
|---|---|
| 1 | `assets/artists/artist1.webp` |
| 2 | `assets/artists/artist2.webp` |
| 3 | `assets/artists/artist3.webp` … and so on |

**Recommended format: WebP, portrait 4:5, about 920×1150 px, under 150 KB.** The site also accepts `.jpg`, `.jpeg`, `.png` and `.avif` with the same base name (tried in the order webp, jpg, jpeg, png, avif). A missing image shows the artist's initials instead. The artist rotates every 30 seconds with previous/next buttons, dots and a pause button; automatic rotation starts paused when the visitor prefers reduced motion, and pauses while the tab is hidden or the section is hovered/focused.

## about.txt

Create `about.txt` next to `index.html` (see `about.example.txt`). It is displayed as **plain text**: blank line = new paragraph, single line breaks are kept, HTML is shown literally and never executed. If the file is missing or empty the page shows a friendly note. Credits for OMDb/IMDb and fonts are built into the page.

## Cinema backgrounds

The site always draws its own cinema (curtains, unlit/lit screen, red seats, projector light) with pure CSS gradients: no image request, instant, dark and light variants. Optional artwork fades in on top only after the image has really loaded:

| Theme | Desktop (required for art) | Mobile portrait (optional) |
|---|---|---|
| Dark | `assets/bg/cinema-dark.webp` | `assets/bg/cinema-dark-mobile.webp` |
| Light | `assets/bg/cinema-light.webp` | `assets/bg/cinema-light-mobile.webp` |

Just drop the files in `assets/bg/`: no code or CSS changes. Missing files are harmless (the CSS fallback stays; the browser console may log a 404). If only the desktop file exists it is used on phones too. Each theme is independent, so you can add dark artwork first and light later. Recommended: WebP, desktop 2560×1440 (≤ 350 KB), mobile 1080×1920 (≤ 200 KB), screen centred in the upper half, both themes sharing identical composition. Image-generation prompts and the composition guide are in `docs/BACKGROUND_PROMPTS.md`.

The centre content panel (“the screen”) is sized to the painted screen frame of the fallback; with artwork, the panel's translucent edge lets the picture show through while keeping text readable.

## Security and privacy notes

* Strict Content-Security-Policy on every page: scripts, styles, fonts and data from the same origin only; images may come from https hosts (poster URLs); no inline scripts or styles.
* No `innerHTML`/`eval`; all data is written with `textContent`. URLs are validated (posters http/https only, IMDb ids must match `tt` + digits). A unit test scans the source for unsafe sinks and key-like strings.
* The workflow only triggers on `push` to `main` and manual runs (never on pull requests), has `contents: write` only, and its actions are pinned to commit SHAs.
* GitHub Pages cannot send HTTP security headers; the CSP is delivered via `<meta>` (so `frame-ancestors` is not enforceable).
* The old Wikidata “favorite actor/actress” lookup was **removed**: it sent your cast names to a third-party service. Favorite Artist now comes from your own `artist.txt`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| “movies.json was not found” | Run the workflow once (Actions tab). |
| Workflow: invalid API key | Activate the key via the OMDb email; re-save the secret. |
| No movie/series badges | Run the workflow with “Re-fetch every movie” (see above). |
| Wrong film matched | Make the line more exact (add the year) in the `.txt` file. |
| No artwork | Check filenames/folder exactly as in the table above. |

Credits: film data and ratings from OMDb (IMDb). Fonts Fraunces, Inter and Great Vibes under the SIL Open Font License (see `assets/fonts/`).
