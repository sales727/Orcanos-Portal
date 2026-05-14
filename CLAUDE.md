# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

**Backend (FastAPI)**
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend (Next.js)**
```
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`, the backend on `http://localhost:8000`. CORS is pre-configured for `localhost:3000`.

---

## Architecture

This is a **Next.js + FastAPI** app. The frontend calls the backend over HTTP; no shared runtime.

### Frontend (`frontend/`)
Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript. App Router — pages live under `frontend/app/`.

- `app/page.tsx` — home, tool card grid
- `app/automations/page.tsx` — automations list
- `app/automations/dms-uploader/page.tsx` — DMS Uploader tool (the only live tool)
- `app/run-history/page.tsx` — run history page

### Backend (`backend/`)
FastAPI app. All routes are under `/api/`.

- `main.py` — app setup, CORS, router registration
- `routers/dms.py` — DMS endpoints: `GET /api/dms/inspect`, `POST /api/dms/compare`, `POST /api/dms/upload`
- `tools/dms/comparison.py` — pure Python comparison logic:
  - `DocumentFile`, `OrcanosItem`, `ComparisonResult` dataclasses
  - `parse_dms_filename()` — parses filenames like `DMS-1234 Title Rev.F-2`
  - `load_files_from_bytes()` — ingests `{filename, bytes}` dicts (from FastAPI `UploadFile`) into `DocumentFile` objects; supports `.pdf`, `.docx`, `.xlsx`, `.pptx`
  - `compare_with_orcanos()` — matches by key, embedded key, or title; returns `UPDATE` / `CREATE` / `SAME` / `HOLD`
- `tools/dms/orcanos_api.py` — `OrcanosAPI` class wrapping the Orcanos REST API (`/api/v2/Json`). Auth via `OrcanosAPIKey` header. Key methods: `get_all_items()` (paginated), `add_object()`, `add_attachment_bytes()`, `update_object()`.
- `tools/dms/uploader.py` — `Uploader` class: creates/updates Orcanos records, attaches files (PDF + open format in two name variants), updates custom fields (`Legacy Revision`, `Legacy Key`).

### Adding a new tool
1. Create `backend/routers/<toolname>.py` with FastAPI routes and register it in `backend/main.py`.
2. Add business logic under `backend/tools/<toolname>/`.
3. Add a frontend page at `frontend/app/automations/<toolname>/page.tsx`.

---

## Design System

The target UI design is specified below (extracted from Figma). New pages and components should follow these tokens and patterns.

---

# Orcanos Automation Portal — Design Specification

Extracted from Figma reference: https://talon-check-39872718.figma.site/

---

## Brand & Identity

- **Product name:** Orcanos Automation Portal
- **Tagline:** Run internal API automations safely, from one place.
- **Logo:** Orcanos circular ring icon (purple, open at top-right with an orange accent dot) + "Orcanos" wordmark

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `purple-primary` | `#5B21B6` | Buttons, headings, card top border, active nav |
| `purple-medium` | `#7C3AED` | Links, tag text, subtitle highlights |
| `purple-light` | `#EDE9FE` | Tag backgrounds, hover states |
| `purple-avatar` | `#5B21B6` | User avatar background |
| `bg-page` | `#F5F5F7` | Page background (very light gray) |
| `bg-card` | `#FFFFFF` | Card / panel backgrounds |
| `text-heading` | `#111827` | Primary headings (dark near-black) |
| `text-body` | `#6B7280` | Descriptions, secondary text |
| `text-link` | `#7C3AED` | Inline links, "Open →" |
| `border-card` | `#E5E7EB` | Card borders |
| `warning-bg` | `#FFF7ED` | Warning banner background |
| `warning-border` | `#F97316` | Warning banner left border / icon |
| `orange-accent` | `#F59E0B` | Logo accent dot only |

---

## Typography

- **Font family:** Inter (sans-serif)
- **Fallback:** system-ui, -apple-system, sans-serif

