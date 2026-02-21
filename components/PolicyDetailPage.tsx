import React, { useState, useEffect } from 'react';
import { type InsurancePolicy, type SpecialAgreement, type DeductionRule, type PolicySchedule, PolicyStatus } from '../types';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import { api } from '../services/api';

interface PolicyDetailPageProps {
  policy?: InsurancePolicy;
  onBack: () => void;
  onSave: (policy: InsurancePolicy) => void;
}

type PolicyTab = 'basic' | 'clauses' | 'agreements' | 'deductions' | 'schedule' | 'claims';

const PolicyDetailPage: React.FC<PolicyDetailPageProps> = ({ policy, onBack, onSave }) => {
  const [isEditing, setIsEditing] = useState(!policy);
  const [activeTab, setActiveTab] = useState<PolicyTab>('basic');

  const [policyNumber] = useState(policy?.policyNumber || `POL${Date.now()}`);
  const [status, setStatus] = useState<PolicyStatus>(policy?.status || PolicyStatus.DRAFT);
  const [productCode, setProductCode] = useState(policy?.productCode || '');
  const [productName, setProductName] = useState(policy?.productName || '');
  const [companyName, setCompanyName] = useState(policy?.companyName || '');

  // 当事人信息
  const [policyholder, setPolicyholder] = useState(policy?.policyholder || {
    name: '',
    idType: '身份证',
    idNumber: '',
    gender: '男',
    birthDate: '',
    phone: '',
    email: '',
    address: ''
  });
  const [insureds, setInsureds] = useState(policy?.insureds || []);

  // 条款配置
  const [mainClause, setMainClause] = useState(policy?.mainClause || {
    clauseCode: '',
    clauseName: '',
    clauseType: '主险',
    sumInsured: 0,
    premium: 0,
    paymentFrequency: '年缴'
  });
  const [riderClauses, setRiderClauses] = useState(policy?.riderClauses || []);

  // 特别约定
  const [specialAgreements, setSpecialAgreements] = useState<SpecialAgreement[]>(policy?.specialAgreements || []);

  // 免赔约定
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>(policy?.deductionRules || []);

  // 保单明细表
  const [schedule, setSchedule] = useState<PolicySchedule | undefined>(policy?.schedule);

  // 日期信息
  const [effectiveDate, setEffectiveDate] = useState(policy?.effectiveDate || '');
  const [expiryDate, setExpiryDate] = useState(policy?.expiryDate || '');
  const [issueDate, setIssueDate] = useState(policy?.issueDate || '');
  const [paymentDueDate, setPaymentDueDate] = useState(policy?.paymentDueDate || '');

  // 金额信息
  const [totalPremium, setTotalPremium] = useState(policy?.totalPremium || 0);
  const [paymentFrequency, setPaymentFrequency] = useState(policy?.paymentFrequency || '年缴');
  const [paidPremium, setPaidPremium] = useState(policy?.paidPremium || 0);

  // 理赔统计
  const [claimCount, setClaimCount] = useState(policy?.claimCount || 0);
  const [totalClaimAmount, setTotalClaimAmount] = useState(policy?.totalClaimAmount || 0);

  // 备注
  const [notes, setNotes] = useState(policy?.notes || '');

  // Modal states
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<SpecialAgreement | null>(null);
  const [editingDeduction, setEditingDeduction] = useState<DeductionRule | null>(null);

  const [tempAgreement, setTempAgreement] = useState<SpecialAgreement>({
    id: '',
    title: '',
    content: '',
    category: '扩展责任'
  });

  const [tempDeduction, setTempDeduction] = useState<DeductionRule>({
    id: '',
    name: '',
    type: '绝对免赔额',
    value: 0,
    unit: '元',
    description: '',
    applicableScope: '每次事故'
  });

  const handleSave = () => {
    const policyData: InsurancePolicy = {
      id: policy?.id || `policy-${Date.now()}`,
      policyNumber,
      quoteId: policy?.quoteId,
      quoteNumber: policy?.quoteNumber,
      status,
      productCode,
      productName,
      companyName,
      policyholder,
      insureds,
      mainClause,
      riderClauses,
      specialAgreements,
      deductionRules,
      schedule,
      effectiveDate,
      expiryDate,
      issueDate,
      paymentDueDate,
      totalPremium,
      paymentFrequency,
      paidPremium,
      claimCount,
      totalClaimAmount,
      createdAt: policy?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      operator: '当前用户',
      notes
    };
    onSave(policyData);
    setIsEditing(false);
  };

  const handleAddAgreement = () => {
    setTempAgreement({
      id: `agreement-${Date.now()}`,
      title: '',
      content: '',
      category: '扩展责任'
    });
    setEditingAgreement(null);
    setShowAgreementModal(true);
  };

  const handleEditAgreement = (agreement: SpecialAgreement) => {
    setTempAgreement({ ...agreement });
    setEditingAgreement(agreement);
    setShowAgreementModal(true);
  };

  const handleSaveAgreement = () => {
    if (editingAgreement) {
      setSpecialAgreements(specialAgreements.map(a => a.id === tempAgreement.id ? tempAgreement : a));
    } else {
      setSpecialAgreements([...specialAgreements, tempAgreement]);
    }
    setShowAgreementModal(false);
  };

  const handleDeleteAgreement = (id: string) => {
    if (window.confirm('确定要删除该特别约定吗？')) {
      setSpecialAgreements(specialAgreements.filter(a => a.id !== id));
    }
  };

  const handleAddDeduction = () => {
    setTempDeduction({
      id: `deduction-${Date.now()}`,
      name: '',
      type: '绝对免赔额',
      value: 0,
      unit: '元',
      description: '',
      applicableScope: '每次事故'
    });
    setEditingDeduction(null);
    setShowDeductionModal(true);
  };

  const handleEditDeduction = (deduction: DeductionRule) => {
    setTempDeduction({ ...deduction });
    setEditingDeduction(deduction);
    setShowDeductionModal(true);
  };

  const handleSaveDeduction = () => {
    if (editingDeduction) {
      setDeductionRules(deductionRules.map(d => d.id === tempDeduction.id ? tempDeduction : d));
    } else {
      setDeductionRules([...deductionRules, tempDeduction]);
    }
    setShowDeductionModal(false);
  };

  const handleDeleteDeduction = (id: string) => {
    if (window.confirm('确定要删除该免赔约定吗？')) {
      setDeductionRules(deductionRules.filter(d => d.id !== id));
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      const result = await api.generatePolicySchedule(policy?.id || `policy-${Date.now()}`);
      setSchedule(result.schedule);
      alert('保单明细表生成成功');
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      alert('生成失败');
    }
  };

  const tabs = [
    { id: 'basic' as PolicyTab, label: '基本信息' },
    { id: 'clauses' as PolicyTab, label: '条款配置' },
    { id: 'agreements' as PolicyTab, label: '特别约定' },
    { id: 'deductions' as PolicyTab, label: '免赔约定' },
    { id: 'schedule' as PolicyTab, label: '保单明细表' },
    { id: 'claims' as PolicyTab, label: '理赔记录' },
  ];

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="保单号" value={policyNumber} onChange={() => {}} disabled={!isEditing} />
          <Select
            label="保单状态"
            value={status}
            onChange={(value) => isEditing && setStatus(value as PolicyStatus)}
            options={Object.values(PolicyStatus).map(s => ({ label: s, value: s }))}
            disabled={!isEditing}
          />
          <Input label="产品名称" value={productName} onChange={(e) => isEditing && setProductName(e.target.value)} disabled={!isEditing} />
          <Input label="保险公司" value={companyName} onChange={(e) => isEditing && setCompanyName(e.target.value)} disabled={!isEditing} />
          <Input label="生效日期" type="date" value={effectiveDate} onChange={(e) => isEditing && setEffectiveDate(e.target.value)} disabled={!isEditing} />
          <Input label="失效日期" type="date" value={expiryDate} onChange={(e) => isEditing && setExpiryDate(e.target.value)} disabled={!isEditing} />
          <Input label="出单日期" type="date" value={issueDate} onChange={(e) => isEditing && setIssueDate(e.target.value)} disabled={!isEditing} />
          <Input label="缴费截止日期" type="date" value={paymentDueDate || ''} onChange={(e) => isEditing && setPaymentDueDate(e.target.value)} disabled={!isEditing} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">投保人信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="姓名" value={policyholder.name} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, name: e.target.value })} disabled={!isEditing} />
          <Select
            label="证件类型"
            value={policyholder.idType}
            onChange={(value) => isEditing && setPolicyholder({ ...policyholder, idType: value as any })}
            options={[{ label: '身份证', value: '身份证' }, { label: '护照', value: '护照' }, { label: '其他', value: '其他' }]}
            disabled={!isEditing}
          />
          <Input label="证件号码" value={policyholder.idNumber} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, idNumber: e.target.value })} disabled={!isEditing} />
          <Select
            label="性别"
            value={policyholder.gender}
            onChange={(value) => isEditing && setPolicyholder({ ...policyholder, gender: value as any })}
            options={[{ label: '男', value: '男' }, { label: '女', value: '女' }]}
            disabled={!isEditing}
          />
          <Input label="出生日期" type="date" value={policyholder.birthDate} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, birthDate: e.target.value })} disabled={!isEditing} />
          <Input label="手机号码" value={policyholder.phone} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, phone: e.target.value })} disabled={!isEditing} />
          <Input label="邮箱" value={policyholder.email || ''} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, email: e.target.value })} disabled={!isEditing} />
          <Input label="地址" value={policyholder.address || ''} onChange={(e) => isEditing && setPolicyholder({ ...policyholder, address: e.target.value })} disabled={!isEditing} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">保费信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="总保费" type="number" value={totalPremium} onChange={(e) => isEditing && setTotalPremium(parseFloat(e.target.value) || 0)} disabled={!isEditing} />
          <Select
            label="缴费方式"
            value={paymentFrequency}
            onChange={(value) => isEditing && setPaymentFrequency(value)}
            options={[{ label: '年缴', value: '年缴' }, { label: '半年缴', value: '半年缴' }, { label: '季缴', value: '季缴' }, { label: '月缴', value: '月缴' }]}
            disabled={!isEditing}
          />
          <Input label="已缴保费" type="number" value={paidPremium || ''} onChange={(e) => isEditing && setPaidPremium(parseFloat(e.target.value) || 0)} disabled={!isEditing} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">备注</h2>
        <textarea
          value={notes}
          onChange={(e) => isEditing && setNotes(e.target.value)}
          disabled={!isEditing}
          placeholder="添加备注信息..."
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
        />
      </div>
    </div>
  );

  const renderClauses = () => (
    <div className="space-y-6">
      {/* 主险条款 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">主险条款</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="条款代码" value={mainClause.clauseCode} onChange={(e) => isEditing && setMainClause({ ...mainClause, clauseCode: e.target.value })} disabled={!isEditing} />
          <Input label="条款名称" value={mainClause.clauseName} onChange={(e) => isEditing && setMainClause({ ...mainClause, clauseName: e.target.value })} disabled={!isEditing} />
          <Input label="保额" type="number" value={mainClause.sumInsured} onChange={(e) => isEditing && setMainClause({ ...mainClause, sumInsured: parseFloat(e.target.value) || 0 })} disabled={!isEditing} />
          <Input label="保费" type="number" value={mainClause.premium} onChange={(e) => isEditing && setMainClause({ ...mainClause, premium: parseFloat(e.target.value) || 0 })} disabled={!isEditing} />
          <Input label="免赔说明" value={mainClause.deductible || ''} onChange={(e) => isEditing && setMainClause({ ...mainClause, deductible: e.target.value })} disabled={!isEditing} />
        </div>
      </div>

      {/* 附加险条款 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">附加险条款</h2>
        {riderClauses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">暂无附加险条款</p>
        ) : (
          <div className="space-y-4">
            {riderClauses.map((clause, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded mr-2">附加险</span>
                    <span className="font-medium">{clause.clauseName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600 mr-2">保额: ¥{clause.sumInsured.toLocaleString()}</span>
                    <span className="text-sm font-medium text-gray-900">保费: ¥{clause.premium.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAgreements = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">特别约定</h2>
          {isEditing && (
            <button onClick={handleAddAgreement} className="px-3 py-1.5 text-sm bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              + 添加约定
            </button>
          )}
        </div>
        {specialAgreements.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">暂无特别约定</p>
        ) : (
          <div className="space-y-4">
            {specialAgreements.map((agreement, idx) => (
              <div key={agreement.id} className="border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded mr-2">{agreement.category}</span>
                    <span className="font-semibold text-gray-900">{agreement.title}</span>
                  </div>
                  {isEditing && (
                    <div className="space-x-2">
                      <button onClick={() => handleEditAgreement(agreement)} className="text-sm text-brand-blue-600 hover:text-brand-blue-900">编辑</button>
                      <button onClick={() => handleDeleteAgreement(agreement.id)} className="text-sm text-red-600 hover:text-red-900">删除</button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{agreement.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderDeductions = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">免赔约定</h2>
          {isEditing && (
            <button onClick={handleAddDeduction} className="px-3 py-1.5 text-sm bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              + 添加免赔规则
            </button>
          )}
        </div>
        {deductionRules.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">暂无免赔约定</p>
        ) : (
          <div className="space-y-4">
            {deductionRules.map((rule, idx) => (
              <div key={rule.id} className="border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded mr-2">{rule.type}</span>
                    <span className="font-semibold text-gray-900">{rule.name}</span>
                  </div>
                  {isEditing && (
                    <div className="space-x-2">
                      <button onClick={() => handleEditDeduction(rule)} className="text-sm text-brand-blue-600 hover:text-brand-blue-900">编辑</button>
                      <button onClick={() => handleDeleteDeduction(rule.id)} className="text-sm text-red-600 hover:text-red-900">删除</button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                  <div>
                    <span className="text-gray-500">数值：</span>
                    <span className="text-gray-900">{rule.value} {rule.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">适用范围：</span>
                    <span className="text-gray-900">{rule.applicableScope}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{rule.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">保单明细表</h2>
          <button onClick={handleGenerateSchedule} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
            生成明细表
          </button>
        </div>
        {!schedule ? (
          <p className="text-sm text-gray-500 text-center py-8">尚未生成保单明细表，请点击上方按钮生成</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-md">
              <div>
                <span className="text-sm text-gray-500">版本</span>
                <p className="font-semibold">{schedule.version}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">生成时间</span>
                <p className="font-semibold">{schedule.generatedAt.split('T')[0]}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">总保额</span>
                <p className="font-semibold text-blue-600">¥{schedule.totalSumInsured.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">总保费</span>
                <p className="font-semibold text-green-600">¥{schedule.totalPremium.toLocaleString()}</p>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">分类</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">项目名称</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">保额</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">免赔额</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">赔付比例</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">备注</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedule.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.itemName}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">¥{item.sumInsured.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">¥{item.deductible.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{item.reimbursementRatio}%</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderClaims = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">理赔记录</h2>
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md mb-4">
          <div>
            <span className="text-sm text-gray-500">理赔次数</span>
            <p className="text-2xl font-bold text-brand-blue-600">{claimCount}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">累计理赔金额</span>
            <p className="text-2xl font-bold text-red-600">¥{totalClaimAmount.toLocaleString()}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 text-center py-8">详细的理赔记录请在赔案清单中查看</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {policy ? `保单详情 - ${policyNumber}` : '新建保单'}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button onClick={() => policy ? setIsEditing(false) : onBack()} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                取消
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
                保存
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-1 px-4" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-blue-600 text-brand-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'basic' && renderBasicInfo()}
          {activeTab === 'clauses' && renderClauses()}
          {activeTab === 'agreements' && renderAgreements()}
          {activeTab === 'deductions' && renderDeductions()}
          {activeTab === 'schedule' && renderSchedule()}
          {activeTab === 'claims' && renderClaims()}
        </div>
      </div>

      {/* Add/Edit Agreement Modal */}
      <Modal
        isOpen={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        title={editingAgreement ? '编辑特别约定' : '添加特别约定'}
      >
        <div className="space-y-4">
          <Input
            label="标题"
            value={tempAgreement.title}
            onChange={(e) => setTempAgreement({ ...tempAgreement, title: e.target.value })}
            required
          />
          <Select
            label="分类"
            value={tempAgreement.category}
            onChange={(value) => setTempAgreement({ ...tempAgreement, category: value as any })}
            options={[
              { label: '扩展责任', value: '扩展责任' },
              { label: '限制责任', value: '限制责任' },
              { label: '特约事项', value: '特约事项' },
              { label: '其他', value: '其他' }
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
            <textarea
              value={tempAgreement.content}
              onChange={(e) => setTempAgreement({ ...tempAgreement, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="请输入约定内容..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={() => setShowAgreementModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              取消
            </button>
            <button onClick={handleSaveAgreement} className="px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Deduction Modal */}
      <Modal
        isOpen={showDeductionModal}
        onClose={() => setShowDeductionModal(false)}
        title={editingDeduction ? '编辑免赔约定' : '添加免赔约定'}
      >
        <div className="space-y-4">
          <Input
            label="名称"
            value={tempDeduction.name}
            onChange={(e) => setTempDeduction({ ...tempDeduction, name: e.target.value })}
            required
          />
          <Select
            label="类型"
            value={tempDeduction.type}
            onChange={(value) => setTempDeduction({ ...tempDeduction, type: value as any })}
            options={[
              { label: '绝对免赔额', value: '绝对免赔额' },
              { label: '相对免赔额', value: '相对免赔额' },
              { label: '比例免赔', value: '比例免赔' },
              { label: '累积免赔', value: '累积免赔' }
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="数值"
              type="number"
              value={tempDeduction.value}
              onChange={(e) => setTempDeduction({ ...tempDeduction, value: parseFloat(e.target.value) || 0 })}
            />
            <Select
              label="单位"
              value={tempDeduction.unit}
              onChange={(value) => setTempDeduction({ ...tempDeduction, unit: value as any })}
              options={[{ label: '元', value: '元' }, { label: '%', value: '%' }, { label: '次', value: '次' }]}
            />
          </div>
          <Select
            label="适用范围"
            value={tempDeduction.applicableScope}
            onChange={(value) => setTempDeduction({ ...tempDeduction, applicableScope: value as any })}
            options={[
              { label: '每次事故', value: '每次事故' },
              { label: '年度累积', value: '年度累积' },
              { label: '保单期间', value: '保单期间' }
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">说明</label>
            <textarea
              value={tempDeduction.description}
              onChange={(e) => setTempDeduction({ ...tempDeduction, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="请输入免赔说明..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={() => setShowDeductionModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              取消
            </button>
            <button onClick={handleSaveDeduction} className="px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PolicyDetailPage;
