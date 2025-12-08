
import React, { useState, useEffect } from 'react';

const SmartAdvisorConfigPage: React.FC = () => {
    const [config, setConfig] = useState({
        ciMonths: 36,
        ciBaseCost: 0,
        accMonths: 36
    });

    useEffect(() => {
        const saved = localStorage.getItem('smart_advisor_config');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved config', e);
            }
        }
    }, []);

    const handleChange = (field: string, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        localStorage.setItem('smart_advisor_config', JSON.stringify(config));
        alert('配置已保存并更新！');
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[600px] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
                 <h2 className="text-lg font-bold text-gray-800">智能保顾配置页面</h2>
            </div>
            <div className="p-10 flex-1">
                <div className="space-y-12">
                    {/* Section 1 */}
                    <div className="flex">
                        <div className="w-24 pt-2 font-bold text-gray-700 text-base">重疾险</div>
                        <div className="flex-1 flex gap-20">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">重疾险补偿周期</label>
                                <div className="flex items-center rounded-sm bg-gray-50 overflow-hidden w-56 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                                    <input
                                        type="number"
                                        value={config.ciMonths}
                                        onChange={(e) => handleChange('ciMonths', e.target.value)}
                                        className="block w-full border-none px-3 py-2 text-gray-900 focus:ring-0 bg-gray-50 sm:text-sm"
                                    />
                                    <div className="flex-shrink-0 bg-gray-100 px-3 py-2 text-gray-500 text-sm border-l border-white font-medium">
                                        个月
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">重疾险基础治疗费用</label>
                                <div className="flex items-center rounded-sm bg-gray-50 overflow-hidden w-56 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                                    <input
                                        type="number"
                                        value={config.ciBaseCost}
                                        onChange={(e) => handleChange('ciBaseCost', e.target.value)}
                                        className="block w-full border-none px-3 py-2 text-gray-900 focus:ring-0 bg-gray-50 sm:text-sm"
                                    />
                                    <div className="flex-shrink-0 bg-gray-100 px-3 py-2 text-gray-500 text-sm border-l border-white font-medium">
                                        万元
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                     <div className="flex">
                        <div className="w-24 pt-2 font-bold text-gray-700 text-base">意外险</div>
                        <div className="flex-1 flex gap-20">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">意外险补偿周期</label>
                                <div className="flex items-center rounded-sm bg-gray-50 overflow-hidden w-56 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                                    <input
                                        type="number"
                                        value={config.accMonths}
                                        onChange={(e) => handleChange('accMonths', e.target.value)}
                                        className="block w-full border-none px-3 py-2 text-gray-900 focus:ring-0 bg-gray-50 sm:text-sm"
                                    />
                                    <div className="flex-shrink-0 bg-gray-100 px-3 py-2 text-gray-500 text-sm border-l border-white font-medium">
                                        个月
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
             <div className="px-10 py-8 flex justify-end border-t border-gray-100">
                <button
                    onClick={handleSave}
                    className="px-12 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all text-sm"
                >
                    保存
                </button>
            </div>
        </div>
    );
};

export default SmartAdvisorConfigPage;
