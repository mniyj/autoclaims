import React, { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { InsuranceRuleset, RulesetRule } from '../../types';
import {
  rulesetToFlowElements,
  ruleToDetailedFlowElements,
  type FlowNodeData,
  type RulesetFlowNode,
} from '../../utils/rulesetFlowTransformer';

import LogicGateNode from './flow/LogicGateNode';
import ConditionNode from './flow/ConditionNode';
import ActionNode from './flow/ActionNode';
import RulesetStartNode from './flow/RulesetStartNode';
import ExecutionDomainNode from './flow/ExecutionDomainNode';
import CategoryNode from './flow/CategoryNode';
import RuleNode from './flow/RuleNode';

const nodeTypes = {
  logicGate: LogicGateNode,
  condition: ConditionNode,
  action: ActionNode,
  rulesetStart: RulesetStartNode,
  executionDomain: ExecutionDomainNode,
  category: CategoryNode,
  rule: RuleNode,
};

interface RulesetFlowCanvasProps {
  ruleset: InsuranceRuleset;
  onNodeClick?: (node: RulesetFlowNode) => void;
  onRuleDoubleClick?: (rule: RulesetRule) => void;
  className?: string;
}

export default function RulesetFlowCanvas({
  ruleset,
  onNodeClick,
  onRuleDoubleClick,
  className = '',
}: RulesetFlowCanvasProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
  const [selectedRule, setSelectedRule] = useState<RulesetRule | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (viewMode === 'detail' && selectedRule) {
      return ruleToDetailedFlowElements(selectedRule);
    }
    return rulesetToFlowElements(ruleset);
  }, [ruleset, viewMode, selectedRule]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FlowNodeData>) => {
      if (onNodeClick) {
        onNodeClick(node as RulesetFlowNode);
      }
    },
    [onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<FlowNodeData>) => {
      if (node.type === 'rule' && node.data.ruleId) {
        const rule = ruleset.rules.find((r) => r.rule_id === node.data.ruleId);
        if (rule) {
          setSelectedRule(rule);
          setViewMode('detail');
          if (onRuleDoubleClick) {
            onRuleDoubleClick(rule);
          }
        }
      }
    },
    [ruleset.rules, onRuleDoubleClick]
  );

  const handleBackToOverview = useCallback(() => {
    setViewMode('overview');
    setSelectedRule(null);
  }, []);

  if (!ruleset?.rules?.length) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}
        style={{ minHeight: '400px' }}
      >
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">暂无规则</p>
          <p className="text-sm mt-1">该规则集未配置任何规则</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div style={{ height: '700px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          attributionPosition="bottom-left"
          minZoom={0.05}
          maxZoom={2}
        >
          <Background color="#e5e7eb" gap={16} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-white border border-gray-200 rounded-lg shadow-md"
          />
          
          {/* View mode toggle */}
          {viewMode === 'detail' && (
            <Panel position="top-center" className="bg-white/90 px-4 py-2 rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">
                  规则详情: {selectedRule?.rule_name}
                </span>
                <button
                  onClick={handleBackToOverview}
                  className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
                >
                  ← 返回概览
                </button>
              </div>
            </Panel>
          )}
          
          {/* Legend */}
          <Panel position="top-left" className="bg-white/90 p-3 rounded-lg shadow-md border border-gray-200">
            <div className="text-xs text-gray-700 space-y-2">
              <p className="font-medium mb-2">图例</p>
              {viewMode === 'overview' ? (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-indigo-100 border border-indigo-500 rounded" />
                    <span>规则集</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-500 rounded" />
                    <span>定责域</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-500 rounded" />
                    <span>定损域</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-100 border border-purple-500 rounded" />
                    <span>后处理域</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-cyan-50 border border-cyan-400 rounded" />
                    <span>类别</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-50 border border-green-300 rounded" />
                    <span>规则（双击展开）</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-100 border border-yellow-500 transform rotate-45" />
                    <span>逻辑门 (AND/OR/NOT)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-white border border-blue-400 rounded" />
                    <span>条件</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-500 rounded-full" />
                    <span>动作</span>
                  </div>
                </>
              )}
            </div>
          </Panel>
          
          {/* Stats */}
          <Panel position="top-right" className="bg-white/90 px-4 py-3 rounded-lg shadow-md border border-gray-200">
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{ruleset.policy_info.product_name}</p>
              <p>版本: {ruleset.metadata.version}</p>
              <p>共 {ruleset.rules.length} 条规则</p>
              {viewMode === 'overview' && (
                <p className="text-indigo-600">双击规则查看详情</p>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
