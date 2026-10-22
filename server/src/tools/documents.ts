import { z } from 'zod';
import { AgentTool, ToolResult } from './types.js';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { config } from '../config/index.js';

export const documentsTool: AgentTool = {
  name: 'documents',
  description: 'Inspect, extract, and analyze content from documents (markdown, text, json, source code) located in the workspace.',
  category: 'documents',
  riskLevel: 'safe',
  inputSchema: z.object({
    documentPath: z.string().describe('Relative path to document in workspace, e.g. "README.md" or "data/report.json"'),
    extractSections: z.boolean().default(true).describe('Whether to extract markdown headings or JSON root keys'),
    maxCharacters: z.number().default(5000).describe('Limit characters returned to avoid context overflow')
  }),
  requiresApproval: () => false,
  execute: async (input): Promise<ToolResult> => {
    try {
      const resolved = path.resolve(config.workspaceRoot, input.documentPath);
      const rel = path.relative(config.workspaceRoot, resolved);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return { success: false, error: 'Document must be inside the safe workspace sandbox' };
      }

      if (!fsSync.existsSync(resolved)) {
        return { success: false, error: `Document '${input.documentPath}' not found` };
      }

      const raw = await fs.readFile(resolved, 'utf-8');
      const ext = path.extname(resolved).toLowerCase();
      const length = raw.length;

      let extractedStructure: any = null;

      if (ext === '.json') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            extractedStructure = { type: 'json_array', itemCount: parsed.length, sample: parsed.slice(0, 3) };
          } else if (typeof parsed === 'object' && parsed !== null) {
            extractedStructure = { type: 'json_object', keys: Object.keys(parsed) };
          }
        } catch {
          extractedStructure = { type: 'invalid_json' };
        }
      } else if (ext === '.md' || ext === '.markdown') {
        const headings = raw.match(/^#{1,4}\s+.+$/gm) || [];
        extractedStructure = { type: 'markdown', headings: headings.slice(0, 15) };
      }

      const truncated = raw.slice(0, input.maxCharacters);
      const isTruncated = length > input.maxCharacters;

      return {
        success: true,
        data: {
          documentPath: input.documentPath,
          fileType: ext || 'text',
          totalCharacters: length,
          isTruncated,
          structure: extractedStructure,
          content: truncated
        }
      };
    } catch (err: any) {
      return { success: false, error: `Document analysis failed: ${err.message}` };
    }
  }
};
