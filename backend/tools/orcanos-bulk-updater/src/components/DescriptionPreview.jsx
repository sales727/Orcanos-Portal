import React, { useRef, useEffect } from 'react';

export default function DescriptionPreview({ html, items, selectedIds, onToggle, onSelectAll, onConfirm, onBack }) {
  const selectAllRef = useRef(null);

  const updatable = items.filter((i) => !i.frozen);
  const frozenCount = items.length - updatable.length;
  const allSelected = updatable.length > 0 && selectedIds.size === updatable.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < updatable.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="preview-section">
      <h2>Template Description Preview</h2>
      <p className="card-subtitle">
        Review the description that will be copied to the selected items
      </p>
      <div
        className="preview-html"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="item-select-header">
        <span className="item-select-title">Items to update</span>
        <span className="item-select-count">
          {selectedIds.size} of {updatable.length} selected
          {frozenCount > 0 && <> · <span className="frozen-count">{frozenCount} frozen</span></>}
        </span>
      </div>

      <div className="item-select-list">
        <div className="item-select-row item-select-row--header">
          <label className="item-checkbox-label">
            <input
              type="checkbox"
              ref={selectAllRef}
              checked={allSelected}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            <span className="item-col-id">ID</span>
            <span className="item-col-name">Name</span>
          </label>
        </div>
        {items.length === 0 && (
          <div className="item-select-empty">No items found in filter</div>
        )}
        {items.map((item) => (
          <div key={item.id} className={`item-select-row${item.frozen ? ' item-select-row--frozen' : ''}`}>
            <label className="item-checkbox-label">
              <input
                type="checkbox"
                checked={!item.frozen && selectedIds.has(item.id)}
                disabled={item.frozen}
                onChange={() => onToggle(item.id)}
              />
              <span className="item-col-id item-id">#{item.id}</span>
              <span className="item-col-name item-name">{item.name}</span>
              {item.frozen && <span className="badge badge-frozen">Frozen</span>}
            </label>
          </div>
        ))}
      </div>

      <div className="preview-actions">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          className="btn-primary"
          onClick={onConfirm}
          disabled={selectedIds.size === 0}
        >
          Update {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} ▶
        </button>
      </div>
    </div>
  );
}
