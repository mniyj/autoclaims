import React, { useState, useEffect } from "react";

const SmartAdvisorConfigPage: React.FC = () => {
  const [config, setConfig] = useState({
    ciMonths: 36,
    ciBaseCost: 0,
    accMonths: 36,
    tlTransitionMonths: 60,
    comfortableNursingCost: 5000,
    comfortableEntertainmentCost: 1000,
    highEndNursingCostMultiplier: 5,
    highEndEntertainmentCostMultiplier: 12,
    financialPlanningRate: 2.5,
  });

  useEffect(() => {
    const saved = localStorage.getItem("smart_advisor_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
  }, []);

  const handleChange = (field: string, value: string) => {
    const num = Number(value);
    setConfig((prev) => ({ ...prev, [field]: isNaN(num) ? value : num }));
  };

  const handleSave = () => {
    localStorage.setItem("smart_advisor_config", JSON.stringify(config));
    alert("配置已保存并更新！");
  };

  const renderInputGroup = (
    label: string,
    value: number,
    field: string,
    unit: string,
    step?: number,
    decimals?: number,
  ) => {
    const displayValue =
      decimals !== undefined ? value.toFixed(decimals) : value;
    return (
      <div className="flex flex-col">
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          {label}
        </label>
        <div className="flex items-center rounded-md bg-white overflow-hidden w-full max-w-xs border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-sm hover:border-gray-400">
          <input
            type="number"
            value={displayValue}
            step={step}
            onChange={(e) => handleChange(field, e.target.value)}
            className="block w-full border-none px-4 py-2.5 text-gray-900 focus:ring-0 bg-transparent sm:text-sm"
          />
          <div className="flex-shrink-0 bg-gray-50 px-4 py-2.5 text-gray-500 text-sm border-l border-gray-200 font-medium min-w-[4rem] text-center">
            {unit}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px] flex flex-col">
      <div className="px-8 py-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">智能保顾配置</h2>
        <p className="text-sm text-gray-500 mt-1">
          调整各项保险产品的计算参数与默认值
        </p>
      </div>

      <div className="p-10 flex-1 overflow-y-auto">
        <div className="space-y-10 max-w-5xl">
          {/* Section 1: Critical Illness */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-32 pt-1 font-bold text-gray-800 text-lg shrink-0">
              重疾险
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {renderInputGroup(
                "重疾险补偿周期",
                config.ciMonths,
                "ciMonths",
                "个月",
              )}
              {renderInputGroup(
                "重疾险基础治疗费用",
                config.ciBaseCost,
                "ciBaseCost",
                "万元",
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 2: Accident */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-32 pt-1 font-bold text-gray-800 text-lg shrink-0">
              意外险
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {renderInputGroup(
                "意外险补偿周期",
                config.accMonths,
                "accMonths",
                "个月",
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 3: Term Life */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-32 pt-1 font-bold text-gray-800 text-lg shrink-0">
              定期寿险
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {renderInputGroup(
                "生活过渡期",
                config.tlTransitionMonths,
                "tlTransitionMonths",
                "个月",
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 4: Pension */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-32 pt-1 font-bold text-gray-800 text-lg shrink-0">
              养老金
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {renderInputGroup(
                "舒适养老护理费",
                config.comfortableNursingCost,
                "comfortableNursingCost",
                "元/月",
              )}
              {renderInputGroup(
                "舒适养老娱乐费",
                config.comfortableEntertainmentCost,
                "comfortableEntertainmentCost",
                "元/月",
              )}
              {renderInputGroup(
                "高端养老护理费加成系数",
                config.highEndNursingCostMultiplier,
                "highEndNursingCostMultiplier",
                "倍",
              )}
              {renderInputGroup(
                "高端养老娱乐费加成系数",
                config.highEndEntertainmentCostMultiplier,
                "highEndEntertainmentCostMultiplier",
                "倍",
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 5: Financial Planning */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-32 pt-1 font-bold text-gray-800 text-lg shrink-0">
              财务规划
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {renderInputGroup(
                "预定利益默认值",
                config.financialPlanningRate,
                "financialPlanningRate",
                "%",
                0.01,
                2,
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-10 py-6 flex justify-end border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <button
          onClick={handleSave}
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all text-sm tracking-wide"
        >
          保存配置
        </button>
      </div>
    </div>
  );
};

export default SmartAdvisorConfigPage;
