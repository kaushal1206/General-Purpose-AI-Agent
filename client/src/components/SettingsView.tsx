import React from 'react';
import { Settings, Shield, Cpu, Key, Database, FolderCheck, ExternalLink } from 'lucide-react';

interface SettingsViewProps {
  activeProvider: string;
  providers: Array<{ id: string; name: string; available: boolean }>;
  onSelectProvider: (id: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeProvider,
  providers,
  onSelectProvider
}) => {
  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Integrations & AI Architecture</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
          Configure AI model providers, view security sandboxing policies, and review local system paths.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
        {/* Model Provider Selector */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="#818cf8" /> Free-First AI Model Selection
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '16px' }}>
            Our free-first policy prioritizes local Ollama inference without requiring any paid API keys or subscriptions. Optional hosted providers can be activated when configured in <code style={{ color: '#a5b4fc' }}>server/.env</code>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {providers.map((p) => {
              const isSelected = activeProvider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => p.available && onSelectProvider(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                    cursor: p.available ? 'pointer' : 'not-allowed',
                    opacity: p.available ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="radio"
                      name="providerSelect"
                      checked={isSelected}
                      readOnly
                      style={{ cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {p.id === 'ollama'
                          ? 'Zero-cost local model running on localhost:11434'
                          : p.available
                          ? 'API key detected and operational'
                          : 'Not configured — set API key in server/.env'}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: p.available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: p.available ? '#10b981' : '#ef4444'
                    }}
                  >
                    {p.available ? 'READY' : 'UNCONFIGURED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security & Autonomy Guardrails */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#10b981" /> Autonomous Security & Approval Policies
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '16px' }}>
            Strict safety boundaries protect your environment. The agent autonomously executes safe calculations and reading, while high-risk actions halt for confirmation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <span>Mandatory confirmation before sending emails</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>ENFORCED</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <span>Confirmation before overwriting existing files</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>ENFORCED</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <span>Prompt injection detection and system policy guard</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>ACTIVE</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <span>Maximum step execution limit per task</span>
              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>10 Steps (30s timeout)</span>
            </div>
          </div>
        </div>

        {/* Sandboxed Filesystem Path */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderCheck size={18} color="#38bdf8" /> Sandboxed Workspace Root
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '12px' }}>
            The AI agent is cryptographically restricted from reading or writing outside this directory:
          </p>
          <pre style={{ background: '#080c14', padding: '10px 14px', borderRadius: '6px', color: '#818cf8', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
            d:/general-purpose AI agent/workspace
          </pre>
        </div>
      </div>
    </div>
  );
};
