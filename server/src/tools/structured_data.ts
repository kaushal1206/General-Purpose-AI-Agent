import { z } from 'zod';
import { AgentTool, ToolResult } from './types.js';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { config } from '../config/index.js';

export const structuredDataTool: AgentTool = {
  name: 'structured_data',
  description: 'Parse, filter, aggregate, and transform CSV or tabular structured datasets.',
  category: 'structured_data',
  riskLevel: 'safe',
  inputSchema: z.object({
    operation: z.enum(['parse_csv', 'filter_rows', 'aggregate_column', 'export_csv']).describe('Data operation'),
    csvFilePath: z.string().optional().describe('Relative path to CSV file in workspace'),
    rawCsvData: z.string().optional().describe('Raw CSV string data if no file is provided'),
    filterColumn: z.string().optional().describe('Column name to filter on'),
    filterValue: z.string().optional().describe('Value to filter for (case-insensitive contains)'),
    aggregateColumn: z.string().optional().describe('Numeric column name for aggregation'),
    aggregateFunction: z.enum(['sum', 'average', 'min', 'max', 'count']).optional(),
    rowsToExport: z.array(z.record(z.any())).optional(),
    outputFilePath: z.string().optional().describe('Destination path to save exported CSV in workspace')
  }),
  requiresApproval: () => false,
  execute: async (input): Promise<ToolResult> => {
    try {
      let csvContent = input.rawCsvData;

      if (!csvContent && input.csvFilePath) {
        const resolved = path.resolve(config.workspaceRoot, input.csvFilePath);
        const rel = path.relative(config.workspaceRoot, resolved);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          return { success: false, error: 'Path outside workspace sandbox' };
        }
        if (!fsSync.existsSync(resolved)) {
          return { success: false, error: `CSV file '${input.csvFilePath}' not found` };
        }
        csvContent = await fs.readFile(resolved, 'utf-8');
      }

      switch (input.operation) {
        case 'parse_csv': {
          if (!csvContent) {
            return { success: false, error: 'Either csvFilePath or rawCsvData must be provided' };
          }
          const records: any[] = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
          });

          return {
            success: true,
            data: {
              totalRows: records.length,
              columns: records.length > 0 ? Object.keys(records[0]) : [],
              sample: records.slice(0, 5),
              allRows: records.length <= 50 ? records : undefined
            }
          };
        }

        case 'filter_rows': {
          if (!csvContent) {
            return { success: false, error: 'CSV data required for filtering' };
          }
          if (!input.filterColumn || input.filterValue === undefined) {
            return { success: false, error: 'filterColumn and filterValue are required for filter_rows' };
          }

          const records: any[] = parse(csvContent, { columns: true, skip_empty_lines: true });
          const col = input.filterColumn;
          const val = String(input.filterValue).toLowerCase();

          const matched = records.filter(row => {
            const rowVal = String(row[col] ?? '').toLowerCase();
            return rowVal.includes(val);
          });

          return {
            success: true,
            data: {
              matchedCount: matched.length,
              filter: { column: col, value: input.filterValue },
              results: matched.slice(0, 20)
            }
          };
        }

        case 'aggregate_column': {
          if (!csvContent) {
            return { success: false, error: 'CSV data required for aggregation' };
          }
          if (!input.aggregateColumn || !input.aggregateFunction) {
            return { success: false, error: 'aggregateColumn and aggregateFunction (sum, average, min, max, count) are required' };
          }

          const records: any[] = parse(csvContent, { columns: true, skip_empty_lines: true });
          const col = input.aggregateColumn;
          const fn = input.aggregateFunction;

          const numbers = records
            .map(r => parseFloat(r[col]))
            .filter(n => !isNaN(n));

          if (numbers.length === 0) {
            return { success: false, error: `No numeric values found in column '${col}'` };
          }

          let result = 0;
          if (fn === 'count') result = numbers.length;
          else if (fn === 'sum') result = numbers.reduce((acc, curr) => acc + curr, 0);
          else if (fn === 'average') result = numbers.reduce((acc, curr) => acc + curr, 0) / numbers.length;
          else if (fn === 'min') result = Math.min(...numbers);
          else if (fn === 'max') result = Math.max(...numbers);

          return {
            success: true,
            data: {
              column: col,
              function: fn,
              valueCount: numbers.length,
              result: Math.round(result * 1000) / 1000
            }
          };
        }

        case 'export_csv': {
          if (!input.rowsToExport || input.rowsToExport.length === 0) {
            return { success: false, error: 'rowsToExport array cannot be empty' };
          }
          const outputString = stringify(input.rowsToExport, { header: true });

          if (input.outputFilePath) {
            const resolved = path.resolve(config.workspaceRoot, input.outputFilePath);
            const rel = path.relative(config.workspaceRoot, resolved);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
              return { success: false, error: 'Output path outside workspace sandbox' };
            }
            await fs.mkdir(path.dirname(resolved), { recursive: true });
            await fs.writeFile(resolved, outputString, 'utf-8');
            return {
              success: true,
              data: {
                message: `Exported ${input.rowsToExport.length} rows to '${input.outputFilePath}'`,
                outputPath: input.outputFilePath
              }
            };
          }

          return {
            success: true,
            data: {
              csvString: outputString,
              rowCount: input.rowsToExport.length
            }
          };
        }
      }
    } catch (err: any) {
      return { success: false, error: `Structured data error: ${err.message}` };
    }
  }
};
