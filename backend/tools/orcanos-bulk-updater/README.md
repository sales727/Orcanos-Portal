# Orcanos Bulk Description Updater

A React + Vite SPA that bulk-updates the **Description** field of Orcanos work items by copying HTML from a template item.

## How it works

1. Fill in the configuration form
2. Click **Preview** — fetches the template item's description and the number of items the filter matches
3. Review the HTML that will be applied, then click **Start Update**
4. The progress table shows each item updating in real time

## Running locally

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. The Vite proxy forwards `/orcanos-proxy` → `https://app.orcanos.com` to avoid CORS in the browser.

## Configuration fields

| Field | Description | Example |
|---|---|---|
| Account Name | Your Orcanos subdomain path segment | `mariem` |
| API Key | From Admin → System Configuration → API | `abc123…` |
| Project ID | Numeric version/workspace ID (from the `web/{id}` part of the URL) | `18` |
| Filter ID | Numeric ID of the saved filter (`FilterId=` in the URL) | `266` |
| Item Type | Short item type code (`Item=` in the URL) | `USRP` |
| Template Item ID | `ItemId=` of the work item whose description to copy | `6177` |

## API endpoints used

All calls go to `https://app.orcanos.com/{accountName}/api/v2/Json/…`

| Endpoint | Method | Purpose |
|---|---|---|
| `QW_Get_Object/{id}` | GET | Fetch the template item's Description field |
| `QW_Get_Filter_Results` | POST | List all work items matching the filter |
| `QW_Update_Object` | POST | Write the new description to each item |

### `QW_Get_Filter_Results` request body

```json
{
  "Filter_id": 266,
  "Version_id": 18,
  "Item_Type": "USRP",
  "Page_no": 1,
  "Page_Size": 50
}
```

### `QW_Get_Filter_Results` response structure

```json
{
  "IsSuccess": true,
  "Data": {
    "Object": [
      {
        "Id": "7896",
        "Type": "USRP",
        "Field": [
          { "Name": "Object_Name", "Text": "My requirement" }
        ]
      }
    ],
    "Total_records": "4",
    "Current_page": "1",
    "Page_size": "50"
  }
}
```

> Items are paginated automatically. Page count is derived from `Total_records ÷ Page_size`.

## Authentication

Requests use `OrcanosAPIKey: {apiKey}` header. GET requests also send `Authorization: Bearer {apiKey}`.

## Project structure

```
src/
  api.js                  — all Orcanos API calls
  App.jsx                 — top-level state machine (form → preview → running → done)
  App.css                 — styles
  components/
    ConfigForm.jsx        — credential & filter input form
    DescriptionPreview.jsx — HTML preview + item count before update starts
    ProgressList.jsx      — per-item status table during/after update
public/
  orcanos-logo.svg        — header logo
  orcanos-icon.svg        — favicon
vite.config.js            — dev proxy config
```
