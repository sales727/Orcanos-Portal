---
name: orcanos-tool-ui
description: This skill should be used when the user asks to "apply the Orcanos design", "use the same design as the bulk updater", "create a new Orcanos tool", "build an internal Orcanos tool", "match the Orcanos UI", or is building any internal React web tool for Orcanos users. Provides the complete design system, CSS variables, component patterns, and layout conventions used across Orcanos internal tools.
version: 1.0.0
---

# Orcanos Internal Tool UI Design System

This skill captures the complete design system used in Orcanos internal React tools (e.g. the Bulk Description Updater). Apply it when building any new tool for Orcanos users to ensure a consistent look and feel.

## Stack

- **React** (Vite, JSX) — no CSS-in-JS, plain `.css` file
- **No UI library** — all components hand-written
- **Font**: `'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

---

## CSS Variables

Paste this `:root` block verbatim into `App.css`:

```css
:root {
  --purple:      #6B3CA6;
  --purple-dark: #572f88;
  --purple-bg:   #F0EBFA;
  --orange:      #F5A623;
  --green:       #28A745;
  --red:         #DC3545;
  --grey:        #9CA3AF;
  --bg:          #FFFFFF;
  --page-bg:     #F4F5F9;
  --border:      #E5E7EB;
  --border-light:#F0F0F4;
  --text:        #1F2937;
  --text-muted:  #6B7280;
  --font:        'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  font-size: 13px;
  background: var(--page-bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
```

---

## Layout Shell

The app is centered in a narrow column. All content sits inside `.app-shell`.

```css
.app-shell {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 0 60px;
}
```

---

## Header

A white pill-shaped bar with the Orcanos logo, a divider, and the tool name in purple.

```jsx
<header className="app-header">
  <img src="/orcanos-logo.svg" alt="Orcanos" />
  <div className="header-divider" />
  <h1>Your Tool Name</h1>
</header>
```

```css
.app-header {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 24px;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.app-header img { height: 26px; width: auto; object-fit: contain; }
.header-divider { width: 1px; height: 20px; background: var(--border); }
.app-header h1 { color: var(--purple); font-size: 17px; font-weight: 600; }
```

---

## Cards

Every section of the page lives in a `.card`. Cards stack vertically with `margin-bottom: 20px`.

```jsx
<div className="card">
  <div className="card-title">Section Title</div>
  <div className="card-subtitle">A short description of what this section does.</div>
  {/* content */}
</div>
```

```css
.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px 24px;
  margin: 0 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.card-title    { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.card-subtitle { font-size: 11px; color: var(--text-muted); margin-bottom: 18px; }
```

---

## Info Box

Use at the top of a configuration card to explain what the tool does and provide numbered steps.

```jsx
<div className="info-box">
  <strong>What this tool does:</strong> One sentence summary.
  <ol className="info-steps">
    <li>Step one.</li>
    <li>Step two — reference UI elements with <em>italics</em>.</li>
    <li>Step three.</li>
  </ol>
</div>
```

```css
.info-box {
  background: var(--purple-bg);
  border: 1px solid #D8C9F0;
  border-radius: 4px;
  padding: 12px 14px;
  margin-bottom: 18px;
  font-size: 12px;
  color: var(--text);
  line-height: 1.6;
}
.info-steps { margin: 8px 0 0 18px; padding: 0; }
.info-steps li { margin-bottom: 4px; }
.info-steps li:last-child { margin-bottom: 0; }
```

---

## Forms

Forms use a two-column grid: a 190px label column and a flexible input column. Add `form-row--top` when the right column is taller than one line (e.g. radio groups, textareas).

```jsx
<form className="config-form" onSubmit={onSubmit}>
  <div className="form-row">
    <label htmlFor="myField">Field Label</label>
    <input id="myField" type="text" placeholder="example" value={...} onChange={...} required />
  </div>

  {/* For multi-line right column */}
  <div className="form-row form-row--top">
    <label>Options</label>
    <div>...</div>
  </div>

  <div className="form-actions">
    <button type="submit" className="btn-primary" disabled={loading}>
      {loading ? 'Working…' : 'Action Label'}
    </button>
  </div>
</form>
```

```css
.config-form { display: flex; flex-direction: column; gap: 14px; }
.form-row {
  display: grid;
  grid-template-columns: 190px 1fr;
  align-items: center;
  gap: 12px;
}
.form-row--top { align-items: flex-start; }
.form-row label { font-size: 13px; font-weight: 500; color: var(--text); }
.form-row input {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  width: 100%;
  transition: border-color .15s, box-shadow .15s;
}
.form-row input::placeholder { color: var(--grey); }
.form-row input:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 2px rgba(107,60,166,.12);
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
  border-top: 1px solid var(--border-light);
  margin-top: 4px;
}
```

### URL prefix input variant

When an input has a fixed text prefix (e.g. a base URL), wrap it in `.url-input-group`:

```jsx
<div className="url-input-group">
  <span className="url-prefix">https://app.orcanos.com/</span>
  <input type="text" placeholder="mycompany" ... />
</div>
```

```css
.url-input-group {
  display: flex; align-items: stretch;
  border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
  transition: border-color .15s, box-shadow .15s;
}
.url-input-group:focus-within { border-color: var(--purple); box-shadow: 0 0 0 2px rgba(107,60,166,.12); }
.url-prefix {
  background: var(--page-bg); color: var(--text-muted);
  font-size: 12px; padding: 7px 10px; white-space: nowrap;
  border-right: 1px solid var(--border); user-select: none;
  display: flex; align-items: center;
}
.url-input-group input { border: none; border-radius: 0; flex: 1; min-width: 0; box-shadow: none !important; }
```

### Radio toggle variant

For mutually exclusive mode switches inside a form row:

```jsx
<div className="form-row form-row--top">
  <label>Mode</label>
  <div className="source-options">
    <label className="source-option">
      <input type="radio" name="mode" value="a" checked={mode==='a'} onChange={...} />
      Option A
    </label>
    <label className="source-option">
      <input type="radio" name="mode" value="b" checked={mode==='b'} onChange={...} />
      Option B
    </label>
  </div>
</div>
```

```css
.source-options { display: flex; gap: 20px; padding-top: 2px; }
.source-option { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: normal; color: var(--text); cursor: pointer; }
.source-option input[type="radio"] { accent-color: var(--purple); width: 14px; height: 14px; cursor: pointer; }
```

### Textarea variant (code/HTML input)

```jsx
<textarea className="html-textarea" placeholder="Paste content here…" value={...} onChange={...} required spellCheck={false} />
```

```css
.html-textarea {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 12px; font-family: 'Courier New', Courier, monospace;
  color: var(--text); background: var(--bg); width: 100%;
  min-height: 160px; resize: vertical;
  transition: border-color .15s, box-shadow .15s; line-height: 1.5;
}
.html-textarea::placeholder { color: var(--grey); }
.html-textarea:focus { outline: none; border-color: var(--purple); box-shadow: 0 0 0 2px rgba(107,60,166,.12); }
```

---

## Buttons

Two variants. Always place inside `.form-actions` or `.preview-actions` (flex, justify-content: flex-end).

```css
.btn-primary {
  background: var(--purple); color: #fff; border: none;
  padding: 8px 18px; border-radius: 4px;
  font-size: 13px; font-family: var(--font); font-weight: 500;
  cursor: pointer; transition: background .15s; letter-spacing: 0.01em;
}
.btn-primary:hover:not(:disabled) { background: var(--purple-dark); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.btn-secondary {
  background: var(--bg); color: var(--text-muted);
  border: 1px solid var(--border); padding: 8px 16px; border-radius: 4px;
  font-size: 13px; font-family: var(--font); font-weight: 400;
  cursor: pointer; transition: background .15s, border-color .15s;
}
.btn-secondary:hover { background: var(--page-bg); border-color: #C4B5D6; color: var(--text); }
```

Action bars (preview, summary) use:
```css
.preview-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 16px; padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
```

---

## Error Banner

Shown above a form when a submission error occurs.

```jsx
{error && <div className="error-banner">{error}</div>}
```

```css
.error-banner {
  background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C;
  border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px;
}
```

---

## Status Badges

Pill-shaped inline badges for item/row status:

```jsx
<span className={`badge badge-${status}`}>{label}</span>
```

```css
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.badge-pending     { background: #F3F4F6; color: #9CA3AF; }
.badge-in-progress { background: #FEF3C7; color: #92400E; }
.badge-success     { background: #D1FAE5; color: #065F46; }
.badge-error       { background: #FEE2E2; color: #991B1B; }
.badge-frozen      { background: #EFF6FF; color: #1D4ED8; }
```

---

## Data Tables (progress / results)

Scrollable bordered table with a sticky header row and a page-background thead.

```css
.progress-table-wrap {
  border: 1px solid var(--border); border-radius: 4px;
  overflow: hidden; max-height: 420px; overflow-y: auto;
}
.progress-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.progress-table th {
  background: var(--page-bg); padding: 9px 14px; text-align: left;
  font-weight: 600; font-size: 12px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border); position: sticky; top: 0;
}
.progress-table td {
  padding: 9px 14px; border-bottom: 1px solid var(--border-light);
  vertical-align: middle; color: var(--text);
}
.progress-table tr:last-child td { border-bottom: none; }
.progress-table tr:hover td { background: #FAFAFA; }
```

---

## Selectable Item List

A scrollable bordered list of checkboxes used before a bulk action.

```css
.item-select-list {
  border: 1px solid var(--border); border-radius: 4px;
  overflow: hidden; max-height: 260px; overflow-y: auto;
}
.item-select-row { padding: 8px 14px; border-bottom: 1px solid var(--border-light); }
.item-select-row:last-child { border-bottom: none; }
.item-select-row--header { background: var(--page-bg); border-bottom: 1px solid var(--border) !important; }
.item-select-row:not(.item-select-row--header):not(.item-select-row--frozen):hover { background: #FAFAFA; }
.item-select-row--frozen { background: #F8FAFF; opacity: 0.7; cursor: not-allowed; }
.item-checkbox-label {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; width: 100%; font-size: 13px; user-select: none;
}
.item-checkbox-label input[type="checkbox"] { width: 15px; height: 15px; flex-shrink: 0; accent-color: var(--purple); }
```

---

## Design Principles

- **13px base font** — matches Orcanos app UI density.
- **Purple as the only accent** — `#6B3CA6` for focus rings, buttons, checkboxes, radio buttons. Orange (`#F5A623`) is reserved for "in-progress" status only.
- **Borders, not shadows** — cards and inputs use `1px solid var(--border)` with only a subtle `box-shadow: 0 1px 3px rgba(0,0,0,.05)`. No heavy elevation.
- **Radius is always 4px or 6px** — 6px for cards and the header, 4px for inputs, buttons, badges, and banners.
- **Transitions are .15s** — `border-color` and `box-shadow` on interactive elements; `background` on buttons.
- **No icons library** — use Unicode characters for status indicators (✓, ✕, ⟳, ❄) and keep them inside badge spans.
