import React, { useState, useEffect } from 'react';
import { type QuoteRequest, type QuotePlan, QuoteStatus, QuoteType, type QuoteInsured, type QuotePolicyholder, type InsuranceProduct, ProductStatus } from '../types';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import { api } from '../services/api';

interface QuoteDetailPageProps {
  quote?: QuoteRequest;
  onBack: () => void;
  onSave: (quote: QuoteRequest) => void;
}

const QuoteDetailPage: React.FC<QuoteDetailPageProps> = ({ quote, onBack, onSave }) => {
  const [isEditing, setIsEditing] = useState(!quote);
  const [quoteNumber] = useState(quote?.quoteNumber || `QT${Date.now()}`);
  const [type, setType] = useState<QuoteType>(quote?.type || QuoteType.INDIVIDUAL);
  const [status, setStatus] = useState<QuoteStatus>(quote?.status || QuoteStatus.DRAFT);

  // 投保人信息
  const [policyholder, setPolicyholder] = useState<QuotePolicyholder>(quote?.policyholder || {
    name: '',
    idType: '身份证',
    idNumber: '',
    gender: '男',
    birthDate: '',
    phone: '',
    email: '',
    address: ''
  });

  // 被保险人列表
  const [insureds, setInsureds] = useState<QuoteInsured[]>(quote?.insureds || []);

  // 方案列表
  const [plans, setPlans] = useState<QuotePlan[]>(quote?.plans || []);

  // 其他信息
  const [effectiveDate, setEffectiveDate] = useState(quote?.effectiveDate || '');
  const [expiryDate, setExpiryDate] = useState(quote?.expiryDate || '');
  const [validUntil, setValidUntil] = useState(quote?.validUntil || '');
  const [selectedPlanId, setSelectedPlanId] = useState(quote?.selectedPlanId || '');
  const [notes, setNotes] = useState(quote?.notes || '');

  // 对话框状态
  const [showAddInsuredModal, setShowAddInsuredModal] = useState(false);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [editingInsured, setEditingInsured] = useState<QuoteInsured | null>(null);
  const [editingPlan, setEditingPlan] = useState<QuotePlan | null>(null);

  // 临时表单数据
  const [tempInsured, setTempInsured] = useState<QuoteInsured>({
    id: '',
    name: '',
    idType: '身份证',
    idNumber: '',
    gender: '男',
    birthDate: '',
    relationship: '本人',
    occupation: '',
    phone: ''
  });

  const [tempPlan, setTempPlan] = useState<QuotePlan>({
    id: '',
    planName: '',
    productCode: '',
    productName: '',
    companyName: '',
    premium: 0,
    paymentPeriod: '年缴',
    coveragePeriod: '1年',
    clauses: [],
    notes: ''
  });

  // 获取产品列表
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [clauses, setClauses] = useState<any[]>([]);
  const availableProducts = products.filter(product =>
    product.status === ProductStatus.ACTIVE ||
    product.status === '生效中' ||
    product.status === 'ACTIVE'
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsData, clausesData] = await Promise.all([
          api.products.list(),
          api.clauses.list()
        ]);
        setProducts(productsData as InsuranceProduct[]);
        setClauses(clausesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const handleSave = () => {
    const quoteData: QuoteRequest = {
      id: quote?.id || `quote-${Date.now()}`,
      quoteNumber,
      type,
      status,
      policyholder,
      insureds,
      plans,
      selectedPlanId,
      effectiveDate,
      expiryDate,
      validUntil,
      createdAt: quote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      operator: '当前用户',
      notes
    };
    onSave(quoteData);
    setIsEditing(false);
  };

  const handleAddInsured = () => {
    setTempInsured({
      id: `insured-${Date.now()}`,
      name: '',
      idType: '身份证',
      idNumber: '',
      gender: '男',
      birthDate: '',
      relationship: '本人',
      occupation: '',
      phone: ''
    });
    setEditingInsured(null);
    setShowAddInsuredModal(true);
  };

  const handleEditInsured = (insured: QuoteInsured) => {
    setTempInsured({ ...insured });
    setEditingInsured(insured);
    setShowAddInsuredModal(true);
  };

  const handleSaveInsured = () => {
    if (editingInsured) {
      setInsureds(insureds.map(i => i.id === tempInsured.id ? tempInsured : i));
    } else {
      setInsureds([...insureds, tempInsured]);
    }
    setShowAddInsuredModal(false);
  };

  const handleDeleteInsured = (id: string) => {
    if (window.confirm('确定要删除该被保险人吗？')) {
      setInsureds(insureds.filter(i => i.id !== id));
    }
  };

  const handleAddPlan = () => {
    setTempPlan({
      id: `plan-${Date.now()}`,
      planName: '',
      productCode: '',
      productName: '',
      companyName: '',
      premium: 0,
      paymentPeriod: '年缴',
      coveragePeriod: '1年',
      clauses: [],
      notes: ''
    });
    setEditingPlan(null);
    setShowAddPlanModal(true);
  };

  const handleEditPlan = (plan: QuotePlan) => {
    setTempPlan({ ...plan });
    setEditingPlan(plan);
    setShowAddPlanModal(true);
  };

  const handleSavePlan = () => {
    if (editingPlan) {
      setPlans(plans.map(p => p.id === tempPlan.id ? tempPlan : p));
    } else {
      setPlans([...plans, tempPlan]);
    }
    setShowAddPlanModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (window.confirm('确定要删除该方案吗？')) {
      setPlans(plans.filter(p => p.id !== id));
      if (selectedPlanId === id) setSelectedPlanId('');
    }
  };

  const handleProductSelect = (productCode: string) => {
    const product = availableProducts.find(p => p.productCode === productCode);
    if (product) {
      setTempPlan({
        ...tempPlan,
        productCode: product.productCode,
        productName: product.marketingName || product.regulatoryName,
        companyName: product.companyName
      });
    }
  };

  const handleCalculatePremium = async () => {
    try {
      const result = await api.calculatePremium({
        productCode: tempPlan.productCode,
        planId: tempPlan.id,
        insureds: insureds,
        clauses: tempPlan.clauses
      });
      setTempPlan({
        ...tempPlan,
        premium: result.premium || 0
      });
    } catch (error) {
      console.error('Failed to calculate premium:', error);
      alert('保费计算失败');
    }
  };

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
            {quote ? `询价单详情 - ${quoteNumber}` : '新建询价单'}
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button onClick={() => quote ? setIsEditing(false) : onBack()} className="px-4 py-2 text-gray-600 hover:text-gray-800">
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

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="询价单号"
                value={quoteNumber}
                onChange={() => {}}
                disabled={!isEditing}
              />
              <Select
                label="询价类型"
                value={type}
                onChange={(value) => isEditing && setType(value as QuoteType)}
                options={Object.values(QuoteType).map(t => ({ label: t, value: t }))}
                disabled={!isEditing}
              />
              <Select
                label="状态"
                value={status}
                onChange={(value) => isEditing && setStatus(value as QuoteStatus)}
                options={Object.values(QuoteStatus).map(s => ({ label: s, value: s }))}
                disabled={!isEditing}
              />
              <Input
                label="生效日期"
                type="date"
                value={effectiveDate}
                onChange={(e) => isEditing && setEffectiveDate(e.target.value)}
                disabled={!isEditing}
              />
              <Input
                label="失效日期"
                type="date"
                value={expiryDate}
                onChange={(e) => isEditing && setExpiryDate(e.target.value)}
                disabled={!isEditing}
              />
              <Input
                label="有效期至"
                type="date"
                value={validUntil}
                onChange={(e) => isEditing && setValidUntil(e.target.value)}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Policyholder Information */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">投保人信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="姓名"
                value={policyholder.name}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, name: e.target.value })}
                disabled={!isEditing}
              />
              <Select
                label="证件类型"
                value={policyholder.idType}
                onChange={(value) => isEditing && setPolicyholder({ ...policyholder, idType: value as any })}
                options={[
                  { label: '身份证', value: '身份证' },
                  { label: '护照', value: '护照' },
                  { label: '港澳通行证', value: '港澳通行证' },
                  { label: '其他', value: '其他' }
                ]}
                disabled={!isEditing}
              />
              <Input
                label="证件号码"
                value={policyholder.idNumber}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, idNumber: e.target.value })}
                disabled={!isEditing}
              />
              <Select
                label="性别"
                value={policyholder.gender}
                onChange={(value) => isEditing && setPolicyholder({ ...policyholder, gender: value as any })}
                options={[
                  { label: '男', value: '男' },
                  { label: '女', value: '女' }
                ]}
                disabled={!isEditing}
              />
              <Input
                label="出生日期"
                type="date"
                value={policyholder.birthDate}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, birthDate: e.target.value })}
                disabled={!isEditing}
              />
              <Input
                label="手机号码"
                value={policyholder.phone}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, phone: e.target.value })}
                disabled={!isEditing}
              />
              <Input
                label="邮箱"
                value={policyholder.email || ''}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, email: e.target.value })}
                disabled={!isEditing}
              />
              <Input
                label="地址"
                value={policyholder.address || ''}
                onChange={(e) => isEditing && setPolicyholder({ ...policyholder, address: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Insureds List */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">被保险人列表</h2>
              {isEditing && (
                <button onClick={handleAddInsured} className="px-3 py-1.5 text-sm bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
                  + 添加被保险人
                </button>
              )}
            </div>
            <div className="space-y-3">
              {insureds.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">暂无被保险人</p>
              ) : (
                insureds.map((insured, idx) => (
                  <div key={insured.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">被保险人 #{idx + 1}</span>
                      {isEditing && (
                        <div className="space-x-2">
                          <button onClick={() => handleEditInsured(insured)} className="text-sm text-brand-blue-600 hover:text-brand-blue-900">
                            编辑
                          </button>
                          <button onClick={() => handleDeleteInsured(insured.id)} className="text-sm text-red-600 hover:text-red-900">
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">姓名：</span>
                        <span className="text-gray-900">{insured.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">证件类型：</span>
                        <span className="text-gray-900">{insured.idType}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">证件号码：</span>
                        <span className="text-gray-900">{insured.idNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">与投保人关系：</span>
                        <span className="text-gray-900">{insured.relationship}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Plans List */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">询价方案</h2>
              {isEditing && (
                <button onClick={handleAddPlan} className="px-3 py-1.5 text-sm bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
                  + 添加方案
                </button>
              )}
            </div>
            <div className="space-y-4">
              {plans.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">暂无方案</p>
              ) : (
                plans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    className={`border rounded-md p-4 ${selectedPlanId === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  >
                    {isEditing && (
                      <div className="flex items-center space-x-2 mb-3">
                        <input
                          type="radio"
                          id={`plan-${plan.id}`}
                          name="selected-plan"
                          checked={selectedPlanId === plan.id}
                          onChange={() => setSelectedPlanId(plan.id)}
                        />
                        <label htmlFor={`plan-${plan.id}`} className="text-sm font-medium text-gray-700">
                          设为选中方案
                        </label>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{plan.planName || `方案 ${idx + 1}`}</h3>
                        <p className="text-sm text-gray-600">{plan.productName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand-blue-600">¥{plan.premium.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{plan.paymentPeriod}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">保额期限：{plan.coveragePeriod}</span>
                      {isEditing && (
                        <div className="space-x-2">
                          <button onClick={() => handleEditPlan(plan)} className="text-sm text-brand-blue-600 hover:text-brand-blue-900">
                            编辑
                          </button>
                          <button onClick={() => handleDeletePlan(plan.id)} className="text-sm text-red-600 hover:text-red-900">
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h2>
            <div className="space-y-3">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700 transition"
              >
                编辑询价单
              </button>
              <button
                disabled={!selectedPlanId}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成正式报价
              </button>
              <button
                disabled={status !== QuoteStatus.QUOTED && status !== QuoteStatus.ACCEPTED}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                转换为保单
              </button>
            </div>
          </div>

          {/* Notes */}
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

          {/* Quote Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">询价概要</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">被保险人数</span>
                <span className="font-semibold">{insureds.length} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">方案数量</span>
                <span className="font-semibold">{plans.length} 个</span>
              </div>
              <div className="border-t border-blue-200 pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-gray-900 font-medium">最低保费</span>
                  <span className="font-bold text-lg text-brand-blue-600">
                    ¥{plans.length > 0 ? Math.min(...plans.map(p => p.premium)).toLocaleString() : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Insured Modal */}
      <Modal
        isOpen={showAddInsuredModal}
        onClose={() => setShowAddInsuredModal(false)}
        title={editingInsured ? '编辑被保险人' : '添加被保险人'}
      >
        <div className="space-y-4">
          <Input
            label="姓名"
            value={tempInsured.name}
            onChange={(e) => setTempInsured({ ...tempInsured, name: e.target.value })}
            required
          />
          <Select
            label="证件类型"
            value={tempInsured.idType}
            onChange={(value) => setTempInsured({ ...tempInsured, idType: value as any })}
            options={[
              { label: '身份证', value: '身份证' },
              { label: '护照', value: '护照' },
              { label: '港澳通行证', value: '港澳通行证' },
              { label: '其他', value: '其他' }
            ]}
          />
          <Input
            label="证件号码"
            value={tempInsured.idNumber}
            onChange={(e) => setTempInsured({ ...tempInsured, idNumber: e.target.value })}
            required
          />
          <Select
            label="性别"
            value={tempInsured.gender}
            onChange={(value) => setTempInsured({ ...tempInsured, gender: value as any })}
            options={[
              { label: '男', value: '男' },
              { label: '女', value: '女' }
            ]}
          />
          <Input
            label="出生日期"
            type="date"
            value={tempInsured.birthDate}
            onChange={(e) => setTempInsured({ ...tempInsured, birthDate: e.target.value })}
          />
          <Select
            label="与投保人关系"
            value={tempInsured.relationship}
            onChange={(value) => setTempInsured({ ...tempInsured, relationship: value as any })}
            options={[
              { label: '本人', value: '本人' },
              { label: '配偶', value: '配偶' },
              { label: '子女', value: '子女' },
              { label: '父母', value: '父母' },
              { label: '其他', value: '其他' }
            ]}
          />
          <Input
            label="职业"
            value={tempInsured.occupation || ''}
            onChange={(e) => setTempInsured({ ...tempInsured, occupation: e.target.value })}
          />
          <Input
            label="手机号码"
            value={tempInsured.phone || ''}
            onChange={(e) => setTempInsured({ ...tempInsured, phone: e.target.value })}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={() => setShowAddInsuredModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              取消
            </button>
            <button onClick={handleSaveInsured} className="px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Plan Modal */}
      <Modal
        isOpen={showAddPlanModal}
        onClose={() => setShowAddPlanModal(false)}
        title={editingPlan ? '编辑方案' : '添加方案'}
        large
      >
        <div className="space-y-4">
          <Input
            label="方案名称"
            value={tempPlan.planName}
            onChange={(e) => setTempPlan({ ...tempPlan, planName: e.target.value })}
            required
          />
          <Select
            label="产品"
            value={tempPlan.productCode}
            onChange={handleProductSelect}
            options={availableProducts.map(product => ({
              label: `${product.marketingName || product.regulatoryName} - ${product.companyName}`,
              value: product.productCode
            }))}
            placeholder="请选择产品"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="保费"
              type="number"
              value={tempPlan.premium}
              onChange={(e) => setTempPlan({ ...tempPlan, premium: parseFloat(e.target.value) || 0 })}
            />
            <Select
              label="缴费方式"
              value={tempPlan.paymentPeriod}
              onChange={(value) => setTempPlan({ ...tempPlan, paymentPeriod: value })}
              options={[
                { label: '年缴', value: '年缴' },
                { label: '半年缴', value: '半年缴' },
                { label: '季缴', value: '季缴' },
                { label: '月缴', value: '月缴' }
              ]}
            />
          </div>
          <Input
            label="保险期间"
            value={tempPlan.coveragePeriod}
            onChange={(e) => setTempPlan({ ...tempPlan, coveragePeriod: e.target.value })}
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">条款配置</label>
              <button onClick={handleCalculatePremium} className="text-sm text-brand-blue-600 hover:text-brand-blue-900">
                计算保费
              </button>
            </div>
            <div className="border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
              {tempPlan.clauses.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">暂无条款</p>
              ) : (
                tempPlan.clauses.map((clause, idx) => (
                  <div key={idx} className="border-b border-gray-100 py-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded mr-2">{clause.clauseType}</span>
                        <span className="text-sm font-medium">{clause.clauseName}</span>
                      </div>
                      <span className="text-sm text-gray-600">¥{clause.premium}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <Input
            label="方案备注"
            value={tempPlan.notes || ''}
            onChange={(e) => setTempPlan({ ...tempPlan, notes: e.target.value })}
            multiline
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={() => setShowAddPlanModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              取消
            </button>
            <button onClick={handleSavePlan} className="px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700">
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuoteDetailPage;