| Element | Size | Weight | Color |
|---|---|---|---|
| Page title (h1) | 24–28px | 700 Bold | `purple-primary` |
| Tool title (h2) | 22px | 700 Bold | `purple-primary` |
| Section header | 18px | 600 Semibold | `text-heading` |
| Card title | 16px | 600 Semibold | `text-heading` |
| Body / description | 14px | 400 Regular | `text-body` |
| Tag / badge | 12px | 500 Medium | `purple-medium` |
| Nav item | 14px | 500 Medium | `text-heading` |
| Input label | 14px | 500 Medium | `text-heading` |
| Placeholder text | 14px | 400 Regular | `#9CA3AF` |
| Link ("Open →") | 14px | 500 Medium | `purple-medium` |

---

## Layout

### General
- Max content width: ~1200px, centered
- Page padding: 24–32px horizontal
- Page background: `#F5F5F7`

### Top Navigation Bar
- Background: white (`#FFFFFF`)
- Height: ~60px
- Bottom border: 1px `#E5E7EB`
- Left: Orcanos logo + "Orcanos" wordmark
- Center: navigation links — **Automations · Run History · Admin**
- Right: user avatar circle (purple, white initials, 36px)
- Active nav item: purple pill/capsule background, white text

---

## Components

### Navigation Bar
```
[Logo] Orcanos    [Automations] [Run History] [Admin]          [JD avatar]
```
- Active item: `bg-purple-primary`, `text-white`, `rounded-full`, `px-4 py-1`
- Inactive item: `text-heading`, hover `text-purple-medium`

---

### Tool Card (Home page — 3-column grid)
```
┌────────────────────────────────┐  ← 3px top border, purple-primary
│  [Icon]                        │
│                                │
│  Card Title                    │  ← 16px semibold, text-heading
│  Description text here.        │  ← 14px, text-body
│                                │
│  Open →                        │  ← 14px, purple-medium link
└────────────────────────────────┘
```
- Background: white
- Border: 1px `#E5E7EB`, `border-radius: 12px`
- Top accent: `3px solid #5B21B6` (top border only)
- Icon: outlined style, `#6B7280`, 24px
- Padding: 24px
- Shadow: subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`

---

### Tool Row (Automations list)
```
┌──────────────────────────────────────────────────────────┬──────────────────┐
│  Tool Name                                               │  [▷ Run          │
│  Description with purple inline links.                   │   Automation]    │
│  [Tag] [Tag] [Tag]   Last run: 2025-11-28                │                  │
└──────────────────────────────────────────────────────────┴──────────────────┘
```
- Background: white
- Border: 1px `#E5E7EB`, `border-radius: 10px`
- Padding: 20px 24px
- Tool name: 16px semibold, `text-heading`
- Description: 14px, `text-body`
- Tags: pill badges, `bg-purple-light`, `text-purple-medium`, `rounded-full`, `px-3 py-0.5`, `text-xs`
- "Last run" text: 12px, `text-body`

---

### Primary Button ("Run Automation")
- Background: `#5B21B6`
- Text: white, 14px medium
- Padding: `px-5 py-2.5`
- Border radius: `rounded-full` (pill)
- Prefix: `▷` play icon
- Hover: `#4C1D95` (slightly darker)
- Disabled: 50% opacity

### Secondary Button ("Cancel")
- Background: white
- Border: 1px `#E5E7EB`
- Text: `text-heading`, 14px
- Padding: `px-5 py-2.5`
- Border radius: `rounded-full`
- Hover: `bg-gray-50`

---

### Form Inputs
- Border: 1px `#D1D5DB`
- Border radius: `8px`
- Padding: `px-4 py-2.5`
- Font: 14px regular
- Placeholder: `#9CA3AF`
- Focus: border `#7C3AED`, ring `rgba(124,58,237,0.15)`
- Label: 14px medium, `text-heading`, above input with `mb-1`
- Required marker: red asterisk `*` inline after label
- Info icon: `ⓘ` after label, `text-body`, shows tooltip on hover

### Radio Buttons (Environment selector)
- Options: `● Sandbox` / `○ Production`
- Selected: filled purple circle
- Label: 14px, `text-heading`
- Layout: horizontal, gap 24px

