import React, { useState } from 'react';
import DrugManagementPage from './DrugManagementPage';
import ServiceItemManagementPage from './ServiceItemManagementPage';
import DiseaseManagementPage from './DiseaseManagementPage';
import AliasMappingPage from './AliasMappingPage';
import RuleManagementPage from './RuleManagementPage';
import RelationshipManagementPage from './RelationshipManagementPage';
import VersionManagementPage from './VersionManagementPage';

const KnowledgeManagementPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('drugs');

  const tabs = [
    { id: 'drugs', label: '药品管理', icon: '💊' },
    { id: 'services', label: '诊疗项目管理', icon: '🩺' },
    { id: 'diseases', label: '疾病管理', icon: '🏥' },
    { id: 'aliases', label: '别名映射', icon: '🔗' },
    { id: 'rules', label: '规则管理', icon: '📋' },
    { id: 'relationships', label: '关系管理', icon: '🕸️' },
    { id: 'versions', label: '版本管理', icon: '📚' },
  ];

  const renderContent = () => {
    switch (currentTab) {
      case 'drugs':
        return <DrugManagementPage />;
      case 'services':
        return <ServiceItemManagementPage />;
      case 'diseases':
        return <DiseaseManagementPage />;
      case 'aliases':
        return <AliasMappingPage />;
      case 'rules':
        return <RuleManagementPage />;
      case 'relationships':
        return <RelationshipManagementPage />;
      case 'versions':
        return <VersionManagementPage />;
      default:
        return <div className="p-8 text-center text-gray-500">请选择管理模块</div>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">知识库管理中心</h1>
        <p className="text-gray-600">管理医疗知识库主数据、规则和关系图谱</p>
      </div>

      <div className="flex gap-4 border-b mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
              currentTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  );
};









export default KnowledgeManagementPage;
