import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { AgentTool, ToolResult, ExecutionContext } from './types.js';
import { config } from '../config/index.js';

function validateAndResolvePath(relativePath: string): { resolved: string; error?: string } {
  // Normalize and prevent path traversal
  const resolved = path.resolve(config.workspaceRoot, relativePath);
  const rel = path.relative(config.workspaceRoot, resolved);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { resolved, error: `Access denied: Path '${relativePath}' is outside safe workspace sandbox.` };
  }
  return { resolved };
}

export const workspaceFilesTool: AgentTool = {
  name: 'workspace_files',
  description: 'Safely read, create, or list files and directories inside the approved workspace sandbox.',
  category: 'filesystem',
  riskLevel: 'moderate',
  inputSchema: z.object({
    operation: z.enum(['list_files', 'read_file', 'write_file', 'create_directory']).describe('Filesystem action to perform'),
    filePath: z.string().default('.').describe('Relative path within workspace, e.g. "report.txt" or "src/index.js"'),
    content: z.string().optional().describe('File content to write (required for write_file)'),
    overwrite: z.boolean().default(false).describe('Whether to overwrite existing file')
  }),
  requiresApproval: (input) => {
    // If writing over an existing file, require human approval
    if (input.operation === 'write_file') {
      const { resolved, error } = validateAndResolvePath(input.filePath);
      if (!error && fsSync.existsSync(resolved)) {
        return true;
      }
    }
    return false;
  },
  getApprovalPrompt: (input) => {
    return `File '${input.filePath}' already exists. Are you sure you want to overwrite its content?`;
  },
  execute: async (input, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { resolved, error } = validateAndResolvePath(input.filePath);
      if (error) {
        return { success: false, error };
      }

      switch (input.operation) {
        case 'list_files': {
          if (!fsSync.existsSync(resolved)) {
            return { success: false, error: `Directory '${input.filePath}' does not exist` };
          }
          const entries = await fs.readdir(resolved, { withFileTypes: true });
          const items = entries.map(e => ({
            name: e.name,
            isDirectory: e.isDirectory(),
            relativePath: path.relative(config.workspaceRoot, path.join(resolved, e.name)).replace(/\\/g, '/')
          }));

          return {
            success: true,
            data: {
              directory: input.filePath,
              itemsCount: items.length,
              items
            }
          };
        }

        case 'read_file': {
          if (!fsSync.existsSync(resolved)) {
            return { success: false, error: `File '${input.filePath}' does not exist in workspace` };
          }
          const stat = await fs.stat(resolved);
          if (stat.size > 5 * 1024 * 1024) {
            return { success: false, error: `File size (${stat.size} bytes) exceeds 5MB limit` };
          }
          const content = await fs.readFile(resolved, 'utf-8');
          return {
            success: true,
            data: {
              filePath: input.filePath,
              sizeBytes: stat.size,
              content
            }
          };
        }

        case 'write_file': {
          if (input.content === undefined) {
            return { success: false, error: 'content is required for write_file' };
          }

          const fileExists = fsSync.existsSync(resolved);
          const isExplicitlyApproved =
            context.isApprovalGranted &&
            (!context.approvedAction ||
              (context.approvedAction.tool === 'workspace_files' &&
                context.approvedAction.input?.filePath === input.filePath));

          if (fileExists && !input.overwrite && !isExplicitlyApproved) {
            return {
              success: false,
              requiresApproval: true,
              approvalPrompt: `Target file '${input.filePath}' already exists. Confirm overwrite?`
            };
          }

          // Ensure parent directory exists
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, input.content, 'utf-8');
          const stat = await fs.stat(resolved);

          return {
            success: true,
            data: {
              filePath: input.filePath,
              bytesWritten: stat.size,
              isNew: !fileExists,
              message: `File '${input.filePath}' successfully written (${stat.size} bytes)`
            },
            auditDetails: {
              action: 'file_written',
              path: input.filePath,
              size: stat.size
            }
          };
        }

        case 'create_directory': {
          await fs.mkdir(resolved, { recursive: true });
          return {
            success: true,
            data: {
              directoryPath: input.filePath,
              message: `Directory '${input.filePath}' created`
            }
          };
        }
      }
    } catch (err: any) {
      return { success: false, error: `Filesystem operation failed: ${err.message}` };
    }
  }
};
