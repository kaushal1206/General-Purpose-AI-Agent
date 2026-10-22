import React from 'react';
import { CheckCircle2, Circle, Clock, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import { TaskPlan } from '../types';

interface TaskTimelineProps {
  plan: TaskPlan | null;
  statusMessage?: string;
  isExecuting: boolean;
}

export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  plan,
  statusMessage,
  isExecuting
}) => {
  if (!plan && !statusMessage) {
    return (
      <div className="timeline-pane">
        <div className="timeline-header">
          <span>Execution Plan</span>
        </div>
        <div style={{ padding: '24px', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
          No active workflow plan. Ask a question or assign a task to watch the agent plan and execute.
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-pane">
      <div className="timeline-header">
        <span>Execution Plan</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isExecuting ? '#6366f1' : '#10b981' }}>
          {isExecuting ? 'RUNNING' : plan?.status?.toUpperCase() || 'IDLE'}
        </span>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 20px', background: 'rgba(99, 102, 241, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} className={isExecuting ? 'animate-spin' : ''} />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="timeline-steps">
        {plan?.steps?.map((step) => {
          let markerClass = 'pending';
          let icon = <Circle size={14} color="#64748b" />;

          if (step.status === 'running') {
            markerClass = 'running';
            icon = <Clock size={14} color="#818cf8" />;
          } else if (step.status === 'completed') {
            markerClass = 'completed';
            icon = <CheckCircle2 size={14} color="#10b981" />;
          } else if (step.status === 'awaiting_approval') {
            markerClass = 'running';
            icon = <ShieldAlert size={14} color="#f59e0b" />;
          } else if (step.status === 'failed') {
            markerClass = 'failed';
            icon = <XCircle size={14} color="#ef4444" />;
          }

          return (
            <div key={step.stepNumber} className="step-card">
              <div className={`step-marker ${markerClass}`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                    Step {step.stepNumber}: {step.description}
                  </span>
                  {icon}
                </div>

                {step.toolName && (
                  <span style={{ fontSize: '0.75rem', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                    tool: {step.toolName}
                  </span>
                )}

                {step.requiresApproval && (
                  <span style={{ fontSize: '0.72rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Requires approval
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