### File Upload Area
- Border: `2px dashed #D1D5DB`
- Border radius: `8px`
- Background: `#FAFAFA`
- Center content: upload icon + "Click to upload or drag and drop" + accepted formats
- Hover: border `#7C3AED`, background `#F5F3FF`
- Padding: 40px

---

### Warning Banner
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠  This action interacts with Orcanos API. Only authorized         │
│     technicians should execute.                                      │
└─────────────────────────────────────────────────────────────────────┘
```
- Background: `#FFF7ED`
- Border: 1px `#FED7AA`
- Border radius: `8px`
- Icon: `⚠` orange `#F97316`
- Text: 14px, `#92400E`

---

### Tag / Badge
- Background: `#EDE9FE`
- Text color: `#7C3AED`
- Font: 12px medium
- Padding: `px-2.5 py-0.5`
- Border radius: `rounded-full`

---

## Pages

### 1. Login Page
- Split layout: left 55% branding, right 45% sign-in card
- Left: logo + "Orcanos Automation Portal" (bold purple h1) + tagline + decorative purple blurred circles (bottom-left)
- Right: white card, centered, `max-width: 400px`
  - "Sign in" heading (20px bold)
  - "Use your Orcanos Google account to continue." (14px gray)
  - "Continue with Google" button (white, border, Google logo icon)
  - SSO notice: gray box, "SSO enforced. Only authorized Orcanos users can access."
- Bottom: thin orange/yellow gradient line across full width

---

### 2. Home Page
- Heading: "Welcome to the Automation Portal" (purple, 28px bold)
- Subheading: "Select a tool to execute or explore your history." (gray, 16px)
- Grid: 3 columns, gap 24px
- Tool cards (see Tool Card component above)

---

### 3. Automations List Page
- Heading: "Automation Tools" (purple, 24px bold)
- Filter bar (white card):
  - Search input: "Search automations..." with 🔍 icon
  - Category dropdown: "All Categories" with filter icon
  - Sort: "Recently used"
- Tool rows list (see Tool Row component above)

---

### 4. Tool Detail / Run Page
```
← Back to Automations         (purple link, 14px)

[Tool Title]                  (purple, 24px bold)
[Description subtitle]        (gray, 14px, with purple inline links)

┌── Description card ─────────────────────────────────────────────┐
│  Description                                                      │
│  [Full description text]                                          │
│                                                                   │
│  Required Inputs          Expected Output       Avg. Duration     │
│  [value]                  [value]               [value]          │
└───────────────────────────────────────────────────────────────────┘

┌── Configuration card ───────────────────────────────────────────┐
│  Configuration                                                    │
│                                                                   │
│  [Form fields per tool]                                           │
│  [File upload area if needed]                                     │
└───────────────────────────────────────────────────────────────────┘

┌── Warning banner ───────────────────────────────────────────────┐
│  ⚠  This action interacts with Orcanos API. Only authorized      │
│     technicians should execute.                                   │
└───────────────────────────────────────────────────────────────────┘

                              [Cancel]  [▷ Run Automation]
```

---

### 5. Tool Result / Output Section (post-run, appears below form)
- Results table with: Action badge | DMS # | Title | File Rev | Orcanos Rev | Note | Upload? checkbox
- Action badges: color-coded pills
  - 🟢 CREATE — green
  - 🟡 UPDATE — amber
  - ⚪ SAME — gray
  - 🔴 HOLD — red
- Summary metrics row: total | CREATE | UPDATE | SAME | HOLD counts
- "Upload Selected" primary button

---

## Action Badge Colors

| Action | Background | Text |
|---|---|---|
| CREATE | `#DCFCE7` | `#15803D` |
| UPDATE | `#FEF9C3` | `#A16207` |
| SAME | `#F3F4F6` | `#6B7280` |
| HOLD | `#FEE2E2` | `#DC2626` |

---

## Spacing Scale (Tailwind)
- `gap-4` = 16px (tight)
- `gap-6` = 24px (default card gap)
- `p-6` = 24px (card padding)
- `rounded-xl` = 12px (cards)
- `rounded-full` (buttons, tags)
- `rounded-lg` = 8px (inputs, upload area)
