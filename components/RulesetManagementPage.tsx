import React, { useState } from 'react';
import { type InsuranceRuleset } from '../types';
import { MOCK_RULESETS } from '../constants';
import RulesetListView from './ruleset/RulesetListView';
import RulesetDetailView from './ruleset/RulesetDetailView';
import ImportRulesetModal from './ruleset/ImportRulesetModal';

const RulesetManagementPage: React.FC = () => {
  const [rulesets, setRulesets] = useState<InsuranceRuleset[]>(MOCK_RULESETS);
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [selectedRuleset, setSelectedRuleset] = useState<InsuranceRuleset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleSelectRuleset = (ruleset: InsuranceRuleset) => {
    setSelectedRuleset(ruleset);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedRuleset(null);
  };

  const handleImport = (ruleset: InsuranceRuleset) => {
    // Check for duplicate ruleset_id
    const existing = rulesets.find(r => r.ruleset_id === ruleset.ruleset_id);
    if (existing) {
      if (!confirm(`规则集 ${ruleset.ruleset_id} 已存在，是否覆盖？`)) return;
      setRulesets(prev => prev.map(r => r.ruleset_id === ruleset.ruleset_id ? ruleset : r));
    } else {
      setRulesets(prev => [...prev, ruleset]);
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

  const handleDelete = (rulesetId: string) => {
    setRulesets(prev => prev.filter(r => r.ruleset_id !== rulesetId));
  };

  const handleUpdateRuleset = (updated: InsuranceRuleset) => {
    setRulesets(prev => prev.map(r => r.ruleset_id === updated.ruleset_id ? updated : r));
    setSelectedRuleset(updated);
  };

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
