import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface CalculationVariable {
  source: string;
  type: string;
  label: string;
  value?: any;
}

interface CalculationStep {
  name: string;
  expr: string;
  output: string;
}

interface CalculationFormula {
  code: string;
  description: string;
  insuranceType: string;
  formula: string;
  variables: Record<string, CalculationVariable>;
  steps?: CalculationStep[];
  output: {
    field: string;
    type: string;
    label: string;
  };
}

const FormulaManagementPage: React.FC = () => {
  const [formulas, setFormulas] = useState<CalculationFormula[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'test'>('list');
  const [selectedFormula, setSelectedFormula] = useState<CalculationFormula | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [testParams, setTestParams] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchFormulas = async () => {
      try {
        const data = await api.formulas.list();
        setFormulas(data);
      } catch (error) {
        console.error('Failed to fetch formulas:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFormulas();
  }, []);

  const handleSelectFormula = (formula: CalculationFormula) => {
    setSelectedFormula(formula);
    setCurrentView('detail');
    // 初始化测试参数
    const params: Record<string, any> = {};
    for (const [name, def] of Object.entries(formula.variables)) {
      if (def.type === 'number') {
        params[name] = 10000; // 默认测试值
      } else if (name.includes('grade')) {
        params[name] = '7';
      } else {
        params[name] = '示例值';
      }
    }
    setTestParams(params);
    setTestResult(null);
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedFormula(null);
    setTestResult(null);
  };

  const handleTestFormula = async () => {
    if (!selectedFormula) return;

    setLoading(true);
    try {
      const result = await api.formulas.calculate(selectedFormula.code, testParams);
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test formula:', error);
      alert('测试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportFormula = () => {
    if (!selectedFormula) return;

    const json = JSON.stringify(selectedFormula, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFormula.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const json = JSON.stringify(formulas, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calculation-formulas.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const insuranceTypeColors = {
    'ACCIDENT': 'bg-blue-100 text-blue-800',
    'HEALTH': 'bg-green-100 text-green-800',
    'AUTO': 'bg-orange-100 text-orange-800',
  };

  const insuranceTypeLabels = {
    'ACCIDENT': '意外险',
    'HEALTH': '健康险',
    'AUTO': '车险',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 列表视图 */}
      {currentView === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">理算公式配置</h2>
            <button
              onClick={handleExportAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              导出全部
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {formulas.map((formula) => (
                <div
                  key={formula.code}
                  onClick={() => handleSelectFormula(formula)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${insuranceTypeColors[formula.insuranceType] || 'bg-gray-100 text-gray-800'}`}>
                      {insuranceTypeLabels[formula.insuranceType] || formula.insuranceType}
                    </span>
                    <span className="text-xs text-gray-500">{formula.code}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{formula.description}</h3>
                  <p className="text-sm text-gray-600 mb-2 font-mono bg-gray-50 p-2 rounded">
                    {formula.formula}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(formula.variables).slice(0, 3).map((key) => (
                      <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {formula.variables[key].label}
                      </span>
                    ))}
                    {Object.keys(formula.variables).length > 3 && (
                      <span className="text-xs text-gray-500">+{Object.keys(formula.variables).length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 详情视图 */}
      {currentView === 'detail' && selectedFormula && (
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              ← 返回
            </button>
            <button
              onClick={handleExportFormula}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              导出
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">{selectedFormula.description}</h3>
              <div className="flex items-center space-x-3 mb-4">
                <span className={`px-3 py-1 rounded text-sm font-medium ${insuranceTypeColors[selectedFormula.insuranceType]}`}>
                  {insuranceTypeLabels[selectedFormula.insuranceType]}
                </span>
                <span className="text-gray-500">|</span>
                <span className="font-mono text-sm">{selectedFormula.code}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600 mb-1">公式表达式</p>
                <code className="text-lg font-mono text-gray-800">{selectedFormula.formula}</code>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">变量定义</h4>
                <div className="space-y-2">
                  {Object.entries(selectedFormula.variables).map(([name, def]) => (
                    <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{def.label}</div>
                        <div className="text-xs text-gray-500 font-mono">{name}</div>
                      </div>
                      <div className="text-xs text-gray-500">{def.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">计算步骤</h4>
                {selectedFormula.steps && selectedFormula.steps.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFormula.steps.map((step, idx) => (
                      <div key={idx} className="p-2 bg-blue-50 rounded">
                        <div className="text-sm font-medium text-blue-800">{step.name}</div>
                        <div className="text-xs text-blue-600 font-mono mt-1">{step.expr}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">无分步计算，直接执行公式</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 测试视图 */}
      {currentView === 'detail' && selectedFormula && (
        <div className="mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">公式测试</h4>
            <div className="space-y-4">
              {Object.entries(selectedFormula.variables).map(([name, def]) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{def.label}</label>
                  <input
                    type={def.type === 'number' ? 'number' : 'text'}
                    value={testParams[name] || ''}
                    onChange={(e) => setTestParams({ ...testParams, [name]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleTestFormula}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {loading ? '计算中...' : '计算'}
                </button>
              </div>

              {testResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">计算结果</h5>
                  <div className="text-2xl font-bold text-green-600">¥{testResult.finalAmount?.toLocaleString() || '0'}</div>
                  {testResult.steps && testResult.steps.length > 0 && (
                    <div className="mt-3 text-sm">
                      <div className="font-medium text-gray-700 mb-1">计算步骤</div>
                      {testResult.steps.map((step: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">{step.name}: {step.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaManagementPage;
