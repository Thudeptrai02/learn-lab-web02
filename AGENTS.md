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

## Data Generator (`/data-generator`)

| File | Purpose |
|------|---------|
| `index.html` | UI — loads all JS. Includes `quality-editor.js` script. |
| `js/data-generation.js` | Core engine: generate raw SPSS data, `firstPC`, `corrMatrixFromData`, `matInverse`, `computeKMO`, `bartlettTest`. |
| `js/quality-report.js` | Renders full quality report: Cronbach's α, EFA, regression, correlation, t-test. `c3(v,gl,gh,yl,yh)` utility for green/yellow/red CSS. |
| `js/quality-editor.js` | Fix all metrics by modifying raw data. Renders editor panel below report. |
| `js/ai-chat.js` | Chat UI with AI-driven fix functions (`aiAdjustAlphaDirect`, `aiSetRSquaredDirect`, `aiSetCorrelationDirect`), snapshot/restore. |
| `js/google-form.js` | Google Form creation, `parseFormHTML`, `generateFormScript`, `generateBaitSheetScript`. |

### Quality thresholds (SPSS textbook)

| Metric | Green (✅) | Yellow (⚠️) | Red (❌) |
|--------|-----------|-------------|---------|
| Cronbach's α | ≥ 0.80 (GOOD) | ≥ 0.60 (acceptable) | < 0.60 |
| Item-total r | ≥ 0.30 | — | < 0.30 |
| Factor loading | ≥ 0.50 | ≥ 0.45 | < 0.45 |
| KMO | ≥ 0.70 (meritorious) | ≥ 0.50 (acceptable) | < 0.50 |
| Bartlett Sig. | < 0.05 | — | ≥ 0.05 |
| Eigenvalue | > 1 | — | ≤ 1 |
| Cumulative % | > 50% | — | ≤ 50% |
| Communality | ≥ 0.30 | — | < 0.30 |
| R² | ≥ 0.50 | — | < 0.50 |
| F-test Sig. | < 0.05 | — | ≥ 0.05 |
| t-test Sig. | < 0.05 | — | ≥ 0.05 |
| Durbin-Watson | 1.5 – 2.5 | 1.3 – 2.7 | outside |
| VIF | < 2 (Likert) | < 10 | ≥ 10 |
| Tolerance (1/VIF) | ≥ 0.20 | ≥ 0.10 | < 0.10 |
| Correlation Sig. | < 0.05 (\*) / < 0.01 (\*\*) | — | ≥ 0.05 |

### Fix functions in `quality-editor.js`

| Function | What it does |
|----------|-------------|
| `fixConstructInternal(k)` | Pulls items toward composite (α + λ + AVE + KMO). |
| `fixItemTotalCorrelation(k)` | Ensures corrected item-total r ≥ 0.3. |
| `fixEFA_CrossLoading()` | Pulls cross-loading items toward primary factor. |
| `fixEFA_Communality()` | Pulls low-communality items toward factor mean. |
| `fixDV_Rsquared(k)` | Adjusts DV items to achieve target R². |
| `fixResidualNormality(k)` | Scales residuals toward N(0,1). |
| `fixVIF()` | Reduces IV inter-correlations > 0.5. |
| `_execAutoFixAll()` | Runs all fixes in sequence: item-total → Nội tại → EFA → R² → Residual → VIF. |
| `showEditorPanel()` | Force‑renders editor panel + scrolls to it with highlight flash. Called from 🔧 header button. |

## Gotchas

- `.env` contains **live API keys** and is committed to git. Do not rotate or expose in logs.
- `output: 'server'` + Vercel adapter means SSR. Static-only assumptions will break.
- Google Sheets CSV fetch can fail silently — all loaders return `[]` or `{}` on error.
- `src/data/toeic_flash_card/` and `src/data/exams/` contain JSON snapshots; `test-json.astro` uses `import.meta.glob('../../data/*.json')` to discover them.
