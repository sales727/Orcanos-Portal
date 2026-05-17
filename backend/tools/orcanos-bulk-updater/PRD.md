# PRD: Orcanos Bulk Description Updater

## 1. Overview
A React (Vite) single-page web application that allows Orcanos users to bulk-update the **Description** field of all work items returned by a given filter. The description can be sourced from an existing template work item **or** entered as raw HTML directly in the tool.

## 2. Problem Statement
Manually updating the description of many work items in Orcanos is time-consuming and error-prone. This tool automates the process: a user defines a description source (a template item or custom HTML), points the app at a filter, previews the description, selects the items to update, and applies the change in one click.

## 3. Users
Internal Orcanos users (e.g. project managers, QA leads) who manage large sets of work items and need to enforce a consistent description template across them.

## 4. Inputs
The user provides the following in a configuration form:

| Field | Type | Required | Description |
|---|---|---|---|
| Account Name | String | Yes | Subdomain of the Orcanos account, e.g. `mycompany` → resolves to `https://app.orcanos.com/mycompany` |
| API Key | String | Yes | Orcanos API key — sent as `OrcanosAPIKey` header |
| Project ID | Integer | Yes | Orcanos project identifier; also used as `View_Version` in update calls |
| Filter ID | Integer | Yes | ID of the saved Orcanos filter whose results will be updated |
| Item Type | String | Yes | Work item type for the filter, e.g. `Requirement`, `Test` |
| Description Source | Toggle | Yes | Choose between **Template Work Item** or **Paste HTML** modes (see Section 5) |
| Template Work Item ID | Integer | Conditional | Required when Description Source = Template Work Item. ID of the item whose Description HTML will be copied |
| HTML Description | HTML string | Conditional | Required when Description Source = Paste HTML. Raw HTML entered directly by the user |

## 5. Description Source Modes

### Mode A — Template Work Item
The app fetches the Description field of the specified work item via the Orcanos API and uses its raw HTML (including any embedded dynamic fields/filters) as the description to apply.

### Mode B — Paste HTML
No template item is needed. The user pastes raw HTML into a textarea. The entered HTML is used as-is as the description to apply.

In both modes the subsequent preview, item selection, and bulk-update flow is identical.

## 6. User Flow

### Step 1 — Fill Form
User fills all required fields, selects a Description Source mode, and clicks **"Preview Description"**.

### Step 2 — Preview
- **Template Work Item mode**: App fetches the template work item via `Get_Object` / `QW_Get_Object` and extracts the raw Description HTML (using `f.Value` to preserve embedded dynamic fields).
- **Paste HTML mode**: The entered HTML is used directly — no API call is made.
- The Description HTML is rendered in a preview panel.
- The app simultaneously fetches all pages of filter results and displays the matching work items in a selection list.
- Items that are frozen are shown with a "Frozen" badge and cannot be selected.
- User can check/uncheck individual items or use "Select all".
- User sees **"Confirm Update"** and **"Back"** buttons.

### Step 3 — Bulk Update
- App updates only the selected items sequentially.
- A progress list shows each item: ID, name, and status badge updating in real time (pending → in-progress → success / error / frozen).
- On completion, a summary shows counts: "X updated, Y failed, Z frozen".
- A **"Reset"** button clears all state and returns to the empty form for a new run.

## 7. API Integration

### Authentication
All requests use headers:
- `OrcanosAPIKey: {apiKey}`
- `Authorization: Bearer {apiKey}`

### fetchItemFields (internal helper)
Tries two endpoints in order, falling back if the first returns 404:
1. `GET {accountUrl}/api/v2/Json/Get_Object/{id}`
2. `GET {accountUrl}/api/v2/Json/QW_Get_Object/{id}`

**Response**: `{ IsSuccess, Data: { Field: [ { Name, Value, Text } ] } }`

**Field extraction**: Uses `f.Value ?? f.Text` per field. `f.Value` contains the raw stored value (preserving dynamic field syntax); `f.Text` is the fallback for fields that only expose a rendered value.

### Get template description (Template Work Item mode only)
- Calls `fetchItemFields` with the template item ID.
- Extracts `fields['Description']` → raw HTML string with dynamic fields intact.

### QW_Get_Filter_Results (fetch work items)
- **Method**: POST
- **URL**: `{accountUrl}/api/v2/Json/QW_Get_Filter_Results`
- **Body**:
  ```json
  {
    "Filter_id": <filterId>,
    "Version_id": <projectId>,
    "Item_Type": "<itemType>",
    "Page_no": <page>,
    "Page_Size": 50
  }
  ```
- Paginated: repeated with incrementing `Page_no` until all items are collected.
- **Response**: `{ IsSuccess, Data: { Object: [...], Total_records, Page_size } }`

