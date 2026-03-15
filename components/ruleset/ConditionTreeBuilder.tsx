import React from 'react';
import { type RuleConditions, type LeafCondition, type GroupCondition, type FieldDefinition, ConditionLogic, ConditionOperator, ExecutionDomain } from '../../types';
import { FIELD_SOURCE_TYPE_LABELS, OPERATOR_LABELS } from '../../constants';

interface ConditionTreeBuilderProps {
  conditions: RuleConditions;
  onChange: (conditions: RuleConditions) => void;
  fieldDictionary: Record<string, FieldDefinition>;
  currentDomain: ExecutionDomain;
  readOnly?: boolean;
}

function isGroupCondition(expr: LeafCondition | GroupCondition): expr is GroupCondition {
  return 'logic' in expr && 'expressions' in expr && !('field' in expr);
}

const LOGIC_COLORS: Record<string, string> = {
  AND: 'bg-blue-100 text-blue-700 border-blue-300',
  OR: 'bg-green-100 text-green-700 border-green-300',
  NOT: 'bg-red-100 text-red-700 border-red-300',
};

const LeafConditionRow: React.FC<{
  condition: LeafCondition;
  fieldDictionary: Record<string, FieldDefinition>;
  currentDomain: ExecutionDomain;
  onChange: (updated: LeafCondition) => void;
  onRemove: () => void;
  readOnly?: boolean;
}> = ({ condition, fieldDictionary, currentDomain, onChange, onRemove, readOnly }) => {
  const availableFields = (Object.entries(fieldDictionary) as [string, FieldDefinition][]).filter(
    ([, def]) => def.applicable_domains.includes(currentDomain)
  );
  const selectedField: FieldDefinition | undefined = fieldDictionary[condition.field];

  return (
    <div className="flex items-center space-x-2 py-1.5">
      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        disabled={readOnly}
        className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[160px] disabled:bg-gray-100"
      >
        <option value="">选择字段</option>
        {availableFields.map(([key, def]) => (
          <option key={key} value={key}>
            {def.label} ({key}){def.source_type ? ` · ${FIELD_SOURCE_TYPE_LABELS[def.source_type] || def.source_type}` : ''}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
        disabled={readOnly}
        className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[100px] disabled:bg-gray-100"
      >
        {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
          <option key={op} value={op}>{label}</option>
        ))}
      </select>

      {/* Value input */}
      {!['IS_NULL', 'IS_NOT_NULL', 'IS_TRUE', 'IS_FALSE'].includes(condition.operator) && (
        <>
          {selectedField?.data_type === 'ENUM' && selectedField.enum_values ? (
            <select
              value={String(condition.value ?? '')}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              disabled={readOnly}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[120px] disabled:bg-gray-100"
            >
              <option value="">选择值</option>
              {selectedField.enum_values.map((ev) => (
                <option key={ev.code} value={ev.code}>{ev.label}</option>
              ))}
            </select>
          ) : selectedField?.data_type === 'BOOLEAN' ? (
            <select
              value={String(condition.value ?? '')}
              onChange={(e) => onChange({ ...condition, value: e.target.value === 'true' })}
              disabled={readOnly}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[80px] disabled:bg-gray-100"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={selectedField?.data_type === 'NUMBER' ? 'number' : 'text'}
              value={String(condition.value ?? '')}
              onChange={(e) => {
                const val = selectedField?.data_type === 'NUMBER' ? Number(e.target.value) : e.target.value;
                onChange({ ...condition, value: val });
              }}
              disabled={readOnly}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[120px] disabled:bg-gray-100"
              placeholder="输入值"
            />
          )}
          {condition.value_unit && (
            <span className="text-xs text-gray-400">{condition.value_unit}</span>
          )}
        </>
      )}

      {!readOnly && (
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 shrink-0" title="删除条件">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
};

const GroupConditionNode: React.FC<{
  group: GroupCondition;
  fieldDictionary: Record<string, FieldDefinition>;
  currentDomain: ExecutionDomain;
  onChange: (updated: GroupCondition) => void;
  onRemove: () => void;
  depth: number;
  readOnly?: boolean;
}> = ({ group, fieldDictionary, currentDomain, onChange, onRemove, depth, readOnly }) => {
  const colorClass = LOGIC_COLORS[group.logic] || 'bg-gray-100 text-gray-700 border-gray-300';

  const updateExpression = (idx: number, updated: LeafCondition | GroupCondition) => {
    const newExpressions = [...group.expressions];
    newExpressions[idx] = updated;
    onChange({ ...group, expressions: newExpressions });
  };

  const removeExpression = (idx: number) => {
    const newExpressions = group.expressions.filter((_, i) => i !== idx);
    onChange({ ...group, expressions: newExpressions });
  };

  const addLeaf = () => {
    const newLeaf: LeafCondition = { field: '', operator: ConditionOperator.EQ, value: '' };
    onChange({ ...group, expressions: [...group.expressions, newLeaf] });
  };

  const addGroup = (logic: 'AND' | 'OR' | 'NOT') => {
    const newGroup: GroupCondition = { logic, expressions: [] };
    onChange({ ...group, expressions: [...group.expressions, newGroup] });
  };

  return (
    <div className={`border rounded-lg p-3 ${depth > 0 ? 'ml-4' : ''} ${depth === 0 ? 'border-gray-200' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {readOnly ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>{group.logic}</span>
          ) : (
            <select
              value={group.logic}
              onChange={(e) => onChange({ ...group, logic: e.target.value as 'AND' | 'OR' | 'NOT' })}
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
              <option value="NOT">NOT</option>
            </select>
          )}
          <span className="text-xs text-gray-400">{group.expressions.length} 个条件</span>
        </div>
        {!readOnly && depth > 0 && (
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500" title="删除分组">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="space-y-1">
        {group.expressions.map((expr, idx) => (
          <div key={idx}>
            {isGroupCondition(expr) ? (
              <GroupConditionNode
                group={expr}
                fieldDictionary={fieldDictionary}
                currentDomain={currentDomain}
                onChange={(updated) => updateExpression(idx, updated)}
                onRemove={() => removeExpression(idx)}
                depth={depth + 1}
                readOnly={readOnly}
              />
            ) : (
              <LeafConditionRow
                condition={expr}
                fieldDictionary={fieldDictionary}
                currentDomain={currentDomain}
                onChange={(updated) => updateExpression(idx, updated)}
                onRemove={() => removeExpression(idx)}
                readOnly={readOnly}
              />
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-100">
          <button onClick={addLeaf} className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            添加条件
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={() => addGroup('AND')} className="text-xs text-blue-600 hover:text-blue-800">+ AND 组</button>
          <button onClick={() => addGroup('OR')} className="text-xs text-green-600 hover:text-green-800">+ OR 组</button>
          <button onClick={() => addGroup('NOT')} className="text-xs text-red-600 hover:text-red-800">+ NOT 组</button>
        </div>
      )}
    </div>
  );
};

const ConditionTreeBuilder: React.FC<ConditionTreeBuilderProps> = ({ conditions, onChange, fieldDictionary, currentDomain, readOnly }) => {
  if (conditions.logic === ConditionLogic.ALWAYS_TRUE) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-700 font-medium">始终触发 (ALWAYS_TRUE)</span>
        {!readOnly && (
          <button
            onClick={() => onChange({ logic: ConditionLogic.AND, expressions: [] })}
            className="ml-3 text-xs text-blue-600 hover:underline"
          >
            切换为条件模式
          </button>
        )}
      </div>
    );
  }

  const rootGroup: GroupCondition = {
    logic: conditions.logic as 'AND' | 'OR' | 'NOT',
    expressions: conditions.expressions,
  };

  return (
    <div>
      {!readOnly && (
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => onChange({ logic: ConditionLogic.ALWAYS_TRUE, expressions: [] })}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            切换为始终触发
          </button>
        </div>
      )}
      <GroupConditionNode
        group={rootGroup}
        fieldDictionary={fieldDictionary}
        currentDomain={currentDomain}
        onChange={(updated) => onChange({ logic: updated.logic as ConditionLogic, expressions: updated.expressions })}
        onRemove={() => {}}
        depth={0}
        readOnly={readOnly}
      />
    </div>
  );
};

export default ConditionTreeBuilder;
