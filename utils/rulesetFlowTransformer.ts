import type { RulesetRule, RuleConditions, LeafCondition, GroupCondition, RuleAction } from '../types';
import type { Node, Edge } from '@xyflow/react';

export interface FlowNodeData {
  label: string;
  description?: string;
  operator?: string;
  field?: string;
  value?: string | number | boolean | string[] | null;
  action?: string;
  category?: string;
  [key: string]: unknown;
}

/**
 * Extended node type for ruleset visualization
 */
export type RulesetFlowNode = Node<FlowNodeData>;

/**
 * Extended edge type for ruleset visualization
 */
export type RulesetFlowEdge = Edge;

/**
 * Result of transforming a rule to flow elements
 */
export interface FlowElementsResult {
  nodes: RulesetFlowNode[];
  edges: RulesetFlowEdge[];
}

// Node dimensions for layout
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const LOGIC_GATE_SIZE = 100;

/**
 * Check if an expression is a group condition (AND/OR/NOT)
 */
function isGroupCondition(expr: LeafCondition | GroupCondition): expr is GroupCondition {
  return 'logic' in expr && 'expressions' in expr && !('field' in expr);
}

/**
 * Generate a unique node ID
 */
function generateNodeId(ruleId: string, path: string): string {
  return `${ruleId}_node_${path}`;
}

/**
 * Format condition value for display
 */
function formatValue(value: string | number | boolean | string[] | null): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}

/**
 * Format operator for display
 */
function formatOperator(operator: string): string {
  const operatorLabels: Record<string, string> = {
    EQ: '=',
    NE: '≠',
    GT: '>',
    GTE: '≥',
    LT: '<',
    LTE: '≤',
    IN: '包含',
    NOT_IN: '不包含',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
    STARTS_WITH: '开头是',
    BETWEEN: '介于',
    IS_NULL: '为空',
    IS_NOT_NULL: '不为空',
    IS_TRUE: '为真',
    IS_FALSE: '为假',
    MATCHES_REGEX: '匹配正则',
  };
  return operatorLabels[operator] || operator;
}

/**
 * Recursively build nodes and edges from conditions
 */
function buildConditionNodes(
  ruleId: string,
  conditions: RuleConditions | GroupCondition,
  parentId: string | null,
  path: string,
  nodes: RulesetFlowNode[],
  edges: RulesetFlowEdge[]
): void {
  const currentId = generateNodeId(ruleId, path);
  
  // Determine if this is a root conditions object or a nested group
  const logic = 'logic' in conditions ? conditions.logic : null;
  const expressions = conditions.expressions || [];
  
  if (logic && expressions.length > 0) {
    // This is a logic gate (AND/OR/NOT)
    const node: RulesetFlowNode = {
      id: currentId,
      type: 'logicGate',
      position: { x: 0, y: 0 }, // Will be calculated by layout
      data: {
        label: logic,
        operator: logic as 'AND' | 'OR' | 'NOT',
        description: `${logic} 逻辑组`,
      },
    };
    nodes.push(node);
    
    // Connect to parent if exists
    if (parentId) {
      edges.push({
        id: `${parentId}->${currentId}`,
        source: parentId,
        target: currentId,
        type: 'smoothstep',
      });
    }
    
    // Process child expressions
    expressions.forEach((expr, index) => {
      const childPath = `${path}_${index}`;
      if (isGroupCondition(expr)) {
        buildConditionNodes(ruleId, expr, currentId, childPath, nodes, edges);
      } else {
        // Leaf condition
        const leafId = generateNodeId(ruleId, childPath);
        const leafNode: RulesetFlowNode = {
          id: leafId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: {
            label: `${expr.field}`,
            field: expr.field,
            operator: expr.operator,
            value: formatValue(expr.value),
            description: `${expr.field} ${formatOperator(expr.operator)} ${formatValue(expr.value)}`,
          },
        };
        nodes.push(leafNode);
        edges.push({
          id: `${currentId}->${leafId}`,
          source: currentId,
          target: leafId,
          type: 'smoothstep',
        });
      }
    });
  }
}

