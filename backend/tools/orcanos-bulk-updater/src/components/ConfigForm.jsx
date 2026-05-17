import React from 'react';

const FIELDS = [
  { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Orcanos API key' },
  { key: 'projectId', label: 'Project ID', type: 'number', placeholder: '123' },
  { key: 'filterId', label: 'Filter ID', type: 'number', placeholder: '456' },
  { key: 'itemType', label: 'Item Type', type: 'text', placeholder: 'Requirement' },
];

export default function ConfigForm({ config, onChange, onSubmit, loading }) {
  const isHtmlMode = config.descriptionMode === 'html';

  return (
    <form className="config-form" onSubmit={onSubmit}>
      {/* Account name row — fixed base URL prefix */}
      <div className="form-row">
        <label htmlFor="accountName">Account Name</label>
        <div className="url-input-group">
          <span className="url-prefix">https://app.orcanos.com/</span>
          <input
            id="accountName"
            type="text"
            placeholder="mycompany"
            value={config.accountName}
            onChange={(e) => onChange('accountName', e.target.value)}
            required
          />
        </div>
      </div>

      {FIELDS.map(({ key, label, type, placeholder }) => (
        <div className="form-row" key={key}>
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            type={type}
            placeholder={placeholder}
            value={config[key]}
            onChange={(e) => onChange(key, e.target.value)}
            required
          />
        </div>
      ))}

      {/* Description source toggle */}
      <div className="form-row form-row--top">
        <label>Description Source</label>
        <div className="source-options">
          <label className="source-option">
            <input
              type="radio"
              name="descriptionMode"
              value="template"
              checked={!isHtmlMode}
              onChange={() => onChange('descriptionMode', 'template')}
            />
            Template Work Item
          </label>
          <label className="source-option">
            <input
              type="radio"
              name="descriptionMode"
              value="html"
              checked={isHtmlMode}
              onChange={() => onChange('descriptionMode', 'html')}
            />
            Paste HTML
          </label>
        </div>
      </div>

      {/* Conditional: template ID field or HTML textarea */}
      {!isHtmlMode ? (
        <div className="form-row">
          <label htmlFor="templateId">Template Work Item ID</label>
          <input
            id="templateId"
            type="number"
            placeholder="789"
            value={config.templateId}
            onChange={(e) => onChange('templateId', e.target.value)}
            required
          />
        </div>
      ) : (
        <div className="form-row form-row--top">
          <label htmlFor="customHtml">HTML Description</label>
          <textarea
            id="customHtml"
            className="html-textarea"
            placeholder="Paste your HTML description here…"
            value={config.customHtml}
            onChange={(e) => onChange('customHtml', e.target.value)}
            required
            spellCheck={false}
          />
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Fetching…' : 'Preview Description'}
        </button>
      </div>
    </form>
  );
}
