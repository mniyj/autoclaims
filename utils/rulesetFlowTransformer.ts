import type { 
  InsuranceRuleset, 
  RulesetRule, 
  RuleConditions,
  LeafCondition, 
  GroupCondition,
  RuleAction
} from '../types';
import type { Node, Edge } from '@xyflow/react';

export interface FlowNodeData {
  label: string;
  description?: string;
  operator?: string;
  field?: string;
  value?: string | number | boolean | string[] | null;
  action?: string;
  category?: string;
  domain?: string;
  ruleId?: string;
  ruleName?: string;
  status?: string;
  executionMode?: string;
  count?: number;
  colorClass?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export type RulesetFlowNode = Node<FlowNodeData>;
export type RulesetFlowEdge = Edge;

export interface FlowElementsResult {
  nodes: RulesetFlowNode[];
  edges: RulesetFlowEdge[];
}

const DOMAIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ELIGIBILITY: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
  ASSESSMENT: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
  POST_PROCESS: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800' },
};

const CATEGORY_COLORS: Record<string, string> = {
  COVERAGE_SCOPE: 'bg-cyan-50 border-cyan-400 text-cyan-700',
  EXCLUSION: 'bg-red-50 border-red-400 text-red-700',
  WAITING_PERIOD: 'bg-yellow-50 border-yellow-400 text-yellow-700',
  CLAIM_TIMELINE: 'bg-orange-50 border-orange-400 text-orange-700',
  COVERAGE_PERIOD: 'bg-indigo-50 border-indigo-400 text-indigo-700',
  POLICY_STATUS: 'bg-pink-50 border-pink-400 text-pink-700',
  ITEM_CLASSIFICATION: 'bg-teal-50 border-teal-400 text-teal-700',
  PRICING_REASONABILITY: 'bg-lime-50 border-lime-400 text-lime-700',
  DISABILITY_ASSESSMENT: 'bg-emerald-50 border-emerald-400 text-emerald-700',
  DEPRECIATION: 'bg-amber-50 border-amber-400 text-amber-700',
  PROPORTIONAL_LIABILITY: 'bg-violet-50 border-violet-400 text-violet-700',
  DEDUCTIBLE: 'bg-rose-50 border-rose-400 text-rose-700',
  SUB_LIMIT: 'bg-sky-50 border-sky-400 text-sky-700',
  SOCIAL_INSURANCE: 'bg-fuchsia-50 border-fuchsia-400 text-fuchsia-700',
  BENEFIT_OFFSET: 'bg-slate-50 border-slate-400 text-slate-700',
  AGGREGATE_CAP: 'bg-zinc-50 border-zinc-400 text-zinc-700',
  POST_ADJUSTMENT: 'bg-neutral-50 border-neutral-400 text-neutral-700',
};

function isGroupCondition(expr: LeafCondition | GroupCondition): expr is GroupCondition {
  return 'logic' in expr && 'expressions' in expr && !('field' in expr);
}

function generateNodeId(prefix: string, id: string): string {
  return `${prefix}_${id}`;
}

function formatValue(value: string | number | boolean | string[] | null): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}

function countConditionNodes(conditions: RuleConditions): number {
  if (!conditions?.expressions) return 0;
  let count = 1;
  conditions.expressions.forEach((expr) => {
    if (isGroupCondition(expr)) {
      count += countConditionNodes(expr as RuleConditions);
    } else {
      count += 1;
    }
  });
  return count;
}

function calculateLayout(
  nodes: RulesetFlowNode[],
  edges: RulesetFlowEdge[]
): RulesetFlowNode[] {
  const levelMap = new Map<string, number>();
  const nodesAtLevel = new Map<number, string[]>();
  
  const incomingEdges = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge.source);
  });
  
  const rootNodes = nodes.filter((node) => !incomingEdges.has(node.id));
  
  const queue: Array<{ id: string; level: number }> = rootNodes.map((n) => ({ id: n.id, level: 0 }));
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
    
    const children = edges
      .filter((edge) => edge.source === id)
      .map((edge) => edge.target);
    
    children.forEach((childId) => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }
  
  const horizontalGap = 220;
  const verticalGap = 120;
  
  return nodes.map((node) => {
    const level = levelMap.get(node.id) || 0;
    const nodesInThisLevel = nodesAtLevel.get(level) || [];
    const indexInLevel = nodesInThisLevel.indexOf(node.id);
    const totalInLevel = nodesInThisLevel.length;
    
    const totalWidth = (totalInLevel - 1) * horizontalGap;
    const x = indexInLevel * horizontalGap - totalWidth / 2;
    const y = level * verticalGap;
    
    return {
      ...node,
      position: { x, y },
    };
  });
}

