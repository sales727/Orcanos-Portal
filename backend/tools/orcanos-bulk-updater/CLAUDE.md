# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # production build → dist/
npm run lint      # ESLint
npm run preview   # serve the production build locally
```

No test suite is configured.

## Architecture

Pure React (Vite) SPA — no backend. All Orcanos API calls go directly from the browser; in dev, a Vite proxy rewrites `/orcanos-proxy/*` → `https://app.orcanos.com/*` to avoid CORS.

### State machine (`App.jsx`)
The app moves through four phases managed by a single `phase` state:

```
form → preview → running → done
```

- **form / preview**: the configuration card is visible. On "Preview Description", the app fetches the description (from a template item or uses pasted HTML) and all filter pages in parallel, then transitions to `preview`.
- **preview**: `DescriptionPreview` shows the rendered HTML and a selectable item list. "Confirm Update" starts the sequential update loop.
- **running / done**: `ProgressList` takes over; each item moves through `pending → in-progress → success | error | frozen` as updates complete. "Reset" returns to `form`.

### Description source modes
Two mutually exclusive modes controlled by `config.descriptionMode`:
- `'template'` — calls `getObject()` to fetch raw HTML from a template work item.
- `'html'` — uses `config.customHtml` directly, skipping any API call.

Both modes set the same `previewHtml` state, so everything downstream (preview rendering, bulk update) is mode-agnostic.

### `src/api.js` — three exports
- **`getObject(accountUrl, apiKey, templateId)`** — tries `Get_Object` then `QW_Get_Object`; returns the raw `Description` field value.
- **`getFilterResults(accountUrl, apiKey, { filterId, projectId, itemType, pageNo })`** — POST to `QW_Get_Filter_Results`; caller paginates by incrementing `pageNo` until page count is exhausted.
- **`updateObject(accountUrl, apiKey, { itemId, projectId, descriptionHtml })`** — fetches the item's current fields first, then POSTs them back with only `Description` overridden, so no other field is ever modified.

**Field extraction uses `f.Value ?? f.Text`** — `f.Value` is the raw stored value and preserves embedded Orcanos dynamic field syntax; `f.Text` is the rendered fallback. Using `f.Text` alone would flatten dynamic fields to static text.

### Frozen item handling
An item is considered frozen if the API response contains `Freeze === '1'` at the top level, or a field named `Freeze` / `Is_Frozen` with a truthy value. Frozen items are pre-deselected in the preview and get a `frozen` badge (not `error`) if the update error message matches `/frozen|freeze|lock/i`.

### CORS in dev
Account name (e.g. `mycompany`) is stored separately from the base URL. `accountUrl()` builds `https://app.orcanos.com/mycompany`. In dev, `resolve()` in `api.js` strips the origin and prepends `/orcanos-proxy` so the Vite proxy forwards the request.
