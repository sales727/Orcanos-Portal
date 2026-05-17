// In dev the Vite proxy forwards /orcanos-proxy → https://app.orcanos.com,
// avoiding the browser CORS restriction. In a production build the full URL is used.
const resolve = (accountUrl, path) => {
  if (import.meta.env.DEV) {
    const accountPath = accountUrl.replace('https://app.orcanos.com', '');
    return `/orcanos-proxy${accountPath}${path}`;
  }
  return `${accountUrl}${path}`;
};


const getHeaders = (apiKey) => ({
  'Accept': 'application/json',
  OrcanosAPIKey: apiKey,
  Authorization: `Bearer ${apiKey}`,
});

const postHeaders = (apiKey) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  OrcanosAPIKey: apiKey,
});

async function fetchItemFields(accountUrl, apiKey, itemId) {
  const endpoints = [
    `/api/v2/Json/Get_Object/${itemId}`,
    `/api/v2/Json/QW_Get_Object/${itemId}`,
  ];
  for (const path of endpoints) {
    const res = await fetch(resolve(accountUrl, path), { headers: getHeaders(apiKey) });
    if (res.status === 404) continue;
    const json = await res.json();
    if (!json.IsSuccess) continue;
    const fields = json.Data?.Field ?? json.Data?.Fields ?? [];
    return Object.fromEntries(fields.map((f) => [f.Name, f.Value ?? f.Text]));
  }
  return {};
}

// Template item may live in any project — no project context sent here.
export async function getObject(accountUrl, apiKey, templateId) {
  const fields = await fetchItemFields(accountUrl, apiKey, templateId);
  if (!('Description' in fields)) {
    throw new Error('Description field not found on template item. Check your Account Name and API Key.');
  }
  return fields['Description'];
}

export async function getFilterResults(accountUrl, apiKey, { filterId, projectId, itemType, pageNo }) {
  const body = {
    Filter_id: parseInt(filterId, 10),
    Version_id: parseInt(projectId, 10),
    Item_Type: itemType,
    Page_no: pageNo,
    Page_Size: 50,
  };

  const res = await fetch(resolve(accountUrl, '/api/v2/Json/QW_Get_Filter_Results'), {
    method: 'POST',
    headers: postHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.IsSuccess) throw new Error(json.Message || 'QW_Get_Filter_Results failed');
  return json;
}

// Fetches the item's current fields first, spreads them all unchanged, then
// overrides only Description — so no other field is ever modified.
export async function updateObject(accountUrl, apiKey, { itemId, projectId, descriptionHtml }) {
  const current = await fetchItemFields(accountUrl, apiKey, itemId);

  const res = await fetch(resolve(accountUrl, '/api/v2/Json/QW_Update_Object'), {
    method: 'POST',
    headers: postHeaders(apiKey),
    body: JSON.stringify({
      ...current,
      Object_ID: itemId,
      View_Version: String(projectId),
      Description: descriptionHtml,
      Updated_By: 'API.User',
    }),
  });
  const json = await res.json();
  if (!json.IsSuccess) throw new Error(json.Message || 'QW_Update_Object failed');
  return json;
}
