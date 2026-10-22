import React, { useState } from 'react';
import { Users, UserPlus, Target, CheckSquare, Database } from 'lucide-react';
import { Contact } from '../types';

interface CrmViewProps {
  contacts: Contact[];
  pipeline: Record<string, number>;
  onAddContact: (contact: Partial<Contact>) => Promise<void>;
}

export const CrmView: React.FC<CrmViewProps> = ({
  contacts,
  pipeline,
  onAddContact
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'lead' | 'contacted' | 'qualified' | 'customer' | 'churned'>('lead');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAddContact({
      name: name.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      notes: notes.trim() || undefined,
      status
    });
    setName('');
    setEmail('');
    setCompany('');
    setRole('');
    setNotes('');
    setShowAddModal(false);
  };

  const stages = [
    { key: 'lead', label: 'New Leads', color: '#818cf8' },
    { key: 'contacted', label: 'Contacted', color: '#38bdf8' },
    { key: 'qualified', label: 'Qualified', color: '#f59e0b' },
    { key: 'customer', label: 'Won / Customer', color: '#10b981' },
    { key: 'churned', label: 'Lost / Churned', color: '#ef4444' }
  ];

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sales & CRM Pipeline</h1>
            <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} /> Local PostgreSQL Database
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Internal sales operations, contact records, lead scores, and follow-up activities.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'var(--accent-gradient)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <UserPlus size={16} />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Pipeline Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {stages.map((st) => (
          <div
            key={st.key}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              borderTop: `4px solid ${st.color}`
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>{st.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>
              {pipeline?.[st.key] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Contacts Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
          Contact Directory ({contacts.length})
        </div>

        {contacts.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No CRM contacts recorded. Add a contact or instruct the AI agent to organize new leads.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '12px 20px' }}>Name & Role</th>
                <th style={{ padding: '12px 20px' }}>Company</th>
                <th style={{ padding: '12px 20px' }}>Email</th>
                <th style={{ padding: '12px 20px' }}>Status</th>
                <th style={{ padding: '12px 20px' }}>Score</th>
                <th style={{ padding: '12px 20px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#f1f5f9' }}>
                    {c.name}
                    {c.role && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>{c.role}</div>}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>{c.company || '—'}</td>
                  <td style={{ padding: '14px 20px', color: '#818cf8', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {c.email || '—'}
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
                          c.status === 'customer'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : c.status === 'qualified'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(99, 102, 241, 0.15)',
                        color:
                          c.status === 'customer'
                            ? '#10b981'
                            : c.status === 'qualified'
                            ? '#f59e0b'
                            : '#818cf8'
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#f8fafc' }}>
                    {c.leadScore}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.8rem', maxWidth: '300px' }}>
                    {c.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Add Sales Lead</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Company</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stage</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="lead">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="customer">Customer</option>
                  <option value="churned">Churned</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#f8fafc', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-subtle)', padding: '8px 16px', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--accent-gradient)', border: 'none', padding: '8px 16px', borderRadius: '6px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
