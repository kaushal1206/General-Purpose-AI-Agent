import React, { useState } from 'react';
import { Brain, Trash2, Plus, CheckCircle, ShieldCheck } from 'lucide-react';
import { MemoryItem } from '../types';

interface MemoryViewProps {
  memories: MemoryItem[];
  onAddMemory: (key: string, value: string, category: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  onAddMemory,
  onDeleteMemory
}) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('preference');
  const [consentGiven, setConsentGiven] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim() || !consentGiven) return;
    setIsSubmitting(true);
    await onAddMemory(key.trim(), value.trim(), category);
    setKey('');
    setValue('');
    setIsSubmitting(false);
  };

  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>User-Controlled Long-Term Memory</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
          Durable user preferences and instructions persisted in PostgreSQL. In accordance with user consent policies, you can view, edit, or purge any stored item at any time.
        </p>
      </div>

      {/* Add Memory Form */}
      <div className="glass-panel" style={{ padding: '20px', maxWidth: '640px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} color="#818cf8" /> Add Preference or Fact to Memory
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <option value="preference">Preference</option>
                <option value="fact">Fact</option>
                <option value="instruction">Instruction</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Key / Topic</label>
              <input
                type="text"
                placeholder="e.g. output_format, preferred_timezone"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '8px',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Value</label>
            <textarea
              rows={2}
              placeholder="e.g. Always respond in concise bullet points with verified data"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '8px',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <input
              type="checkbox"
              id="consentCheck"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
            />
            <label htmlFor="consentCheck" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="#10b981" /> Explicit user consent granted to store this preference
            </label>
          </div>

          <button
            type="submit"
            disabled={!key.trim() || !value.trim() || !consentGiven || isSubmitting}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--accent-gradient)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save to Memory'}
          </button>
        </form>
      </div>

      {/* Memory Items List */}
      <div style={{ maxWidth: '800px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
          Active Durable Memories ({memories.length})
        </h3>

        {memories.length === 0 ? (
          <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px', color: '#64748b', textAlign: 'center' }}>
            No memories stored yet. Instruct the agent to remember something or add one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {memories.map((m) => (
              <div
                key={m.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                      {m.category}
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>{m.key}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{m.value}</div>
                </div>

                <button
                  onClick={() => onDeleteMemory(m.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                  title="Purge memory"
                  onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
