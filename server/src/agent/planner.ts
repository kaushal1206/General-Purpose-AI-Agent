import { TaskCategory, TaskPlanDefinition, PlanStepItem } from './types.js';

export const KNOWN_TOOLS = [
  'calculator',
  'datetime',
  'workspace_files',
  'documents',
  'structured_data',
  'web_search',
  'email',
  'crm',
  'memory'
];

/**
 * Classify user intent deterministically.
 */
export function classifyRequest(prompt: string): TaskCategory {
  const p = prompt.trim().toLowerCase();

  // 1. Clarification Required for empty, single punctuation, or hyper-vague requests
  if (p.length < 3 || /^[?!.,\s]+$/.test(p) || p === 'help me' || p === 'what' || p === 'do it') {
    return 'clarification_required';
  }

  // 2. Unsupported or unavailable capabilities (arbitrary shell, native GUI execution, destructive sysops)
  if (
    p.includes('run bash') ||
    p.includes('execute powershell') ||
    p.includes('cmd.exe') ||
    p.includes('sudo ') ||
    p.includes('rm -rf') ||
    p.includes('open browser') ||
    p.includes('click on') ||
    p.includes('crypto mine') ||
    p.includes('format c:')
  ) {
    return 'unsupported';
  }

  // 3. Multi-step workflows (chaining multiple concrete actions)
  const hasConjunction =
    p.includes(' and then ') ||
    p.includes(' after that ') ||
    p.includes(' first ') ||
    p.includes(' then ') ||
    p.includes(' and save ') ||
    p.includes(' and send ') ||
    p.includes(' and write ');

  const actionWordCount = [
    p.includes('calculate') || /[0-9]+\s*[\+\-\*\/%]\s*[0-9]+/.test(p),
    p.includes('file') || p.includes('workspace') || p.includes('write'),
    p.includes('email') || p.includes('send to'),
    p.includes('lead') || p.includes('crm') || p.includes('contact'),
    p.includes('search') || p.includes('look up'),
    p.includes('csv') || p.includes('data'),
    p.includes('document') || p.includes('readme')
  ].filter(Boolean).length;

  if (hasConjunction && actionWordCount >= 2) {
    return 'multi_step_workflow';
  }

  // 4. Memory operations
  if (
    p.startsWith('remember ') ||
    p.includes('remember that') ||
    p.includes('save to memory') ||
    p.includes('store preference') ||
    p.includes('recall my') ||
    p.includes('what is my preferred') ||
    p.includes('what do you remember') ||
    p.includes('forget my') ||
    p.includes('list my memories')
  ) {
    return 'memory_operations';
  }

  // 5. Email
  if (p.includes('send email') || p.includes('draft email') || p.includes('compose email') || p.includes('email to')) {
    return 'email';
  }

  // 6. CRM & Sales
  if (
    p.includes('create lead') ||
    p.includes('add lead') ||
    p.includes('add contact') ||
    p.includes('list contacts') ||
    p.includes('sales pipeline') ||
    p.includes('lead score') ||
    p.includes('crm')
  ) {
    return 'crm';
  }

  // 7. Web search
  if (
    p.includes('search the web') ||
    p.includes('search online') ||
    p.includes('google for') ||
    p.includes('look up online') ||
    p.includes('latest news about')
  ) {
    return 'web_research';
  }

  // 8. Structured data / CSV
  if (
    p.includes('csv') ||
    p.includes('tabular data') ||
    p.includes('filter rows') ||
    p.includes('aggregate column') ||
    p.includes('dataset summary')
  ) {
    return 'structured_data';
  }

  // 9. Documents
  if (
    p.includes('read document') ||
    p.includes('summarize document') ||
    p.includes('analyze report') ||
    p.includes('inspect readme') ||
    p.endsWith('.md') ||
    p.endsWith('.pdf')
  ) {
    return 'documents';
  }

  // 10. Filesystem
  if (
    p.includes('create file') ||
    p.includes('write file') ||
    p.includes('read file') ||
    p.includes('list files') ||
    p.includes('workspace file') ||
    p.includes('save to file')
  ) {
    return 'filesystem';
  }

  // 11. Calculation
  if (
    /[0-9]+\s*[\+\-\*\/%^]\s*[0-9]+/.test(prompt) ||
    p.includes('calculate') ||
    p.includes('sqrt(') ||
    p.includes('math expression') ||
    p.includes('sum of')
  ) {
    return 'calculation';
  }

  // 12. Default to Direct Response (explanations, trivia, general Q&A, greetings)
  return 'direct_response';
}

