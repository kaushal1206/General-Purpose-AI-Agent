import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { TaskTimeline } from './components/TaskTimeline';
import { CapabilitiesModal } from './components/CapabilitiesModal';
import { MemoryView } from './components/MemoryView';
import { CrmView } from './components/CrmView';
import { JobsView } from './components/JobsView';
import { SettingsView } from './components/SettingsView';
import { api } from './services/api';
import {
  Conversation,
  Message,
  CapabilityStatus,
  TaskPlan,
  MemoryItem,
  Contact,
  BackgroundJob,
  AgentEvent
} from './types';
import { Activity, Cpu } from 'lucide-react';

export const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<string>('chat');

  // Capability & Provider State
  const [capabilities, setCapabilities] = useState<CapabilityStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('ollama');
  const [providers, setProviders] = useState<Array<{ id: string; name: string; available: boolean }>>([]);

  // Memory, CRM, Jobs State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);

  // Streaming & Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [streamingThought, setStreamingThought] = useState<string>('');
  const [streamingToken, setStreamingToken] = useState<string>('');
  const [toolInvocations, setToolInvocations] = useState<Array<{ tool: string; input: any; result?: any; success?: boolean; error?: string }>>([]);
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ tool: string; input: any; prompt: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial Data Load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [caps, convs, provs, mems, crmContacts, crmPipeline, jobList] = await Promise.all([
        api.getCapabilities(),
        api.getConversations(),
        api.getProviders(),
        api.getMemories(),
        api.getContacts(),
        api.getPipeline(),
        api.getJobs()
      ]);

      setCapabilities(caps);
      setConversations(convs);
      setActiveProvider(provs.activeProvider || 'ollama');
      setProviders(provs.providers || []);
      setMemories(mems);
      setContacts(crmContacts);
      setPipeline(crmPipeline?.pipelineBreakdown || {});
      setJobs(jobList);

      if (convs.length > 0) {
        selectConversation(convs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const { conversation } = await api.getConversation(id);
      setMessages(conversation.messages || []);
      if (conversation.taskPlans && conversation.taskPlans.length > 0) {
        setActivePlan(conversation.taskPlans[0]);
      } else {
        setActivePlan(null);
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation('New Task');
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setActivePlan(null);
      setStreamingThought('');
      setStreamingToken('');
      setToolInvocations([]);
      setPendingApproval(null);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      const remaining = conversations.filter(c => c.id !== id);
      setConversations(remaining);
      if (activeConversationId === id) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          setActivePlan(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (prompt: string) => {
    if (isExecuting) return;

    setIsExecuting(true);
    setStatusMessage('Initiating agent reasoning...');
    setStreamingThought('');
    setStreamingToken('');
    setToolInvocations([]);
    setPendingApproval(null);

    // Optimistically show user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || '',
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantContent = '';
    let accumulatedThoughts = '';

    try {
      await api.streamChat(
        {
          prompt,
          conversationId: activeConversationId || undefined
        },
        (event: AgentEvent) => {
          if (event.conversationId && event.conversationId !== activeConversationId) {
            setActiveConversationId(event.conversationId);
          }

          switch (event.type) {
            case 'status':
              setStatusMessage(event.data.message);
              break;

            case 'thought':
              accumulatedThoughts += event.data.chunk || '';
              setStreamingThought(accumulatedThoughts);
              break;

            case 'plan':
              setActivePlan(event.data.plan);
              break;

            case 'step_start':
              setActivePlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepNumber === event.data.stepNumber ? { ...s, status: 'running' } : s
                  )
                };
              });
              break;

            case 'step_verifying':
              setStatusMessage(`Verifying step ${event.data.stepNumber}...`);
              setActivePlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepNumber === event.data.stepNumber
                      ? { ...s, status: 'verifying', verificationStatus: 'verifying' }
                      : s
                  )
                };
              });
              break;

            case 'step_verified':
              setStatusMessage(`Step ${event.data.stepNumber} verified: ${event.data.message}`);
              setActivePlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepNumber === event.data.stepNumber
                      ? { ...s, verificationStatus: 'verified' }
                      : s
                  )
                };
              });
              break;

            case 'step_retrying':
              setStatusMessage(`Retrying step ${event.data.stepNumber} (attempt ${event.data.attempt})...`);
              break;

            case 'step_complete':
              setActivePlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepNumber === event.data.stepNumber ? { ...s, status: 'completed' } : s
                  )
                };
              });
              break;

            case 'step_failed':
              setActivePlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepNumber === event.data.stepNumber ? { ...s, status: 'failed' } : s
                  )
                };
              });
              break;

            case 'cancelled':
              setStatusMessage('Task cancelled.');
              setIsExecuting(false);
              setActivePlan((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              break;

            case 'tool_call':
              setToolInvocations((prev) => [
                ...prev,
                { tool: event.data.tool, input: event.data.input }
              ]);
              break;

            case 'tool_result':
              setToolInvocations((prev) =>
                prev.map((inv) =>
                  inv.tool === event.data.tool && inv.result === undefined
                    ? {
                        ...inv,
                        result: event.data.data,
                        success: event.data.success,
                        error: event.data.error
                      }
                    : inv
                )
              );
              break;

            case 'approval_required':
              setPendingApproval({
                tool: event.data.tool,
                input: event.data.input,
                prompt: event.data.prompt
              });
              break;

            case 'token':
              assistantContent += event.data.token || '';
              setStreamingToken(assistantContent);
              break;

            case 'complete':
              setStatusMessage(event.data.summary || 'Task completed');
              setIsExecuting(false);
              break;

            case 'error':
              setStatusMessage(`Error: ${event.data.error}`);
              setIsExecuting(false);
              break;
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage(`Stream error: ${err.message}`);
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
      // Refresh conversation messages from DB
      if (activeConversationId) {
        const { conversation } = await api.getConversation(activeConversationId);
        setMessages(conversation.messages || []);
        const convList = await api.getConversations();
        setConversations(convList);
      }
    }
  };

  const handleApproveAction = async () => {
    if (!pendingApproval) return;
    const { tool, input } = pendingApproval;
    setPendingApproval(null);
    setIsExecuting(true);
    setStatusMessage(`Executing approved action: ${tool}...`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.streamChat(
        {
          conversationId: activeConversationId || undefined,
          approvalGranted: true,
          approvedToolName: tool,
          approvedToolInput: input
        },
        (event) => {
          if (event.type === 'tool_result') {
            setToolInvocations((prev) => [
              ...prev,
              { tool: event.data.tool, input, result: event.data.data, success: event.data.success }
            ]);
          } else if (event.type === 'token') {
            setStreamingToken((prev) => prev + event.data.token);
          } else if (event.type === 'complete') {
            setIsExecuting(false);
          }
        },
        controller.signal
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExecuting(false);
      if (activeConversationId) {
        const { conversation } = await api.getConversation(activeConversationId);
        setMessages(conversation.messages || []);
      }
    }
  };

  const handleRejectAction = () => {
    setPendingApproval(null);
    setStatusMessage('Action rejected by user.');
    setIsExecuting(false);
  };

  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (activeConversationId) {
      api.cancelTask(activeConversationId).catch(() => {});
    }
    setIsExecuting(false);
    setStatusMessage('Execution halted by user.');
    setActivePlan((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
  };

  // Diagnostic Checks
  const handleRefreshAllCapabilities = async () => {
    const list = await api.getCapabilities();
    setCapabilities(list);
  };

  const handleCheckSingleCapability = async (id: string) => {
    const cap = await api.checkCapability(id);
    setCapabilities((prev) => prev.map((c) => (c.id === id ? cap : c)));
  };

  // Memory Actions
  const handleAddMemory = async (key: string, value: string, category: string) => {
    const item = await api.addMemory(key, value, category);
    setMemories([item, ...memories]);
  };

  const handleDeleteMemory = async (id: string) => {
    await api.deleteMemory(id);
    setMemories(memories.filter((m) => m.id !== id));
  };

  // CRM Actions
  const handleAddContact = async (contact: Partial<Contact>) => {
    const newContact = await api.addContact(contact);
    setContacts([newContact, ...contacts]);
    const pipe = await api.getPipeline();
    setPipeline(pipe?.pipelineBreakdown || {});
  };

  // Job Actions
  const handleRefreshJobs = async () => {
    const list = await api.getJobs();
    setJobs(list);
  };

  const handleEnqueueJob = async (type: string, payload: any) => {
    await api.enqueueJob(type, payload);
  };

  // Provider Actions
  const handleSelectProvider = async (id: string) => {
    await api.setActiveProvider(id);
    setActiveProvider(id);
  };

  const verifiedCapsCount = capabilities.filter((c) => c.lastHealthCheckSuccess).length;

  return (
    <div className="app-container">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeTab={activeTab}
        onSelectConversation={selectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onSelectTab={setActiveTab}
      />

      <main className="main-content">
        {/* Top App Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="status-pill">
              <span className="status-dot" />
              <span>Agent OS Online</span>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="#818cf8" />
              <span>Active Model: <strong>{activeProvider.toUpperCase()}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setActiveTab('capabilities')}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '20px',
                padding: '4px 12px',
                color: '#cbd5e1',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Activity size={14} color="#10b981" />
              <span>{verifiedCapsCount} / {capabilities.length} Verified Capabilities</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Body */}
        {activeTab === 'chat' && (
          <div className="chat-workspace">
            <ChatView
              messages={messages}
              streamingThought={streamingThought}
              streamingToken={streamingToken}
              toolInvocations={toolInvocations}
              pendingApproval={pendingApproval}
              isExecuting={isExecuting}
              onSendMessage={handleSendMessage}
              onApproveAction={handleApproveAction}
              onRejectAction={handleRejectAction}
              onStopExecution={handleStopExecution}
            />

            <TaskTimeline
              plan={activePlan}
              statusMessage={statusMessage}
              isExecuting={isExecuting}
            />
          </div>
        )}

        {activeTab === 'capabilities' && (
          <CapabilitiesModal
            capabilities={capabilities}
            onRefreshAll={handleRefreshAllCapabilities}
            onCheckSingle={handleCheckSingleCapability}
          />
        )}

        {activeTab === 'crm' && (
          <CrmView
            contacts={contacts}
            pipeline={pipeline}
            onAddContact={handleAddContact}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryView
            memories={memories}
            onAddMemory={handleAddMemory}
            onDeleteMemory={handleDeleteMemory}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsView
            jobs={jobs}
            onRefresh={handleRefreshJobs}
            onEnqueueJob={handleEnqueueJob}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            activeProvider={activeProvider}
            providers={providers}
            onSelectProvider={handleSelectProvider}
          />
        )}

        {/* Global Developer Branding Footer */}
        <footer className="app-footer">
          Designed &amp; Developed by Kaushal Bhardwaj
        </footer>
      </main>
    </div>
  );
};
