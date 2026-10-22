import React, { useState } from 'react';
import { Clock, CheckCircle2, XCircle, RotateCcw, Play, RefreshCw } from 'lucide-react';
import { BackgroundJob } from '../types';

interface JobsViewProps {
  jobs: BackgroundJob[];
  onRefresh: () => Promise<void>;
  onEnqueueJob: (type: string, payload: any) => Promise<void>;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  onRefresh,
  onEnqueueJob
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleTestJob = async (type: string) => {
    setIsEnqueuing(true);
    await onEnqueueJob(type, { timestamp: new Date().toISOString() });
    await onRefresh();
    setIsEnqueuing(false);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Durable Background Execution</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Persistent background jobs stored in PostgreSQL with automatic retry tracking, crash recovery, and bounded concurrency.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleTestJob('verify_workspace')}
            disabled={isEnqueuing}
            style={{
              background: 'var(--accent-gradient)',
              color: 'white',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Play size={14} /> Enqueue Workspace Audit Job
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: '#f8fafc',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
          Job Queue Log ({jobs.length})
        </div>

        {jobs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No background tasks in queue. Dispatch a job above to test durable worker execution.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '12px 20px' }}>Job Type & ID</th>
                <th style={{ padding: '12px 20px' }}>Status</th>
                <th style={{ padding: '12px 20px' }}>Attempts</th>
                <th style={{ padding: '12px 20px' }}>Queued / Run At</th>
                <th style={{ padding: '12px 20px' }}>Result / Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{j.type}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{j.id}</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background:
                          j.status === 'completed'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : j.status === 'processing'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : j.status === 'failed'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          j.status === 'completed'
                            ? '#10b981'
                            : j.status === 'processing'
                            ? '#818cf8'
                            : j.status === 'failed'
                            ? '#ef4444'
                            : '#f59e0b'
                      }}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>
                    {j.attempts} / {j.maxAttempts}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {new Date(j.runAt).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '14px 20px', maxWidth: '350px' }}>
                    {j.result ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#86efac', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.result}
                      </div>
                    ) : j.error ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fca5a5' }}>
                        {j.error}
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
