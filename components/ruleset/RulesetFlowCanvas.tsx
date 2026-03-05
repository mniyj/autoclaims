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

import type { RulesetRule } from '../../types';
import {
  ruleToFlowElements,
  type FlowNodeData,
  type RulesetFlowNode,
} from '../../utils/rulesetFlowTransformer';

import LogicGateNode from './flow/LogicGateNode';
import ConditionNode from './flow/ConditionNode';
import ActionNode from './flow/ActionNode';

const nodeTypes = {
  logicGate: LogicGateNode,
  condition: ConditionNode,
  action: ActionNode,
};

interface RulesetFlowCanvasProps {
  rule: RulesetRule;
  onNodeClick?: (node: RulesetFlowNode) => void;
  className?: string;
}

export default function RulesetFlowCanvas({
  rule,
  onNodeClick,
  className = '',
}: RulesetFlowCanvasProps) {
  // Transform rule to flow elements
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!rule?.conditions) {
      return { initialNodes: [], initialEdges: [] };
    }
    const result = ruleToFlowElements(rule);
    return {
      initialNodes: result.nodes,
      initialEdges: result.edges,
    };
  }, [rule]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FlowNodeData>) => {
      if (onNodeClick) {
        onNodeClick(node as RulesetFlowNode);
      }
    },
    [onNodeClick]
  );

  // Show empty state if no conditions
  if (!rule?.conditions || initialNodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}
        style={{ minHeight: '400px' }}
      >
        <div className="text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">暂无规则条件</p>
          <p className="text-sm mt-1">该规则未配置条件</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div style={{ height: '600px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          minZoom={0.1}
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
          <Panel position="top-left" className="bg-white/80 p-2 rounded-lg shadow-sm">
            <div className="text-xs text-gray-600 space-y-1">
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
            </div>
          </Panel>
          <Panel position="top-right" className="bg-white/80 px-3 py-2 rounded-lg shadow-sm">
            <div className="text-xs text-gray-600">
              <span className="font-medium">{rule.rule_name}</span>
              <span className="mx-2">·</span>
              <span>{nodes.length} 个节点</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
