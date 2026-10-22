import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Terminal, CheckCircle, AlertCircle, ShieldAlert, Cpu } from 'lucide-react';
import { Message, TaskPlan } from '../types';

interface ChatViewProps {
  messages: Message[];
  streamingThought: string;
  streamingToken: string;
  toolInvocations: Array<{ tool: string; input: any; result?: any; success?: boolean; error?: string }>;
  pendingApproval: { tool: string; input: any; prompt: string } | null;
  isExecuting: boolean;
  onSendMessage: (prompt: string) => void;
  onApproveAction: () => void;
  onRejectAction: () => void;
  onStopExecution: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  streamingThought,
  streamingToken,
  toolInvocations,
  pendingApproval,
  isExecuting,
  onSendMessage,
  onApproveAction,
  onRejectAction,
  onStopExecution
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingToken, streamingThought, toolInvocations, pendingApproval]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const samplePrompts = [
    'Calculate: sqrt(144) * 25 + (180 / 4)',
    'Create a report.txt file in workspace with sales goals',
    'Add lead Sarah Connor (VP at Cyberdyne, sarah@cyberdyne.io)',
    'Check web search capability and summarize latest status',
    'Store preference: Preferred report format is markdown'
  ];

  return (
    <div className="chat-thread-container">
      <div className="chat-messages">
        {messages.length === 0 && !isExecuting && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '580px', padding: '40px 20px' }}>
            <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', background: 'var(--accent-gradient)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={28} color="white" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Antigravity General-Purpose Agent
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
              Autonomous intelligence connected to live tools: local Ollama AI model, PostgreSQL, safe sandboxed filesystem, calculator, CRM, documents, and SMTP email.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(p)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '20px',
                    padding: '8px 14px',
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Messages */}
        {messages.map((m) => (
          <div key={m.id} className={`message-card ${m.role}`}>
            {m.role === 'assistant' && (
              <div className="avatar assistant">AI</div>
            )}
            <div className="message-bubble">
              {m.thoughtProcess && (
                <div className="thought-box">
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={12} /> Agent Internal Reasoning
                  </div>
                  <div>{m.thoughtProcess}</div>
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
            {m.role === 'user' && (
              <div className="avatar user">You</div>
            )}
          </div>
        ))}

        {/* Active Streaming Block */}
        {isExecuting && (
          <div className="message-card assistant">
            <div className="avatar assistant">AI</div>
            <div className="message-bubble">
              {streamingThought && (
                <div className="thought-box">
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={12} /> Thinking...
                  </div>
                  <div>{streamingThought}</div>
                </div>
              )}

              {/* Tool Invocations */}
              {toolInvocations.map((inv, idx) => (
                <div key={idx} className="tool-pill">
                  <div className="tool-pill-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} color="#818cf8" />
                      Tool: {inv.tool}
                    </span>
                    {inv.result !== undefined && (
                      inv.success ? (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Success
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> Failed
                        </span>
                      )
                    )}
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Input:</div>
                    <pre className="tool-code-preview">{JSON.stringify(inv.input, null, 2)}</pre>
                  </div>
                  {inv.result !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Verified Output:</div>
                      <pre className="tool-code-preview">
                        {inv.success ? JSON.stringify(inv.result, null, 2) : inv.error}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Pending Human Approval Request */}
              {pendingApproval && (
                <div className="approval-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#f59e0b' }}>
                    <ShieldAlert size={18} />
                    Human Approval Required
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#fde68a' }}>
                    {pendingApproval.prompt}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#d97706', fontFamily: 'var(--font-mono)' }}>
                    Action: {pendingApproval.tool} with payload: {JSON.stringify(pendingApproval.input)}
                  </div>
                  <div className="approval-actions">
                    <button className="btn-approve" onClick={onApproveAction}>
                      Approve & Execute
                    </button>
                    <button className="btn-reject" onClick={onRejectAction}>
                      Reject / Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Streaming Answer */}
              {streamingToken ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{streamingToken}</div>
              ) : (
                !streamingThought && toolInvocations.length === 0 && (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-dot animate-ping" /> Generating response...
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-wrapper">
        <form onSubmit={handleSubmit} className="input-box-container">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Instruct the agent, ask a question, request a calculation, or manage CRM..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {isExecuting ? (
            <button
              type="button"
              className="send-btn"
              style={{ background: '#ef4444' }}
              onClick={onStopExecution}
              title="Stop execution"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className="send-btn"
              disabled={!input.trim()}
              title="Send task"
            >
              <Send size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