export function rulesetToFlowElements(ruleset: InsuranceRuleset): FlowElementsResult {
  const nodes: RulesetFlowNode[] = [];
  const edges: RulesetFlowEdge[] = [];
  
  if (!ruleset?.rules?.length) {
    return { nodes, edges };
  }

  // 1. Create ruleset start node
  const startNode: RulesetFlowNode = {
    id: 'ruleset_start',
    type: 'rulesetStart',
    position: { x: 0, y: 0 },
    data: {
      label: ruleset.policy_info.product_name || '规则集',
      description: `版本: ${ruleset.metadata.version} | 规则数: ${ruleset.rules.length}`,
      count: ruleset.rules.length,
      details: {
        rulesetId: ruleset.ruleset_id,
        productLine: ruleset.product_line,
        version: ruleset.metadata.version,
      },
    },
  };
  nodes.push(startNode);

  // 2. Create execution domain nodes
  const domainOrder = ['ELIGIBILITY', 'ASSESSMENT', 'POST_PROCESS'];
  let lastDomainId: string | null = 'ruleset_start';
  
  domainOrder.forEach((domainKey) => {
    const domainConfig = ruleset.execution_pipeline?.domains?.find(
      (d) => d.domain === domainKey
    );
    
    const domainRules = ruleset.rules.filter(
      (r) => r.execution?.domain === domainKey
    );
    
    if (domainRules.length === 0 && !domainConfig) return;
    
    const domainId = generateNodeId('domain', domainKey);
    const colors = DOMAIN_COLORS[domainKey] || DOMAIN_COLORS.ELIGIBILITY;
    
    const domainNode: RulesetFlowNode = {
      id: domainId,
      type: 'executionDomain',
      position: { x: 0, y: 0 },
      data: {
        label: domainKey,
        description: `${domainRules.length} 条规则`,
        domain: domainKey,
        count: domainRules.length,
        executionMode: domainConfig?.execution_mode,
        colorClass: `${colors.bg} ${colors.border} ${colors.text}`,
        details: {
          categories: domainConfig?.category_sequence || [],
          inputGranularity: domainConfig?.input_granularity,
          loopCollection: domainConfig?.loop_collection,
        },
      },
    };
    nodes.push(domainNode);
    
    if (lastDomainId) {
      edges.push({
        id: `${lastDomainId}->${domainId}`,
        source: lastDomainId,
        target: domainId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      });
    }
    
    // 3. Create category nodes within this domain
    const categories = domainConfig?.category_sequence || [];
    
    categories.forEach((categoryKey) => {
      const categoryRules = domainRules.filter((r) => r.category === categoryKey);
      
      if (categoryRules.length === 0) return;
      
      const categoryId = generateNodeId(`cat_${domainKey}`, categoryKey);
      const colorClass = CATEGORY_COLORS[categoryKey] || 'bg-gray-50 border-gray-400 text-gray-700';
      
      const categoryNode: RulesetFlowNode = {
        id: categoryId,
        type: 'category',
        position: { x: 0, y: 0 },
        data: {
          label: categoryKey,
          description: `${categoryRules.length} 条规则`,
          category: categoryKey,
          domain: domainKey,
          count: categoryRules.length,
          colorClass,
          details: {
            rules: categoryRules.map((r) => ({
              id: r.rule_id,
              name: r.rule_name,
              status: r.status,
            })),
          },
        },
      };
      nodes.push(categoryNode);
      
      edges.push({
        id: `${domainId}->${categoryId}`,
        source: domainId,
        target: categoryId,
        type: 'smoothstep',
        style: { stroke: '#9ca3af', strokeWidth: 1 },
      });
      
      // 4. Create rule nodes within this category
      categoryRules.forEach((rule) => {
        const ruleId = generateNodeId('rule', rule.rule_id);
        const conditionCount = countConditionNodes(rule.conditions);
        
        const ruleNode: RulesetFlowNode = {
          id: ruleId,
          type: 'rule',
          position: { x: 0, y: 0 },
          data: {
            label: rule.rule_name,
            description: rule.description || `${conditionCount} 个条件`,
            ruleId: rule.rule_id,
            ruleName: rule.rule_name,
            category: rule.category,
            domain: domainKey,
            status: rule.status,
            count: conditionCount,
            details: {
              action: rule.action?.action_type,
              priority: rule.priority,
              confidence: rule.parsing_confidence,
            },
          },
        };
        nodes.push(ruleNode);
        
        edges.push({
          id: `${categoryId}->${ruleId}`,
          source: categoryId,
          target: ruleId,
          type: 'smoothstep',
          style: { stroke: '#d1d5db', strokeWidth: 1 },
        });
      });
    });
    
    lastDomainId = domainId;
  });

  // 5. Add override chain connections
  if (ruleset.override_chains?.length) {
    ruleset.override_chains.forEach((chain) => {
      if (chain.chain?.length > 1) {
        for (let i = 0; i < chain.chain.length - 1; i++) {
          const currentRuleId = generateNodeId('rule', chain.chain[i].rule_id);
          const nextRuleId = generateNodeId('rule', chain.chain[i + 1].rule_id);
          
          if (nodes.some((n) => n.id === currentRuleId) && nodes.some((n) => n.id === nextRuleId)) {
            edges.push({
              id: `override_${currentRuleId}_${nextRuleId}`,
              source: currentRuleId,
              target: nextRuleId,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5,5' },
              label: '覆盖',
              labelStyle: { fill: '#f59e0b', fontSize: 10 },
            });
          }
        }
      }
    });
  }

  const positionedNodes = calculateLayout(nodes, edges);
  return { nodes: positionedNodes, edges };
}

