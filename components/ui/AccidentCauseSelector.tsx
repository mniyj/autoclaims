import React, { useState, useEffect } from 'react';
import { type AccidentCauseMaterialConfig } from '../../types';
import { api } from '../../services/api';

interface AccidentCauseSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const AccidentCauseSelector: React.FC<AccidentCauseSelectorProps> = ({
  value,
  onChange,
  placeholder = '请选择事故原因',
  required = false,
  className = '',
}) => {
  const [accidentCauses, setAccidentCauses] = useState<AccidentCauseMaterialConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAccidentCauses = async () => {
      try {
        const data = await api.accidentCauseConfigs.list() as AccidentCauseMaterialConfig[];
        setAccidentCauses(data || []);
      } catch (error) {
        console.error('Failed to fetch accident causes:', error);
        setAccidentCauses([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAccidentCauses();
  }, []);

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <select
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
        >
          <option>加载中...</option>
        </select>
      </div>
    );
  }

  if (accidentCauses.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <select
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
        >
          <option>暂无事故原因配置</option>
        </select>
        <div className="mt-1 text-xs text-amber-600">
          请先在「理赔项目及材料配置」→「事故原因及索赔材料关联」中添加事故原因
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="">{placeholder}</option>
        {accidentCauses.map((cause) => (
          <option key={cause.id} value={cause.id}>
            {cause.name}
            {cause.description && ` - ${cause.description}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AccidentCauseSelector;
