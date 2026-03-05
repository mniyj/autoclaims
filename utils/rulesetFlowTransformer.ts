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
  laneColor?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export type RulesetFlowNode = Node<FlowNodeData>;
export type RulesetFlowEdge = Edge;

export interface FlowElementsResult {
  nodes: RulesetFlowNode[];
  edges: RulesetFlowEdge[];
}

const DOMAIN_COLORS: Record<string, { 
  bg: string; 
  border: string; 
  text: string;
  laneColor: string;
  edgeColor: string;
}> = {
  ELIGIBILITY: { 
    bg: 'bg-blue-100', 
    border: 'border-blue-500', 
    text: 'text-blue-800',
    laneColor: '#dbeafe',
    edgeColor: '#3b82f6',
  },
  ASSESSMENT: { 
    bg: 'bg-green-100', 
    border: 'border-green-500', 
    text: 'text-green-800',
    laneColor: '#dcfce7',
    edgeColor: '#22c55e',
  },
  POST_PROCESS: { 
    bg: 'bg-purple-100', 
    border: 'border-purple-500', 
    text: 'text-purple-800',
    laneColor: '#f3e8ff',
    edgeColor: '#a855f7',
  },
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

const DOMAIN_LABELS: Record<string, string> = {
  ELIGIBILITY: '定责',
  ASSESSMENT: '定损',
  POST_PROCESS: '后处理',
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

export function rulesetToFlowElements(ruleset: InsuranceRuleset): FlowElementsResult {
  const nodes: RulesetFlowNode[] = [];
  const edges: RulesetFlowEdge[] = [];
  
  if (!ruleset?.rules?.length) {
    return { nodes, edges };
  }

  const domainOrder = ['ELIGIBILITY', 'ASSESSMENT', 'POST_PROCESS'] as const;
  const laneWidth = 380;
  const laneGap = 80;
  const startY = 0;
  const domainY = 100;
  const categoryY = 200;
  const ruleStartY = 320;
  const nodeHeight = 70;
  const categoryGap = 40;
  const ruleGap = 20;

  const totalWidth = domainOrder.length * laneWidth + (domainOrder.length - 1) * laneGap;

  // 1. Create ruleset start node (top center)
  const startNode: RulesetFlowNode = {
    id: 'ruleset_start',
    type: 'rulesetStart',
    position: { x: 0, y: startY },
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

  // 2. Create domain lanes
  domainOrder.forEach((domainKey, domainIndex) => {
    const domainConfig = ruleset.execution_pipeline?.domains?.find(
      (d) => d.domain === domainKey
    );
    
    const domainRules = ruleset.rules.filter(
      (r) => r.execution?.domain === domainKey
    );
    
    if (domainRules.length === 0 && !domainConfig) return;

    const laneX = (domainIndex - 1) * (laneWidth + laneGap);
    const colors = DOMAIN_COLORS[domainKey];
    
    // Add lane background node (for visual grouping)
    const laneBgId = `lane_bg_${domainKey}`;
    const maxNodesInLane = Math.max(
      1,
      domainRules.length + (domainConfig?.category_sequence?.length || 0)
    );
    const laneHeight = Math.max(400, maxNodesInLane * 60 + 200);
    
    nodes.push({
      id: laneBgId,
      type: 'default',
      position: { x: laneX - laneWidth/2 + 10, y: domainY - 50 },
      style: { 
        width: laneWidth - 20, 
        height: laneHeight,
        backgroundColor: colors.laneColor,
        borderRadius: '12px',
        border: `3px solid ${colors.edgeColor}`,
        opacity: 0.15,
        zIndex: -1,
        pointerEvents: 'none' as const,
      },
      data: {
        label: '',
        laneColor: colors.laneColor,
      },
      selectable: false,
      draggable: false,
    });
    
    // Add domain node
    const domainId = generateNodeId('domain', domainKey);
    const domainNode: RulesetFlowNode = {
      id: domainId,
      type: 'executionDomain',
      position: { x: laneX, y: domainY },
      data: {
        label: DOMAIN_LABELS[domainKey] || domainKey,
        description: `${domainRules.length} 条规则`,
        domain: domainKey,
        count: domainRules.length,
        executionMode: domainConfig?.execution_mode,
        colorClass: `${colors.bg} ${colors.border} ${colors.text}`,
        laneColor: colors.laneColor,
        details: {
          categories: domainConfig?.category_sequence || [],
          inputGranularity: domainConfig?.input_granularity,
          loopCollection: domainConfig?.loop_collection,
        },
      },
    };
    nodes.push(domainNode);
    
    // Connect ruleset to domain with domain color
    edges.push({
      id: `ruleset_start->${domainId}`,
      source: 'ruleset_start',
      target: domainId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: colors.edgeColor, strokeWidth: 3 },
    });

    // Group rules by category
    const categories = domainConfig?.category_sequence || [];
    let currentY = categoryY;
    
    categories.forEach((categoryKey) => {
      const categoryRules = domainRules.filter((r) => r.category === categoryKey);
      
      if (categoryRules.length === 0) return;
      
      const categoryId = generateNodeId(`cat_${domainKey}`, categoryKey);
      const colorClass = CATEGORY_COLORS[categoryKey] || 'bg-gray-50 border-gray-400 text-gray-700';
      
      // Add category node
      const categoryNode: RulesetFlowNode = {
        id: categoryId,
        type: 'category',
        position: { x: laneX, y: currentY },
        data: {
          label: categoryKey,
          description: `${categoryRules.length} 条规则`,
          category: categoryKey,
          domain: domainKey,
          count: categoryRules.length,
          colorClass,
          laneColor: colors.laneColor,
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
      
      // Connect domain to category with domain color
      edges.push({
        id: `${domainId}->${categoryId}`,
        source: domainId,
        target: categoryId,
        type: 'smoothstep',
        style: { stroke: colors.edgeColor, strokeWidth: 2, opacity: 0.6 },
      });
      
      currentY += nodeHeight + categoryGap;
      
      // Add rules under this category
      categoryRules.forEach((rule) => {
        const ruleId = generateNodeId('rule', rule.rule_id);
        const conditionCount = countConditionNodes(rule.conditions);
        
        const ruleNode: RulesetFlowNode = {
          id: ruleId,
          type: 'rule',
          position: { x: laneX, y: currentY },
          data: {
            label: rule.rule_name,
            description: rule.description || `${conditionCount} 个条件`,
            ruleId: rule.rule_id,
            ruleName: rule.rule_name,
            category: rule.category,
            domain: domainKey,
            status: rule.status,
            count: conditionCount,
            laneColor: colors.laneColor,
            details: {
              action: rule.action?.action_type,
              priority: rule.priority,
              confidence: rule.parsing_confidence,
            },
          },
        };
        nodes.push(ruleNode);
        
        // Connect category to rule
        edges.push({
          id: `${categoryId}->${ruleId}`,
          source: categoryId,
          target: ruleId,
          type: 'smoothstep',
          style: { stroke: colors.edgeColor, strokeWidth: 1, opacity: 0.4 },
        });
        
        currentY += nodeHeight + ruleGap;
      });
      
      currentY += 10;
    });
  });

  // Add override chain connections
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

  return { nodes, edges };
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

  const positionedNodes = calculateTreeLayout(nodes, edges);
  return { nodes: positionedNodes, edges };
}

function calculateTreeLayout(
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
  
  const horizontalGap = 200;
  const verticalGap = 100;
  
  return nodes.map((node) => {
    const level = levelMap.get(node.id) || 0;
    const nodesInThisLevel = nodesAtLevel.get(level) || [];
    const indexInLevel = nodesInThisLevel.indexOf(node.id);
    const totalInLevel = nodesInThisLevel.length;
    
    const totalWidth = (totalInLevel - 1) * horizontalGap;
    const x = (indexInLevel * horizontalGap) - (totalWidth / 2);
    const y = level * verticalGap;
    
    return {
      ...node,
      position: { x, y },
    };
  });
}

export default rulesetToFlowElements;