### QW_Update_Object (update each work item)
- **Method**: POST
- **URL**: `{accountUrl}/api/v2/Json/QW_Update_Object`
- **Body**: Current item fields (fetched first via `fetchItemFields` to avoid overwriting other data), with the following overrides:
  ```json
  {
    ...currentFields,
    "Object_ID": <itemId>,
    "View_Version": "<projectId>",
    "Description": "<descriptionHtml>",
    "Updated_By": "API.User"
  }
  ```
- **Success**: `{ IsSuccess: true }`

### Error handling
- On any `IsSuccess: false` or network error, the item is marked **error** and the message is shown inline.
- Items whose error message matches `/frozen|freeze|lock/i` are marked **frozen** instead of error.
- Updating continues for all remaining items regardless of individual failures.

## 8. UI / Visual Design

### Branding
- **Primary color**: Purple `#6B3CA6`
- **Accent color**: Orange `#F5A623`
- **Background**: White `#FFFFFF`, page background `#F4F5F9`
- **Header**: Orcanos logo (`/orcanos-logo.svg`)

### Configuration card — info box
A light-purple info box appears at the top of the configuration card explaining what the tool does and providing numbered instructions covering both description source modes.

### Layout
```
┌─────────────────────────────────────────────────┐
│  [Orcanos Logo]  |  Description Mass Update      │
├─────────────────────────────────────────────────┤
│  CONFIGURATION CARD                              │
│  ┌─ info box ──────────────────────────────┐   │
│  │ What this tool does + 4-step guide      │   │
│  └─────────────────────────────────────────┘   │
│  Account Name   [ https://app.orcanos.com/ __ ] │
│  API Key        [ __________________________ ]  │
│  Project ID     [ _______ ]                     │
│  Filter ID      [ _______ ]                     │
│  Item Type      [ _______ ]                     │
│  Description    ◉ Template Work Item            │
│  Source         ○ Paste HTML                    │
│  Template WI ID [ _______ ]   ← or HTML textarea│
│                                                  │
│                    [ Preview Description ]       │
├─────────────────────────────────────────────────┤
│  PREVIEW CARD (visible after step 1)            │
│  ┌─────────────────────────────────────────┐   │
│  │  <rendered HTML description>            │   │
│  └─────────────────────────────────────────┘   │
│  ☑ Item 1234 — Req-001 Login                   │
│  ☑ Item 1235 — Req-002 Logout                  │
│  ☐ Item 1236 — Req-003 Signup  ❄ Frozen        │
│  [← Back]            [Confirm Update ▶]         │
├─────────────────────────────────────────────────┤
│  PROGRESS CARD (visible after step 2)           │
│  Updating 42 items…                             │
│  ┌──────┬──────────────────┬──────────┐        │
│  │  ID  │  Name            │  Status  │        │
│  │ 1234 │ Req-001 Login    │ ✓ Done   │        │
│  │ 1235 │ Req-002 Logout   │ ⟳ ...    │        │
│  │ 1236 │ Req-003 Signup   │ ❄ Frozen │        │
│  └──────┴──────────────────┴──────────┘        │
│  42 updated, 0 failed, 1 frozen   [ Reset ]     │
└─────────────────────────────────────────────────┘
```

### Status badge colors
| Status | Color |
|---|---|
| pending | Grey `#9CA3AF` |
| in-progress | Orange `#F5A623` |
| success | Green `#28A745` |
| error | Red `#DC3545` |
| frozen | Blue-grey (❄) |

## 9. Project Structure
```
orcanos-bulk-updater/
├── public/
│   └── orcanos-logo.svg
├── index.html
├── package.json
├── vite.config.js          ← dev proxy: /orcanos-proxy → https://app.orcanos.com
└── src/
    ├── main.jsx
    ├── App.jsx             ← state machine: form → preview → running → done
    ├── api.js              ← getObject(), getFilterResults(), updateObject()
    ├── App.css             ← global styles + Orcanos theme
    └── components/
        ├── ConfigForm.jsx          ← form with description source toggle
        ├── DescriptionPreview.jsx  ← rendered HTML + item selection + confirm/back
        └── ProgressList.jsx        ← live status table + summary + Reset button
```

## 10. Non-functional Requirements
- **CORS**: A Vite dev proxy forwards `/orcanos-proxy` → `https://app.orcanos.com` to avoid browser CORS restrictions in development. Production builds use the full URL directly.
- **Sequential updates**: Items are updated one at a time to avoid rate limiting.
- **Dynamic field preservation**: Descriptions are fetched using the raw `Value` field from the API response (not the rendered `Text`) so that embedded Orcanos dynamic fields and filters are preserved and resolve correctly on each target item.
- **No backend required**: Pure frontend app; can be served as static files.
- **No authentication persistence**: API key is not stored beyond the browser session.

## 11. Out of Scope
- Scheduling / automation
- Multi-project or multi-filter runs in a single session
- Editing the description HTML in a rich-text editor within the tool
