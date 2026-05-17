import React, { useState } from 'react';
import './App.css';
import ConfigForm from './components/ConfigForm';
import DescriptionPreview from './components/DescriptionPreview';
import ProgressList from './components/ProgressList';
import { getObject, getFilterResults, updateObject } from './api';

const INITIAL_CONFIG = {
  accountName: '',
  apiKey: '',
  projectId: '',
  filterId: '',
  itemType: '',
  descriptionMode: 'template',
  templateId: '',
  customHtml: '',
};

const accountUrl = (name) => `https://app.orcanos.com/${name}`;

const extractItems = (data) => data.Data?.Object ?? [];

const pageCountFrom = (data) => {
  const total = parseInt(data.Data?.Total_records ?? '0', 10);
  const size  = parseInt(data.Data?.Page_size   ?? '50', 10);
  return total > 0 ? Math.ceil(total / size) : 1;
};

const itemName = (item) => {
  if (item.Synopsis && item.Synopsis !== 0) return String(item.Synopsis);
  if (item.Name && item.Name !== 0) return String(item.Name);
  return '';
};

const isFrozen = (item) => {
  if (item.Freeze === '1' || item.Freeze === 1 || item.Freeze === true) return true;
  const f = item.Field?.find((f) => f.Name === 'Freeze' || f.Name === 'Is_Frozen');
  return f?.Text === '1' || f?.Text?.toLowerCase() === 'true' || f?.Text?.toLowerCase() === 'frozen';
};

// phase: 'form' | 'preview' | 'running' | 'done'
export default function App() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [phase, setPhase] = useState('form');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewItems, setPreviewItems] = useState([]);   // [{id, name}]
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [items, setItems] = useState([]);
  const [formError, setFormError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  function handleConfigChange(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePreview(e) {
    e.preventDefault();
    setFormError('');
    setLoadingPreview(true);
    try {
      let html;
      if (config.descriptionMode === 'html') {
        html = config.customHtml;
      } else {
        html = await getObject(accountUrl(config.accountName), config.apiKey, config.templateId);
      }
      setPreviewHtml(html);

      try {
        const first = await getFilterResults(accountUrl(config.accountName), config.apiKey, {
          filterId: config.filterId,
          projectId: config.projectId,
          itemType: config.itemType,
          pageNo: 1,
        });

        const pageCount = pageCountFrom(first);
        let allItems = extractItems(first);

        for (let page = 2; page <= pageCount; page++) {
          const res = await getFilterResults(accountUrl(config.accountName), config.apiKey, {
            filterId: config.filterId,
            projectId: config.projectId,
            itemType: config.itemType,
            pageNo: page,
          });
          allItems = allItems.concat(extractItems(res));
        }

        const rows = allItems.map((item) => ({
          id: item.Id,
          name: itemName(item),
          frozen: isFrozen(item),
        }));
        setPreviewItems(rows);
        setSelectedIds(new Set(rows.filter((r) => !r.frozen).map((r) => r.id)));
      } catch {
        setPreviewItems([]);
        setSelectedIds(new Set());
      }

      setPhase('preview');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleToggleItem(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll(checked) {
    setSelectedIds(checked ? new Set(previewItems.filter((r) => !r.frozen).map((r) => r.id)) : new Set());
  }

  async function handleStartUpdate() {
    const itemsToUpdate = previewItems.filter((item) => selectedIds.has(item.id));

    setPhase('running');
    setItems([]);

    if (itemsToUpdate.length === 0) {
      setItems([{ id: '—', name: 'No items selected', status: 'error', error: 'Select at least one item to update' }]);
      setPhase('done');
      return;
    }

    const rows = itemsToUpdate.map((item) => ({
      id: item.id,
      name: item.name,
      status: 'pending',
      error: null,
    }));
    setItems(rows);

    for (let i = 0; i < rows.length; i++) {
      setItems((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'in-progress' } : r))
      );
      try {
        await updateObject(accountUrl(config.accountName), config.apiKey, {
          itemId: rows[i].id,
          projectId: config.projectId,
          descriptionHtml: previewHtml,
        });
        setItems((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: 'success' } : r))
        );
      } catch (err) {
        const frozen = /frozen|freeze|lock/i.test(err.message);
        setItems((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: frozen ? 'frozen' : 'error', error: frozen ? null : err.message } : r))
        );
      }
    }

    setPhase('done');
  }

  function handleReset() {
    setPhase('form');
    setItems([]);
    setPreviewHtml('');
    setPreviewItems([]);
    setSelectedIds(new Set());
    setFormError('');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src="/orcanos-logo.svg" alt="Orcanos" />
        <div className="header-divider" />
        <h1>Description Mass Update</h1>
      </header>

      {(phase === 'form' || phase === 'preview') && (
        <div className="card">
          <div className="card-title">Configuration</div>
          <div className="card-subtitle">Enter your Orcanos credentials and filter details</div>
          <div className="info-box">
            <strong>What this tool does:</strong> Applies a Description to all items returned by a saved filter — in bulk, in one click. The description can come from an existing template work item, or you can paste your own HTML directly.
            <ol className="info-steps">
              <li>Fill in your account credentials and choose a project, filter, and item type.</li>
              <li>Under <em>Description Source</em>, either enter a Template Work Item ID or switch to <em>Paste HTML</em> and insert your own HTML description.</li>
              <li>Click <em>Preview Description</em> to see the description that will be applied and the list of affected items.</li>
              <li>Select the items you want to update, then click <em>Confirm Update</em> to apply.</li>
            </ol>
          </div>
          {formError && <div className="error-banner">{formError}</div>}
          <ConfigForm
            config={config}
            onChange={handleConfigChange}
            onSubmit={handlePreview}
            loading={loadingPreview}
          />
        </div>
      )}

      {phase === 'preview' && (
        <div className="card">
          <DescriptionPreview
            html={previewHtml}
            items={previewItems}
            selectedIds={selectedIds}
            onToggle={handleToggleItem}
            onSelectAll={handleSelectAll}
            onConfirm={handleStartUpdate}
            onBack={() => setPhase('form')}
          />
        </div>
      )}

      {(phase === 'running' || phase === 'done') && (
        <div className="card">
          <ProgressList items={items} onReset={handleReset} />
        </div>
      )}
    </div>
  );
}
