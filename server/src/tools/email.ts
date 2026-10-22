import { z } from 'zod';
import { AgentTool, ToolResult, ExecutionContext } from './types.js';
import { config } from '../config/index.js';
import { capabilityRegistry } from '../capabilities/registry.js';
import nodemailer from 'nodemailer';

export const emailTool: AgentTool = {
  name: 'email',
  description: 'Draft, verify, and send real emails via authorized SMTP integration with mandatory human approval before sending.',
  category: 'email',
  riskLevel: 'external_communication',
  inputSchema: z.object({
    action: z.enum(['draft', 'send']).default('draft').describe('Whether to draft or dispatch the email'),
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().min(1).max(200).describe('Email subject line'),
    body: z.string().min(1).describe('Email body text or markdown'),
    isApproved: z.boolean().default(false).describe('Explicit user confirmation flag for dispatch')
  }),
  requiresApproval: (input) => {
    // Sending email ALWAYS requires explicit approval unless previously granted
    if (input.action === 'send') {
      return true;
    }
    return false;
  },
  getApprovalPrompt: (input) => {
    return `Send email to "${input.to}" with subject: "${input.subject}"?`;
  },
  execute: async (input, context: ExecutionContext): Promise<ToolResult> => {
    // Drafting is safe and works even without SMTP configured
    if (input.action === 'draft') {
      return {
        success: true,
        data: {
          action: 'draft_prepared',
          to: input.to,
          subject: input.subject,
          body: input.body,
          from: config.email.from || 'agent@system',
          smtpConfigured: Boolean(config.email.host && config.email.user),
          message: 'Email draft created. To dispatch this email, confirm approval.'
        }
      };
    }

    // 1. Mandatory human approval gate check before any external network activity
    const isExplicitlyApproved =
      input.isApproved ||
      (context.isApprovalGranted &&
        (!context.approvedAction ||
          (context.approvedAction.tool === 'email' &&
            context.approvedAction.input?.to === input.to &&
            context.approvedAction.input?.subject === input.subject)));

    if (!isExplicitlyApproved) {
      return {
        success: false,
        requiresApproval: true,
        approvalPrompt: `Confirm sending email to ${input.to}: "${input.subject}"?`,
        data: {
          status: 'awaiting_approval',
          draft: { to: input.to, subject: input.subject, body: input.body }
        }
      };
    }

    // 2. Action is 'send' and approval granted: verify capability & credentials
    const cap = capabilityRegistry.getCapability('email');
    if (!cap || !cap.configured || !cap.credentialsAvailable) {
      return {
        success: false,
        error: 'Email capability is not configured on this agent.',
        data: {
          missingCapability: 'email',
          explanation: 'Real email sending requires SMTP host, user, and password credentials configured in server/.env.',
          alternative: 'You can review and copy the drafted email message to send manually via your email client.',
          setupInstructions: cap?.setupInstructions || 'Configure SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env'
        }
      };
    }

    // Execute actual send via nodemailer
    try {
      const transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass
        }
      });

      const info = await transporter.sendMail({
        from: config.email.from || config.email.user,
        to: input.to,
        subject: input.subject,
        text: input.body
      });

      return {
        success: true,
        data: {
          action: 'email_sent',
          messageId: info.messageId,
          to: input.to,
          subject: input.subject,
          accepted: info.accepted,
          timestamp: new Date().toISOString()
        },
        auditDetails: {
          eventType: 'email_dispatched',
          to: input.to,
          subject: input.subject,
          messageId: info.messageId
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: `SMTP dispatch failed: ${err.message}`
      };
    }
  }
};
