# Learn Lab Web — AGENTS.md

## Stack

- **Astro 6** (SSR via `@astrojs/vercel`), **Tailwind CSS v4** (Vite plugin).
- **Supabase** auth + DB. Public client uses `PUBLIC_SUPABASE_ANON_KEY`; admin API uses `SUPABASE_SERVICE_ROLE_KEY`. Both in `.env`.
- **Data source**: Google Sheets (fetched at runtime via `fetch` + `papaparse`). Sheet IDs hardcoded in `src/lib/`. No local DB migration needed.
- **Google Sheets Export**: Survey responses can be exported to Google Sheets via `googleapis` + service account. Requires `GOOGLE_SHEETS_SERVICE_ACCOUNT` env var (JSON string of service account key).
- **AI APIs**: Gemini (`GEMINI_API_KEY`) in `src/pages/api/generate.js`; Groq (`GROQ_API_KEY`) in `src/pages/api/grade-writing.js`.

## Commands

```sh
npm run dev       # start dev server at localhost:4321
npm run build     # production build → ./dist/
npm run preview   # serve built output
```

No lint, typecheck, or test scripts exist.

## Architecture

| Area | Path | Notes |
|------|------|-------|
| Blog content | `src/content/blog/*.md` | Astro 6 content collection. Frontmatter slug field overrides URL (needed for Vietnamese filenames). |
| Pages | `src/pages/` | File-based routing. Dynamic routes: `[slug].astro`, `[id].astro`. |
| API endpoints | `src/pages/api/*.js` | Each must have `export const prerender = false`. |
| Layout | `src/layouts/Layout.astro` | Shared shell with Header (Supabase auth UI), Footer, SmartPopup. |
| Exam data (JSON) | `src/data/exams/reading/`, `src/data/exams/listening/` | Auto-loaded by `test-json.astro` via `import.meta.glob`. |
| Cambridge (MDX) | `src/content/exams/*.mdx` | Structured frontmatter with parts/questions. |
| Shared libs | `src/lib/` | `supabase.js`, `loadExam.js`, `cambridge.js`, `loadIelts.js`, `googleSheets.js`, `sheetExport.js`. The latter writes via Google Sheets API + service account. |
| TOEIC exam catalog | Fetched from Google Sheets Master Sheet (URL in `loadExam.js`). Exam URLs come from the catalog CSV. |
| Flashcards / Dictation | Google Sheets → parsed in `googleSheets.js`. Pages at `english-lab/toeic/flashcards/[topic].astro`. |

## Key Conventions

- **Image paths**: `public/images/` → served at `/images/...`. Blog posts reference via frontmatter `image:`.
- **Blog slug**: Use `slug` in frontmatter for safe ASCII URLs. `{post.data.slug ?? post.slug ?? post.id}` is the fallback chain.
- **All text/UI is Vietnamese** — labels, buttons, error messages.
- **No components library** — hand-rolled Tailwind components. Check existing `.astro` files for patterns before adding UI.

## Gotchas

- `.env` contains **live API keys** and is committed to git. Do not rotate or expose in logs.
- `output: 'server'` + Vercel adapter means SSR. Static-only assumptions will break.
- Google Sheets CSV fetch can fail silently — all loaders return `[]` or `{}` on error.
- `src/data/toeic_flash_card/` and `src/data/exams/` contain JSON snapshots; `test-json.astro` uses `import.meta.glob('../../data/*.json')` to discover them.