/**
 * Validates plan structure, tool names, and acyclic step dependencies.
 */
export function validatePlan(
  plan: TaskPlanDefinition,
  availableTools: string[] = KNOWN_TOOLS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!plan.goal || typeof plan.goal !== 'string') {
    errors.push('Plan must specify a valid goal string.');
  }

  if (!plan.steps || !Array.isArray(plan.steps)) {
    errors.push('Plan must contain an array of steps.');
    return { valid: false, errors };
  }

  if (plan.category !== 'direct_response' && plan.steps.length === 0) {
    errors.push('Non-direct tasks must define at least one execution step.');
  }

  const seenStepNumbers = new Set<number>();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const expectedNumber = i + 1;

    if (step.number !== expectedNumber) {
      errors.push(`Step at index ${i} has number ${step.number}, expected ${expectedNumber}.`);
    }

    if (seenStepNumbers.has(step.number)) {
      errors.push(`Duplicate step number: ${step.number}.`);
    }
    seenStepNumbers.add(step.number);

    if (!step.description || typeof step.description !== 'string') {
      errors.push(`Step ${step.number} missing valid description.`);
    }

    // Validate Tool Reference
    if (step.toolName) {
      if (!availableTools.includes(step.toolName)) {
        errors.push(`Step ${step.number} references unregistered tool: '${step.toolName}'.`);
      }
    }

    // Validate Dependencies: must only depend on strictly preceding steps
    if (step.dependsOnStep && Array.isArray(step.dependsOnStep)) {
      for (const dep of step.dependsOnStep) {
        if (dep >= step.number) {
          errors.push(`Step ${step.number} cannot depend on future or current step ${dep} (cyclic/invalid dependency).`);
        } else if (dep < 1 || !seenStepNumbers.has(dep)) {
          errors.push(`Step ${step.number} references non-existent prerequisite step ${dep}.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generates a structured, dependency-aware plan with failure policies.
 */
export function generatePlan(
  prompt: string,
  category: TaskCategory,
  availableTools: string[] = KNOWN_TOOLS
): TaskPlanDefinition {
  const p = prompt.toLowerCase();
  let steps: PlanStepItem[] = [];

  switch (category) {
    case 'calculation':
      steps = [
        {
          number: 1,
          description: 'Parse mathematical expression and execute arithmetic',
          purpose: 'Compute numerical calculation reliably',
          toolName: 'calculator',
          status: 'pending',
          recoveryPolicy: 'retry_once',
          expectedOutput: 'Calculated numerical value'
        },
        {
          number: 2,
          description: 'Format calculation result for user response',
          purpose: 'Present final mathematical solution',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'filesystem':
      steps = [
        {
          number: 1,
          description: 'Verify workspace path restrictions and execute file operation',
          purpose: 'Safely access sandboxed file storage',
          toolName: 'workspace_files',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'File content or confirmation of write'
        },
        {
          number: 2,
          description: 'Format file summary for user',
          purpose: 'Present file operation results',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'documents':
      steps = [
        {
          number: 1,
          description: 'Read document content from workspace',
          purpose: 'Extract raw text content from target document',
          toolName: 'documents',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Document text content'
        },
        {
          number: 2,
          description: 'Analyze content, extract key sections and summarize',
          purpose: 'Synthesize findings from document',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'structured_data':
      steps = [
        {
          number: 1,
          description: 'Parse CSV dataset and inspect column headers',
          purpose: 'Inspect schema and record count of dataset',
          toolName: 'structured_data',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Dataset structure and rows'
        },
        {
          number: 2,
          description: 'Apply requested filter, aggregation, or transformation',
          purpose: 'Execute statistical or filtering operations on data',
          toolName: 'structured_data',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Filtered or aggregated results'
        },
        {
          number: 3,
          description: 'Synthesize statistical insights and format presentation',
          purpose: 'Present final insights to user',
          dependsOnStep: [2],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'web_research':
      steps = [
        {
          number: 1,
          description: 'Query configured web search provider',
          purpose: 'Fetch factual citations from external search provider',
          toolName: 'web_search',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'List of search results and snippets'
        },
        {
          number: 2,
          description: 'Extract real source URLs and compile verified summary',
          purpose: 'Summarize findings with source URLs',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'email':
      steps = [
        {
          number: 1,
          description: 'Prepare and draft email content',
          purpose: 'Construct email payload with recipient, subject, and body',
          toolName: 'email',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Drafted message structure'
        },
        {
          number: 2,
          description: 'Request explicit human approval before external dispatch',
          purpose: 'Security checkpoint: user confirmation required',
          toolName: 'email',
          dependsOnStep: [1],
          status: 'pending',
          requiresApproval: true,
          recoveryPolicy: 'abort'
        },
        {
          number: 3,
          description: 'Dispatch email via SMTP and verify delivery confirmation',
          purpose: 'Send message through configured SMTP provider',
          toolName: 'email',
          dependsOnStep: [2],
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Delivery confirmation receipt'
        }
      ];
      break;

    case 'crm':
      steps = [
        {
          number: 1,
          description: 'Query local database contacts and pipeline',
          purpose: 'Inspect CRM state or find contact record',
          toolName: 'crm',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'CRM records or lead summary'
        },
        {
          number: 2,
          description: 'Persist lead updates or follow-up schedule',
          purpose: 'Commit changes to PostgreSQL CRM table',
          toolName: 'crm',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'memory_operations':
      steps = [
        {
          number: 1,
          description: 'Execute user memory operation (store, recall, or list)',
          purpose: 'Maintain user preferences and explicit long-term knowledge',
          toolName: 'memory',
          status: 'pending',
          recoveryPolicy: 'abort',
          expectedOutput: 'Memory confirmation or retrieved items'
        },
        {
          number: 2,
          description: 'Report memory status to user',
          purpose: 'Confirm preference was safely persisted or retrieved',
          dependsOnStep: [1],
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'multi_step_workflow':
      // Extract specific sub-intents
      const needsCalc = p.includes('calculate') || /[0-9]+\s*[\+\-\*\/%]\s*[0-9]+/.test(p);
      const needsFileWrite = p.includes('save') || p.includes('write') || p.includes('file');

      if (needsCalc && needsFileWrite) {
        steps = [
          {
            number: 1,
            description: 'Execute calculation via calculator tool',
            purpose: 'Compute numerical value needed for file output',
            toolName: 'calculator',
            status: 'pending',
            recoveryPolicy: 'retry_once',
            expectedOutput: 'Calculated numerical result'
          },
          {
            number: 2,
            description: 'Write calculation output to workspace file',
            purpose: 'Persist verified result into sandboxed workspace',
            toolName: 'workspace_files',
            dependsOnStep: [1],
            inputMapping: { content: '1.result' },
            status: 'pending',
            recoveryPolicy: 'abort',
            expectedOutput: 'Workspace file write confirmation'
          },
          {
            number: 3,
            description: 'Summarize completed calculation and file persistence',
            purpose: 'Report workflow completion and file path',
            dependsOnStep: [2],
            status: 'pending',
            recoveryPolicy: 'abort'
          }
        ];
      } else {
        steps = [
          {
            number: 1,
            description: 'Decompose goal and execute initial data retrieval',
            purpose: 'Execute primary data retrieval or analysis step',
            status: 'pending',
            recoveryPolicy: 'abort'
          },
          {
            number: 2,
            description: 'Execute secondary transformation or persistence action',
            purpose: 'Transform or persist results from step 1',
            dependsOnStep: [1],
            status: 'pending',
            recoveryPolicy: 'abort'
          },
          {
            number: 3,
            description: 'Synthesize final workflow outcome for user',
            purpose: 'Summarize overall workflow progress',
            dependsOnStep: [2],
            status: 'pending',
            recoveryPolicy: 'abort'
          }
        ];
      }
      break;

    case 'clarification_required':
      steps = [
        {
          number: 1,
          description: 'Request clarification from user with specific options',
          purpose: 'Resolve ambiguous prompt before taking action',
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'unsupported':
      steps = [
        {
          number: 1,
          description: 'Explain unavailable capability and recommend safe alternative',
          purpose: 'Politely inform user that requested action exceeds system sandbox',
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;

    case 'direct_response':
    default:
      steps = [
        {
          number: 1,
          description: 'Generate context-aware direct response',
          purpose: 'Answer user question directly without tool overhead',
          status: 'pending',
          recoveryPolicy: 'abort'
        }
      ];
      break;
  }

  const plan: TaskPlanDefinition = {
    goal: prompt,
    category,
    steps
  };

  const validation = validatePlan(plan, availableTools);
  plan.isValid = validation.valid;
  plan.validationErrors = validation.errors;

  return plan;
}