export function ruleToDetailedFlowElements(rule: RulesetRule): FlowElementsResult {
  const nodes: RulesetFlowNode[] = [];
  const edges: RulesetFlowEdge[] = [];
  
  if (!rule?.conditions) {
    return { nodes, edges };
  }

  function buildConditionNodes(
    conditions: RuleConditions,
    parentId: string | null,
    path: string
  ): void {
    const currentId = generateNodeId(rule.rule_id, path);
    const logic = conditions.logic;
    const expressions = conditions.expressions || [];
    
    if (logic && expressions.length > 0) {
      const node: RulesetFlowNode = {
        id: currentId,
        type: 'logicGate',
        position: { x: 0, y: 0 },
        data: {
          label: logic,
          operator: logic,
          description: `${logic} 逻辑组`,
        },
      };
      nodes.push(node);
      
      if (parentId) {
        edges.push({
          id: `${parentId}->${currentId}`,
          source: parentId,
          target: currentId,
          type: 'smoothstep',
        });
      }
      
      expressions.forEach((expr, index) => {
        const childPath = `${path}_${index}`;
        if (isGroupCondition(expr)) {
          buildConditionNodes(expr as RuleConditions, currentId, childPath);
        } else {
          const leafId = generateNodeId(rule.rule_id, childPath);
          const leafNode: RulesetFlowNode = {
            id: leafId,
            type: 'condition',
            position: { x: 0, y: 0 },
            data: {
              label: `${expr.field}`,
              field: expr.field,
              operator: expr.operator,
              value: formatValue(expr.value),
              description: `${expr.field} ${expr.operator} ${formatValue(expr.value)}`,
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

  buildConditionNodes(rule.conditions, null, 'root');
  
  if (rule.action && nodes.length > 0) {
    const actionId = generateNodeId(rule.rule_id, 'action');
    const lastConditionNode = nodes[nodes.length - 1];
    
    const actionNode: RulesetFlowNode = {
      id: actionId,
      type: 'action',
      position: { x: 0, y: 0 },
      data: {
        label: rule.action.action_type,
        action: rule.action.action_type,
        description: `执行动作: ${rule.action.action_type}`,
      },
    };
    
    nodes.push(actionNode);
    edges.push({
      id: `${lastConditionNode.id}->${actionId}`,
      source: lastConditionNode.id,
      target: actionId,
      type: 'smoothstep',
      label: '执行',
    });
  }

  const positionedNodes = calculateLayout(nodes, edges);
  return { nodes: positionedNodes, edges };
}

export default rulesetToFlowElements;
