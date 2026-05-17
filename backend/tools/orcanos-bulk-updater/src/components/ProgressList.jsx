import React from 'react';

const STATUS_LABEL = {
  pending: 'Pending',
  'in-progress': '⟳ In progress',
  success: '✓ Done',
  error: '✕ Error',
  frozen: '❄ Frozen',
};

const TERMINAL = ['success', 'error', 'frozen'];

export default function ProgressList({ items, onReset }) {
  const done = items.length > 0 && items.every((i) => TERMINAL.includes(i.status));
  const succeeded = items.filter((i) => i.status === 'success').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const frozen = items.filter((i) => i.status === 'frozen').length;

  const summaryParts = [
    succeeded > 0 && `${succeeded} updated`,
    failed > 0 && `${failed} failed`,
    frozen > 0 && `${frozen} frozen`,
  ].filter(Boolean).join(', ');

  return (
    <div className="progress-section">
      <h2>
        {done
          ? `Finished — ${summaryParts}`
          : `Updating ${items.length} item${items.length !== 1 ? 's' : ''}…`}
      </h2>
      {!done && items.every((i) => i.status === 'pending') && items.length > 0 && (
        <p className="status-hint">Preparing…</p>
      )}
      <div className="progress-table-wrap">
        <table className="progress-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={`row-${item.status}`}>
                <td>{item.id}</td>
                <td title={item.error || ''}>{item.name}</td>
                <td>
                  <span className={`badge badge-${item.status}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  {item.error && <span className="error-msg"> — {item.error}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {done && (
        <div className="summary-actions">
          <span className="summary-text">{summaryParts}</span>
          <button className="btn-secondary" onClick={onReset}>Reset</button>
        </div>
      )}
    </div>
  );
}
