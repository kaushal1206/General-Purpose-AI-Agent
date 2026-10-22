import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Terminal,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { CapabilityStatus } from '../types';

interface CapabilitiesModalProps {
  capabilities: CapabilityStatus[];
  onRefreshAll: () => Promise<void>;
  onCheckSingle: (id: string) => Promise<void>;
}

export const CapabilitiesModal: React.FC<CapabilitiesModalProps> = ({
  capabilities,
  onRefreshAll,
  onCheckSingle
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await onRefreshAll();
    setIsRefreshingAll(false);
  };

  const handleCheck = async (id: string) => {
    setLoadingId(id);
    await onCheckSingle(id);
    setLoadingId(null);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Capability Diagnostics Registry</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Live status of every internal and external capability. A configured integration is never claimed working until verified by live health check.
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isRefreshingAll}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={isRefreshingAll ? 'animate-spin' : ''} />
          <span>{isRefreshingAll ? 'Testing All...' : 'Run All Health Checks'}</span>
        </button>
      </div>

      <div className="card-grid">
        {capabilities.map((cap) => {
          const isWorking = cap.implemented && cap.providerReachable && cap.lastHealthCheckSuccess;
          const isChecking = loadingId === cap.id;
          const isExpanded = expandedId === cap.id;

          return (
            <div key={cap.id} className="diagnostic-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{cap.name}</h3>
                    <span style={{ fontSize: '0.72rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {cap.category}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: isWorking ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isWorking ? '#10b981' : '#ef4444'
                    }}
                  >
                    {isWorking ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {isWorking ? 'VERIFIED' : 'UNAVAILABLE'}
                  </span>
                </div>

                {/* Status Matrix */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <div>Configured: <strong style={{ color: cap.configured ? '#10b981' : '#f59e0b' }}>{cap.configured ? 'Yes' : 'No'}</strong></div>
                  <div>Credentials: <strong style={{ color: cap.credentialsAvailable ? '#10b981' : '#64748b' }}>{cap.credentialsAvailable ? 'Available' : 'None'}</strong></div>
                  <div>Reachable: <strong style={{ color: cap.providerReachable ? '#10b981' : '#ef4444' }}>{cap.providerReachable ? 'Yes' : 'No'}</strong></div>
                  <div>Last Checked: <strong>{new Date(cap.lastHealthCheckTime).toLocaleTimeString()}</strong></div>
                </div>

                {/* Error details if failing */}
                {cap.errorDetails && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444', padding: '8px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#fca5a5', marginBottom: '12px' }}>
                    {cap.errorDetails}
                  </div>
                )}

                {/* Permitted Actions */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>Permitted Actions:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {cap.actionsPermitted.map((act, i) => (
                      <span key={i} style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                        {act}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Setup Instructions Accordion */}
                {isExpanded && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>Setup Instructions:</div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      {cap.setupInstructions}
                    </pre>
                    {cap.alternatives && (
                      <div style={{ marginTop: '8px', color: '#a5b4fc' }}>
                        <strong>Offline Alternative:</strong> {cap.alternatives.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : cap.id)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {isExpanded ? 'Hide Setup' : 'Setup Details'}
                </button>

                <button
                  onClick={() => handleCheck(cap.id)}
                  disabled={isChecking}
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    color: '#818cf8',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                  <span>{isChecking ? 'Checking...' : 'Verify'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
