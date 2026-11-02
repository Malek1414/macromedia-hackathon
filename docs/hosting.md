# Hosting the fallback globe as a static site

Status: **prepared, not published.** Nothing here has been deployed. Malek decides whether and where.

The fallback globe is plain static files. No server, no build, no keys. This repo is currently private.

## What the page needs

| Needed at runtime | Where it comes from |
|---|---|
| `fallback/index.html`, `app.js`, `worker.js`, `style.css`, `favicon.svg` | the repo |
| `engine/*.js` | the repo. `app.js` and `worker.js` import `../engine/index.js`, so `engine/` must sit **next to** `fallback/` |
| CesiumJS 1.123.0 | `fallback/vendor/cesium/` (20 MB, git-ignored, made by `./scripts/vendor-cesium.sh`). If it is missing, `index.html` falls back to `cdn.jsdelivr.net` |
| NASA GIBS tiles (Blue Marble, Black Marble) | `gibs.earthdata.nasa.gov`, live from the internet, never copied |
| Fonts (Inter, JetBrains Mono) | Google Fonts, live; the page still works with system fonts if blocked |

`?offline` (e.g. `/fallback/?offline`) swaps the NASA tiles for the Natural Earth map that ships inside the Cesium folder and drops the night lights. It also switches on by itself after 6 NASA tile errors. So the deployed copy still needs the vendored Cesium folder to work with no internet at all; only the fonts degrade.

Since both Worker URLs and the `../engine` import are relative, the site works from any sub-path (for example `https://user.github.io/repo/fallback/`), as long as the folder layout is kept.

## Folder layout to upload

```
site/
  index.html        (forwards to fallback/)
  fallback/         (with vendor/cesium/ inside)
  engine/           (the tests are left out)
```

Size: about 20 MB, 389 files, almost all of it Cesium. `engine/` is 56 KB, the page itself 76 KB.

Build it (runs `vendor-cesium.sh` first if the vendor folder is missing; needs internet once for `npm pack`):

```bash
./scripts/build-static.sh /tmp/macromedia-static   # default: ../macromedia-static
```

Check it locally before anything else:

```bash
cd /tmp/macromedia-static && python3 -m http.server 5391
open http://127.0.0.1:5391/fallback/
```

Upload the **contents of that folder** (the folder that holds `index.html`, `fallback/`, `engine/`), not a parent of it.

## Option A: GitHub Pages

Who can use it ([plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Pages docs](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)):

- GitHub Free: the repo **must be public**.
- Pro and Team list Pages for private repos, but the site URL is still public. Access-controlled Pages needs an organization on GitHub Enterprise Cloud.
- Limits ([source](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)): published site at most 1 GB, soft 100 GB bandwidth per month, deploys time out after 10 minutes. 20 MB is far inside that.

Making this repo public exposes everything in it (`pitch/`, `docs/`, history). Check that before flipping it. A cleaner route is a **separate public repo that holds only the static copy**:

```bash
./scripts/build-static.sh /tmp/macromedia-static
cd /tmp/macromedia-static
git init -b main && git add -A && git commit -m "static copy"
gh repo create <name> --public --source=. --push
```

Then on GitHub: Settings > Pages > Build and deployment > Source "Deploy from a branch" > branch `main`, folder `/ (root)` > Save. The entry file must be at the top level of the source. Allow up to about 10 minutes. URL: `https://<user>.github.io/<name>/`.

Note: the vendor folder is in `.gitignore` of this repo only; in the new repo it is committed, which is what we want. Do not use `/docs` here; the layout needs `engine/` next to `fallback/`.

## Option B: Netlify

Docs: [deploys](https://docs.netlify.com/site-deploys/create-deploys/), [CLI](https://docs.netlify.com/cli/get-started/).

Drag and drop (Netlify Drop, no CLI):
1. Build the folder (above).
2. Open https://app.netlify.com/drop and drag the **folder** (not a zip) onto the page. The docs say to unzip first.
3. Without login the files are published as-is; an anonymous project is temporary and has to be claimed within one hour.

CLI:

```bash
npm install -g netlify-cli
netlify login                                   # browser login
netlify deploy --dir=/tmp/macromedia-static     # draft URL, safe to look at
netlify deploy --dir=/tmp/macromedia-static --prod   # main site URL
```

The first run asks to create or link a site. `netlify deploy --allow-anonymous` skips the account (project is removed after one hour unless claimed). No build command is needed.

## Option C: Vercel

Docs: [vercel deploy](https://vercel.com/docs/cli/deploy).

I found no drag-and-drop upload in the docs; use the CLI (or connect a Git repo in the dashboard, which implies a GitHub repo).

```bash
npm install -g vercel
cd /tmp/macromedia-static
vercel login
vercel            # first deploy of a new project is production; later previews need --prod to go live
vercel --prod
```

Answer the setup questions with "no framework", output directory `.`. `vercel deploy --temporary` deploys without an account (prints a claim URL, expires). With 389 files the CLI is fine; for thousands of files the docs suggest `--archive=tgz`.

## Which one

- Fastest, no account: Netlify Drop. Two minutes.
- Cleanest URL history: Netlify or Vercel with an account.
- GitHub Pages only makes sense with a public static-only repo.

## Checked locally (Nov 2)

Built with `scripts/build-static.sh`, served with `python3 -m http.server`, loaded in headless Chrome:
- Title screen renders; "Hand over the planet" starts the run (intro hides, HUD and three futures appear, globe with night lights).
- `?offline`: the Natural Earth map loads, one console warning ("NASA imagery unreachable"), no errors.
- No 404s, no jsdelivr requests (Cesium loads from the local copy). Only external hosts: NASA GIBS, Google Fonts.

Reminder for anything shown publicly: these are possible futures, not predictions.
