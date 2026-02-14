import React, { useState, useEffect } from 'react';
import { type InsuranceRuleset } from '../types';
import RulesetListView from './ruleset/RulesetListView';
import RulesetDetailView from './ruleset/RulesetDetailView';
import ImportRulesetModal from './ruleset/ImportRulesetModal';
import { api } from '../services/api';

const RulesetManagementPage: React.FC = () => {
  const [rulesets, setRulesets] = useState<InsuranceRuleset[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [selectedRuleset, setSelectedRuleset] = useState<InsuranceRuleset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRulesets = async () => {
      try {
        const data = await api.rulesets.list();
        setRulesets(data as InsuranceRuleset[]);
      } catch (error) {
        console.error('Failed to fetch rulesets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRulesets();
  }, []);

  const handleSelectRuleset = (ruleset: InsuranceRuleset) => {
    setSelectedRuleset(ruleset);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedRuleset(null);
  };

  const handleImport = async (ruleset: InsuranceRuleset) => {
    // Check for duplicate ruleset_id
    const existing = rulesets.find(r => r.ruleset_id === ruleset.ruleset_id);
    let newRulesets: InsuranceRuleset[];
    if (existing) {
      if (!confirm(`规则集 ${ruleset.ruleset_id} 已存在，是否覆盖？`)) return;
      newRulesets = rulesets.map(r => r.ruleset_id === ruleset.ruleset_id ? ruleset : r);
    } else {
      newRulesets = [...rulesets, ruleset];
    }
    try {
      await api.rulesets.saveAll(newRulesets);
      setRulesets(newRulesets);
    } catch (error) {
      console.error('Failed to import ruleset:', error);
      alert('导入失败');
    }
  };

  const handleExport = (ruleset: InsuranceRuleset) => {
    const json = JSON.stringify(ruleset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ruleset.ruleset_id}_v${ruleset.metadata.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (rulesetId: string) => {
    const newRulesets = rulesets.filter(r => r.ruleset_id !== rulesetId);
    try {
      await api.rulesets.saveAll(newRulesets);
      setRulesets(newRulesets);
    } catch (error) {
      console.error('Failed to delete ruleset:', error);
      alert('删除失败');
    }
  };

  const handleUpdateRuleset = async (updated: InsuranceRuleset) => {
    const newRulesets = rulesets.map(r => r.ruleset_id === updated.ruleset_id ? updated : r);
    try {
      await api.rulesets.saveAll(newRulesets);
      setRulesets(newRulesets);
      setSelectedRuleset(updated);
    } catch (error) {
      console.error('Failed to update ruleset:', error);
      alert('更新失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      {currentView === 'list' && (
        <RulesetListView
          rulesets={rulesets}
          onSelectRuleset={handleSelectRuleset}
          onImport={() => setIsImportModalOpen(true)}
          onExport={handleExport}
          onDelete={handleDelete}
        />
      )}

      {currentView === 'detail' && selectedRuleset && (
        <RulesetDetailView
          ruleset={selectedRuleset}
          onBack={handleBack}
          onUpdateRuleset={handleUpdateRuleset}
        />
      )}

      <ImportRulesetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
};

export default RulesetManagementPage;
