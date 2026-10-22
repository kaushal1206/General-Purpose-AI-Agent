import { TaskCategory, TaskPlanDefinition } from './types.js';

export function classifyRequest(prompt: string): TaskCategory {
  const p = prompt.toLowerCase();

  // Multi-step complex tasks
  if (
    (p.includes('and then') || p.includes('after that') || p.includes('first') || p.includes('steps')) &&
    (p.includes('file') || p.includes('email') || p.includes('search') || p.includes('lead') || p.includes('calculate'))
  ) {
    return 'multi_step_workflow';
  }

  // Email
  if (p.includes('email') || p.includes('send to') || p.includes('draft message') || p.includes('recipient')) {
    return 'email';
  }

  // CRM & Sales
  if (
    p.includes('lead') ||
    p.includes('contact') ||
    p.includes('follow-up') ||
    p.includes('sales pipeline') ||
    p.includes('crm')
  ) {
    return 'crm';
  }

  // Web search
  if (p.includes('search the web') || p.includes('google') || p.includes('look up online') || p.includes('latest news') || p.includes('find online')) {
    return 'web_research';
  }

  // Structured data / CSV
  if (p.includes('csv') || p.includes('tabular') || p.includes('aggregate') || p.includes('filter rows') || p.includes('columns')) {
    return 'structured_data';
  }

  // Documents
  if (p.includes('document') || p.includes('summarize report') || p.includes('analyze readme') || p.includes('.md') || p.includes('.json')) {
    return 'documents';
  }

  // Filesystem
  if (p.includes('file') || p.includes('folder') || p.includes('directory') || p.includes('workspace') || p.includes('save to') || p.includes('read file')) {
    return 'filesystem';
  }

  // Calculation
  if (
    /[0-9]+\s*[\+\-\*\/%^]\s*[0-9]+/.test(prompt) ||
    p.includes('calculate') ||
    p.includes('sqrt') ||
    p.includes('sum of') ||
    p.includes('average') ||
    p.includes('math')
  ) {
    return 'calculation';
  }

  return 'direct_response';
}

export function generatePlan(prompt: string, category: TaskCategory): TaskPlanDefinition {
  const p = prompt.toLowerCase();

  switch (category) {
    case 'calculation':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Parse expression and execute safe arithmetic', toolName: 'calculator', status: 'pending' },
          { number: 2, description: 'Verify result and format solution', status: 'pending' }
        ]
      };

    case 'filesystem':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Verify workspace sandbox path restrictions', toolName: 'workspace_files', status: 'pending' },
          { number: 2, description: 'Execute sandboxed filesystem operation', toolName: 'workspace_files', status: 'pending' },
          { number: 3, description: 'Confirm output and verify file state', status: 'pending' }
        ]
      };

    case 'documents':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Read document content from workspace', toolName: 'documents', status: 'pending' },
          { number: 2, description: 'Extract key sections and summarize findings', status: 'pending' }
        ]
      };

    case 'structured_data':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Parse CSV dataset and inspect column headers', toolName: 'structured_data', status: 'pending' },
          { number: 2, description: 'Apply requested filter, aggregation, or transformation', toolName: 'structured_data', status: 'pending' },
          { number: 3, description: 'Synthesize statistical insights for user', status: 'pending' }
        ]
      };

    case 'web_research':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Query configured web search provider', toolName: 'web_search', status: 'pending' },
          { number: 2, description: 'Extract real source URLs and compile verified summary', status: 'pending' }
        ]
      };

    case 'email':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Prepare and draft email content', toolName: 'email', status: 'pending' },
          { number: 2, description: 'Request explicit human approval before external dispatch', toolName: 'email', status: 'pending', requiresApproval: true },
          { number: 3, description: 'Dispatch email via SMTP and verify delivery confirmation', toolName: 'email', status: 'pending' }
        ]
      };

    case 'crm':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Query local database contacts and pipeline', toolName: 'crm', status: 'pending' },
          { number: 2, description: 'Persist lead updates or follow-up schedule', toolName: 'crm', status: 'pending' }
        ]
      };

    case 'multi_step_workflow':
      return {
        goal: prompt,
        category,
        steps: [
          { number: 1, description: 'Analyze requirements and decompose dependencies', status: 'pending' },
          { number: 2, description: 'Execute primary data or research step', status: 'pending' },
          { number: 3, description: 'Execute secondary transformation or persistence step', status: 'pending' },
          { number: 4, description: 'Summarize completed vs pending actions', status: 'pending' }
        ]
      };

    case 'direct_response':
    default:
      return {
        goal: prompt,
        category: 'direct_response',
        steps: [
          { number: 1, description: 'Generate context-aware direct response', status: 'pending' }
        ]
      };
  }
}
