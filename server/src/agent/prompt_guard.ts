export interface GuardResult {
  safe: boolean;
  warning?: string;
  sanitized: string;
}

// Patterns that attempt to hijack the agent or bypass tool authorization
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/i,
  /bypass\s+security\s+policies/i,
  /override\s+permission\s+check/i,
  /reveal\s+(the\s+)?(system\s+prompt|api\s+key|environment\s+variables)/i,
  /execute\s+arbitrary\s+(code|bash|powershell|sql)/i
];

export function inspectPrompt(text: string): GuardResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        warning: 'Potential prompt injection attempt or policy override detected.',
        sanitized: text
      };
    }
  }

  // Strip or mask any accidental credentials if present in user input
  const sanitized = text
    .replace(/(?:sk-[a-zA-Z0-9_-]{20,})/g, '[REDACTED_API_KEY]')
    .replace(/(?:password\s*[:=]\s*['"]?)[^'"\s]+/gi, 'password=[REDACTED]');

  return {
    safe: true,
    sanitized
  };
}

export function sanitizeToolOutput(output: any): any {
  if (typeof output === 'string') {
    return output
      .replace(/(?:sk-[a-zA-Z0-9_-]{20,})/g, '[REDACTED_KEY]')
      .replace(/(?:SMTP_PASS=[^\s]+)/gi, 'SMTP_PASS=[REDACTED]');
  }
  if (typeof output === 'object' && output !== null) {
    const copy = { ...output };
    for (const key of Object.keys(copy)) {
      if (/pass|secret|token|key/i.test(key) && typeof copy[key] === 'string') {
        copy[key] = '[REDACTED]';
      } else if (typeof copy[key] === 'object') {
        copy[key] = sanitizeToolOutput(copy[key]);
      }
    }
    return copy;
  }
  return output;
}