function buildActionNode(
  ruleId: string,
  action: RuleAction,
  parentConditionId: string,
  nodes: RulesetFlowNode[],
  edges: RulesetFlowEdge[]
): void {
  const actionId = generateNodeId(ruleId, 'action');
  const actionType = action.action_type;
  
  const actionNode: RulesetFlowNode = {
    id: actionId,
    type: 'action',
    position: { x: 0, y: 0 },
    data: {
      label: actionType,
      action: actionType,
      description: `执行动作: ${actionType}`,
    },
  };
  
  nodes.push(actionNode);
  edges.push({
    id: `${parentConditionId}->${actionId}`,
    source: parentConditionId,
    target: actionId,
    type: 'smoothstep',
    label: '执行',
  });
}

/**
 * Calculate node positions using a simple tree layout algorithm
 * This is a basic implementation - for production, consider using Dagre
 */
function calculateLayout(nodes: RulesetFlowNode[], edges: RulesetFlowEdge[]): RulesetFlowNode[] {
  const levelMap = new Map<string, number>();
  const nodesAtLevel = new Map<number, string[]>();
  
  // Find root nodes (no incoming edges)
  const incomingEdges = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge.source);
  });
  
  const rootNodes = nodes.filter(node => !incomingEdges.has(node.id));
  
  // Assign levels using BFS
  const queue: Array<{ id: string; level: number }> = rootNodes.map(n => ({ id: n.id, level: 0 }));
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    
    levelMap.set(id, level);
    if (!nodesAtLevel.has(level)) {
      nodesAtLevel.set(level, []);
    }
    nodesAtLevel.get(level)!.push(id);
    
    // Find children
    const children = edges
      .filter(edge => edge.source === id)
      .map(edge => edge.target);
    
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }
  
  // Calculate positions
  const horizontalGap = 200;
  const verticalGap = 150;
  
  return nodes.map(node => {
    const level = levelMap.get(node.id) || 0;
    const nodesInThisLevel = nodesAtLevel.get(level) || [];
    const indexInLevel = nodesInThisLevel.indexOf(node.id);
    const totalInLevel = nodesInThisLevel.length;
    
    // Center the nodes at each level
    const totalWidth = (totalInLevel - 1) * horizontalGap;
    const x = (indexInLevel * horizontalGap) - (totalWidth / 2);
    const y = level * verticalGap;
    
    return {
      ...node,
      position: { x, y },
    };
  });
}

/**
 * Transform a RulesetRule into React Flow nodes and edges
 * 
 * @param rule - The ruleset rule to transform
 * @returns Object containing nodes and edges for React Flow
 */
export function ruleToFlowElements(rule: RulesetRule): FlowElementsResult {
  const nodes: RulesetFlowNode[] = [];
  const edges: RulesetFlowEdge[] = [];
  
  if (!rule.conditions) {
    return { nodes, edges };
  }
  
  // Build condition tree
  buildConditionNodes(
    rule.rule_id,
    rule.conditions,
    null,
    'root',
    nodes,
    edges
  );
  
  // Build action node if exists
  if (rule.action && nodes.length > 0) {
    // Find the last condition node to connect action to
    const lastConditionNode = nodes[nodes.length - 1];
    buildActionNode(rule.rule_id, rule.action, lastConditionNode.id, nodes, edges);
  }
  
  // Calculate layout
  const positionedNodes = calculateLayout(nodes, edges);
  
  return {
    nodes: positionedNodes,
    edges,
  };
}

/**
 * Transform multiple rules into a combined flow (for ruleset overview)
 * 
 * @param rules - Array of ruleset rules
 * @returns Object containing nodes and edges for React Flow
 */
export function rulesToFlowElements(rules: RulesetRule[]): FlowElementsResult {
  const allNodes: RulesetFlowNode[] = [];
  const allEdges: RulesetFlowEdge[] = [];
  
  rules.forEach((rule, index) => {
    const { nodes, edges } = ruleToFlowElements(rule);
    
    // Offset nodes for each rule to prevent overlap
    const yOffset = index * 500;
    const offsetNodes = nodes.map(node => ({
      ...node,
      position: {
        x: node.position.x,
        y: node.position.y + yOffset,
      },
    }));
    
    allNodes.push(...offsetNodes);
    allEdges.push(...edges);
  });
  
  return {
    nodes: allNodes,
    edges: allEdges,
  };
}

export default ruleToFlowElements;
