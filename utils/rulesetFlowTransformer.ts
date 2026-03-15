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

const SEMANTIC_LABELS: Record<string, string> = {
  GATE: '准入',
  TRIGGER: '触发',
  EXCLUSION: '免责',
  ADJUSTMENT: '调整',
  BENEFIT: '给付规则',
  ITEM_ELIGIBILITY: '费用项准入',
  ITEM_RATIO: '比例规则',
  ITEM_PRICING: '限价规则',
  ITEM_CAP: '限额规则',
  ITEM_FLAG: '复核标记',
  POST_PROCESS: '后处理',
  AUXILIARY: '辅助规则',
};

const SEMANTIC_COLORS: Record<string, string> = {
  GATE: 'bg-blue-50 border-blue-400 text-blue-700',
  TRIGGER: 'bg-emerald-50 border-emerald-400 text-emerald-700',
  EXCLUSION: 'bg-red-50 border-red-400 text-red-700',
  ADJUSTMENT: 'bg-amber-50 border-amber-400 text-amber-700',
  BENEFIT: 'bg-cyan-50 border-cyan-400 text-cyan-700',
  ITEM_ELIGIBILITY: 'bg-teal-50 border-teal-400 text-teal-700',
  ITEM_RATIO: 'bg-violet-50 border-violet-400 text-violet-700',
  ITEM_PRICING: 'bg-lime-50 border-lime-400 text-lime-700',
  ITEM_CAP: 'bg-sky-50 border-sky-400 text-sky-700',
  ITEM_FLAG: 'bg-fuchsia-50 border-fuchsia-400 text-fuchsia-700',
  POST_PROCESS: 'bg-slate-50 border-slate-400 text-slate-700',
  AUXILIARY: 'bg-gray-50 border-gray-400 text-gray-700',
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

function inferSemanticKey(rule: RulesetRule): string {
  if (rule.rule_kind) return rule.rule_kind;
  const action = rule.action?.action_type;
  const category = String(rule.category || '').toUpperCase();

  if (rule.execution?.domain === 'POST_PROCESS') return 'POST_PROCESS';
  if (rule.execution?.domain === 'ASSESSMENT') {
    if (action === 'REJECT_ITEM' || action === 'APPROVE_ITEM') return 'ITEM_ELIGIBILITY';
    if (action === 'SET_ITEM_RATIO') return 'ITEM_RATIO';
    if (action === 'ADJUST_ITEM_AMOUNT') return 'ITEM_PRICING';
    if (action === 'APPLY_CAP' || action === 'APPLY_DEDUCTIBLE') return 'ITEM_CAP';
    return 'ITEM_FLAG';
  }
  if (action === 'REJECT_CLAIM' || action === 'TERMINATE_CONTRACT' || category.includes('EXCLUSION')) return 'EXCLUSION';
  if (action === 'SET_CLAIM_RATIO' || category.includes('PAYOUT') || category.includes('PROPORTIONAL')) return 'ADJUSTMENT';
  if (
    category.includes('WAITING') ||
    category.includes('COVERAGE_PERIOD') ||
    category.includes('POLICY_STATUS') ||
    category.includes('CLAIM_TIMELINE')
  ) {
    return 'GATE';
  }
  return 'TRIGGER';
}

export function rulesetToFlowElements(ruleset: InsuranceRuleset): FlowElementsResult {
  const nodes: RulesetFlowNode[] = [];
  const edges: RulesetFlowEdge[] = [];
  
  if (!ruleset?.rules?.length) {
    return { nodes, edges };
  }

  const domainOrder = ['ELIGIBILITY', 'ASSESSMENT', 'POST_PROCESS'] as const;
  const laneWidth = 450;
  const laneGap = 150;
  const startY = 0;
  const domainY = 60;
  const categoryY = 200;
  const ruleStartY = 340;
  const nodeHeight = 70;
  const categoryGap = 80;
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

    const laneCenterX = (domainIndex - 1) * (laneWidth + laneGap);
    const colors = DOMAIN_COLORS[domainKey];
    
    // Add lane background node (for visual grouping)
    const laneBgId = `lane_bg_${domainKey}`;
    const maxNodesInLane = Math.max(
      1,
      domainRules.length + (domainConfig?.semantic_sequence?.length || domainConfig?.category_sequence?.length || 0)
    );
    const laneHeight = Math.max(500, maxNodesInLane * 70 + 250);
    
    nodes.push({
      id: laneBgId,
      type: 'default',
      position: { x: laneCenterX - laneWidth/2 + 15, y: domainY - 40 },
      style: { 
        width: laneWidth - 30, 
        height: laneHeight,
        backgroundColor: colors.laneColor,
        borderRadius: '16px',
        border: `2px solid ${colors.edgeColor}`,
        opacity: 0.12,
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
      position: { x: laneCenterX, y: domainY },
      data: {
        label: DOMAIN_LABELS[domainKey] || domainKey,
        description: `${domainRules.length} 条规则`,
        domain: domainKey,
        count: domainRules.length,
        executionMode: domainConfig?.execution_mode,
        colorClass: `${colors.bg} ${colors.border} ${colors.text}`,
        laneColor: colors.laneColor,
        details: {
          semantics: domainConfig?.semantic_sequence || domainConfig?.category_sequence || [],
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

    // Group rules by semantic sequence and layout horizontally within the lane
    const semantics = domainConfig?.semantic_sequence || domainConfig?.category_sequence || [];
    const semanticsWithRules = semantics.filter((semantic) =>
      domainRules.some((r) => inferSemanticKey(r) === semantic)
    );
    
    if (semanticsWithRules.length === 0) return;
    
    // Calculate horizontal spacing for semantic groups within the lane
    const availableWidth = laneWidth - 60;
    const semanticSpacing = semanticsWithRules.length > 1 
      ? availableWidth / (semanticsWithRules.length - 1)
      : 0;
    
    semanticsWithRules.forEach((semanticKey, semanticIndex) => {
      const semanticRules = domainRules.filter((r) => inferSemanticKey(r) === semanticKey);
      
      if (semanticRules.length === 0) return;
      
      // Calculate semantic group X position - spread horizontally within lane
      const semanticOffset = semanticsWithRules.length > 1
        ? (semanticIndex - (semanticsWithRules.length - 1) / 2) * Math.min(semanticSpacing, 140)
        : 0;
      const categoryX = laneCenterX + semanticOffset;
      
      const categoryId = generateNodeId(`cat_${domainKey}`, semanticKey);
      const colorClass =
        SEMANTIC_COLORS[semanticKey] ||
        CATEGORY_COLORS[semanticKey] ||
        'bg-gray-50 border-gray-400 text-gray-700';
      
      // Add semantic group node
      const categoryNode: RulesetFlowNode = {
        id: categoryId,
        type: 'category',
        position: { x: categoryX, y: categoryY },
        data: {
          label: SEMANTIC_LABELS[semanticKey] || semanticKey,
          description: `${semanticRules.length} 条规则`,
          category: semanticKey,
          domain: domainKey,
          count: semanticRules.length,
          colorClass,
          laneColor: colors.laneColor,
          details: {
            rules: semanticRules.map((r) => ({
              id: r.rule_id,
              name: r.rule_name,
              status: r.status,
            })),
          },
        },
      };
      nodes.push(categoryNode);
      
      // Connect domain to category with direct line
      edges.push({
        id: `${domainId}->${categoryId}`,
        source: domainId,
        target: categoryId,
        type: 'default',
        style: { stroke: colors.edgeColor, strokeWidth: 2, opacity: 0.6 },
      });
      
      // Add rules under this semantic group - vertically stacked with slight horizontal offset
      let ruleY = ruleStartY;
      semanticRules.forEach((rule, ruleIndex) => {
        const ruleId = generateNodeId('rule', rule.rule_id);
        const conditionCount = countConditionNodes(rule.conditions);
        
        // Slight horizontal offset for each rule to reduce edge overlap
        const ruleOffsetX = (ruleIndex % 2 === 0 ? -20 : 20);
        const ruleX = categoryX + ruleOffsetX;
        
        const ruleNode: RulesetFlowNode = {
          id: ruleId,
          type: 'rule',
          position: { x: ruleX, y: ruleY },
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
        
        // Simple straight line connection
        edges.push({
          id: `${categoryId}->${ruleId}`,
          source: categoryId,
          target: ruleId,
          type: 'default',
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
        });
        
        ruleY += nodeHeight + ruleGap;
      });
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
