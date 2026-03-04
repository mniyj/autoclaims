import { z } from 'zod';
import { checkPolicyTool } from './checkPolicy.js';
import { submitClaimTool } from './submitClaim.js';
import { getProgressTool } from './getProgress.js';

// Tool registry
const tools = new Map<string, ToolDefinition>();

// Initialize and register all tools
function initializeTools(): void {
  if (tools.size === 0) {
    registerTool(checkPolicyTool);
    registerTool(submitClaimTool);
    registerTool(getProgressTool);
  }
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (params: any) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  needsConfirmation?: boolean;
}

// Register a tool
export function registerTool(def: ToolDefinition): void {
  tools.set(def.name, def);
}

export async function executeTool(name: string, params: any): Promise<ToolResult> {
  initializeTools();
  const tool = tools.get(name);
  
  if (!tool) {
    return {
      success: false,
      error: `未找到工具: ${name}`
    };
  }

  try {
    const validated = tool.inputSchema.parse(params);
    return await tool.handler(validated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `参数错误: ${error.message}`
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

export function getAllTools(): ToolDefinition[] {
  initializeTools();
  return Array.from(tools.values());
}

export { checkPolicyTool, submitClaimTool, getProgressTool };
