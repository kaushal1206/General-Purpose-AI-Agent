import { z } from 'zod';
import { AgentTool, ToolResult } from './types.js';
import { config } from '../config/index.js';
import { capabilityRegistry } from '../capabilities/registry.js';

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description: 'Search the live web for real-time information, research, and documentation sources using a configured search provider.',
  category: 'web_research',
  riskLevel: 'safe',
  inputSchema: z.object({
    query: z.string().min(2).max(300).describe('Search query string'),
    maxResults: z.number().min(1).max(10).default(5).describe('Number of results to retrieve')
  }),
  requiresApproval: () => false,
  execute: async (input): Promise<ToolResult> => {
    // 1. Check capability registry first
    const cap = capabilityRegistry.getCapability('web_search');
    if (!cap || !cap.configured || !cap.credentialsAvailable) {
      return {
        success: false,
        error: 'Web search capability is not configured or enabled on this agent.',
        data: {
          missingCapability: 'web_search',
          provider: config.search.provider,
          explanation: 'No live external web search engine (Tavily, Brave, or SearXNG) has been configured with credentials in server/.env.',
          alternative: 'You can provide the text, article, or documentation directly in chat or place it in the workspace folder for document analysis.',
          setupInstructions: cap?.setupInstructions || 'Set SEARCH_PROVIDER and API key in server/.env'
        }
      };
    }

    try {
      // 2. Execute via configured provider
      if (config.search.provider === 'tavily' && config.search.tavilyApiKey) {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: config.search.tavilyApiKey,
            query: input.query,
            max_results: input.maxResults,
            search_depth: 'basic'
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, error: `Tavily search provider returned error (${res.status}): ${errText}` };
        }

        const data: any = await res.json();
        const results = (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score
        }));

        return {
          success: true,
          data: {
            provider: 'tavily',
            query: input.query,
            resultsCount: results.length,
            results
          }
        };
      }

      if (config.search.provider === 'brave' && config.search.braveApiKey) {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.searchParams.set('q', input.query);
        url.searchParams.set('count', String(input.maxResults));

        const res = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': config.search.braveApiKey
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
          return { success: false, error: `Brave Search returned error (${res.status})` };
        }

        const data: any = await res.json();
        const results = (data.web?.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.description
        }));

        return {
          success: true,
          data: {
            provider: 'brave',
            query: input.query,
            resultsCount: results.length,
            results
          }
        };
      }

      if (config.search.provider === 'searxng' && config.search.searxngUrl) {
        const url = new URL(`${config.search.searxngUrl}/search`);
        url.searchParams.set('q', input.query);
        url.searchParams.set('format', 'json');

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          return { success: false, error: `SearXNG returned error (${res.status})` };
        }

        const data: any = await res.json();
        const results = (data.results || []).slice(0, input.maxResults).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content
        }));

        return {
          success: true,
          data: {
            provider: 'searxng',
            query: input.query,
            resultsCount: results.length,
            results
          }
        };
      }

      return {
        success: false,
        error: `Search provider '${config.search.provider}' is unsupported or missing configuration.`
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Web search execution failed: ${err.message}`
      };
    }
  }
};
