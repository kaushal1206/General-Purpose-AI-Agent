import React from 'react';
import {
  MessageSquarePlus,
  MessageSquare,
  Activity,
  Brain,
  Users,
  Clock,
  Settings,
  Trash2,
  Sparkles
} from 'lucide-react';
import { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeTab: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  activeTab,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onSelectTab
}) => {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-badge">
          <div className="brand-icon">
            <Sparkles size={18} color="white" />
          </div>
          <span>Agent OS</span>
        </div>
      </div>

      {/* New Chat Button */}
      <button className="new-chat-btn" onClick={onNewConversation}>
        <MessageSquarePlus size={18} />
        <span>New Task & Chat</span>
      </button>

      {/* Navigation Links */}
      <div className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => onSelectTab('chat')}
        >
          <MessageSquare size={16} />
          <span>Active Agent Chat</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'capabilities' ? 'active' : ''}`}
          onClick={() => onSelectTab('capabilities')}
        >
          <Activity size={16} />
          <span>Capability Diagnostics</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'crm' ? 'active' : ''}`}
          onClick={() => onSelectTab('crm')}
        >
          <Users size={16} />
          <span>Sales & CRM Pipeline</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => onSelectTab('memory')}
        >
          <Brain size={16} />
          <span>User Memory</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => onSelectTab('jobs')}
        >
          <Clock size={16} />
          <span>Background Jobs</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <Settings size={16} />
          <span>Integrations & AI</span>
        </button>
      </div>

      {/* Conversations Section */}
      <div style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Conversations & Tasks
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
            No task history yet
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conv-item ${activeConversationId === conv.id && activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => {
                onSelectConversation(conv.id);
                onSelectTab('chat');
              }}
            >
              <span className="conv-title" title={conv.title}>
                {conv.title || 'Untitled Session'}
              </span>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                title="Delete session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
