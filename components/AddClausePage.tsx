
import React, { useState, useEffect } from 'react';
import { type Clause, ProductStatus, PrimaryCategory, ClauseType, ResponsibilityItem } from '../types';
import Input from './ui/Input';
import Select from './ui/Select';
import FileUpload from './ui/FileUpload';
import { PRODUCT_STATUSES, MOCK_COMPANY_LIST, CLAUSE_TYPES, LEVEL_1_DATA, LEVEL_2_DATA, LEVEL_3_DATA, MOCK_CLAUSES, MOCK_RESPONSIBILITIES } from '../constants';

type NewClauseState = Partial<Clause> & {
    regulatoryName: string;
    companyName: string;
    effectiveDate: string;
    discontinuationDate: string;
    status: ProductStatus;
    clauseType: ClauseType;
    clauseTextFile?: string;
    rateTableFile?: string;
    productDescriptionFile?: string;
    cashValueTableFile?: string;
  selectedResponsibilities?: ResponsibilityItem[];
};

// Map the new L1/L2 names to the legacy PrimaryCategory enum for form logic
const mapToLegacyCategory = (l1Name: string, l2Name: string): PrimaryCategory => {
    if (l1Name === '医疗险') return PrimaryCategory.HEALTH;
    if (l1Name === '重疾险') return PrimaryCategory.CRITICAL_ILLNESS;
    if (l1Name === '意外险') return PrimaryCategory.ACCIDENT;
    if (l1Name === '定期寿险') return PrimaryCategory.TERM_LIFE;
    if (l1Name === '养老金') return PrimaryCategory.ANNUITY;
    if (l1Name === '储蓄型') {
        if (l2Name && l2Name.includes('年金')) return PrimaryCategory.ANNUITY;
        return PrimaryCategory.WHOLE_LIFE; // For 增额终身寿, 两全保险
    }
    return PrimaryCategory.HEALTH; // Default fallback
};

const getCategoryAbbr = (cat: PrimaryCategory): string => {
    const map: Record<PrimaryCategory, string> = {
        [PrimaryCategory.HEALTH]: 'HL',
        [PrimaryCategory.ACCIDENT]: 'AC',
        [PrimaryCategory.CRITICAL_ILLNESS]: 'CI',
        [PrimaryCategory.TERM_LIFE]: 'TL',
        [PrimaryCategory.WHOLE_LIFE]: 'WL',
        [PrimaryCategory.ANNUITY]: 'AN',
    };
    return map[cat] || 'OT';
};

const generateClauseCode = (companyCode: string | undefined, cat: PrimaryCategory): string => {
    const insurerCode = companyCode || 'GEN';
    const year = new Date().getFullYear();
    const abbr = getCategoryAbbr(cat);
    const prefix = `${insurerCode}${year}C${abbr}`;
    const exists = MOCK_CLAUSES
        .map(c => c.productCode)
        .filter(code => typeof code === 'string' && code.startsWith(prefix));
    const maxSeq = exists.reduce((max, code) => {
        const m = code.match(/(\d{3})$/);
        const n = m ? parseInt(m[1], 10) : 0;
        return Math.max(max, n);
    }, 0);
    const next = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}${next}`;
};

const AddClausePage: React.FC<{ onBack: () => void; initialClause?: Clause; companyCode?: string }> = ({ onBack, initialClause, companyCode }) => {
    // State for 3-level category selection
    const initL1Code = initialClause?.primaryCategoryCode || '';
    const initL1Name = initL1Code ? (LEVEL_1_DATA.find(l => l.code === initL1Code)?.name || '') : '';
    const [selectedLevel1Name, setSelectedLevel1Name] = useState<string>(initL1Name);
    const [selectedLevel1Code, setSelectedLevel1Code] = useState<string>(initL1Code);
    const [selectedLevel2Code, setSelectedLevel2Code] = useState<string>(initialClause?.secondaryCategoryCode || '');
    const [selectedLevel3, setSelectedLevel3] = useState<string>(initialClause?.racewayId || '');

    const [newClause, setNewClause] = useState<NewClauseState | null>(initialClause ? { ...initialClause } as NewClauseState : null);

    // Derived options based on selection
    const [level2Options, setLevel2Options] = useState<{code: string, name: string}[]>([]);
    const [level3Options, setLevel3Options] = useState<{code: string, name: string}[]>([]);

    useEffect(() => {
        if (selectedLevel1Code) {
            const options = LEVEL_2_DATA.filter(l2 => l2.code.charAt(0) === selectedLevel1Code).map(l2 => ({ code: l2.code, name: l2.name }));
            setLevel2Options(options);
        } else {
            setLevel2Options([]);
        }
    }, [selectedLevel1Code]);

    useEffect(() => {
        if (selectedLevel2Code) {
            const options = LEVEL_3_DATA.filter(l3 => l3.code.slice(0, 3) === selectedLevel2Code).map(l3 => ({ code: l3.code, name: l3.name }));
            setLevel3Options(options);
        } else {
            setLevel3Options([]);
        }
    }, [selectedLevel2Code]);


    const handleLevel1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const l1Data = LEVEL_1_DATA.find(l => l.name === value);
        setSelectedLevel1Name(value);
        setSelectedLevel1Code(l1Data?.code || '');
        setSelectedLevel2Code('');
        setSelectedLevel3('');
        setNewClause(null);
    };

    const handleLevel2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedLevel2Code(value);
        setSelectedLevel3('');
        setNewClause(null);
    };

    const handleLevel3Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        setSelectedLevel3(code);
        
        if (code) {
            const l1Data = LEVEL_1_DATA.find(l => l.code === selectedLevel1Code);
            const l2Data = LEVEL_2_DATA.find(l => l.code === selectedLevel2Code);
            const l3Data = LEVEL_3_DATA.find(l => l.code === code);
            
            const legacyCategory = mapToLegacyCategory(l1Data?.name || '', l2Data?.name || '');

            setNewClause({
                ...initialClause,
                productCode: initialClause?.productCode || generateClauseCode(companyCode, legacyCategory),
                regulatoryName: initialClause?.regulatoryName || '',
                companyName: initialClause?.companyName || (
                    companyCode ? (MOCK_COMPANY_LIST.find(c => c.code === companyCode)?.shortName || '') : (MOCK_COMPANY_LIST.find(c => c.status === '生效')?.shortName || '')
                ),
                status: initialClause?.status || ProductStatus.DRAFT,
                clauseType: initialClause?.clauseType || ClauseType.MAIN,
                effectiveDate: initialClause?.effectiveDate || new Date().toISOString().split('T')[0],
                discontinuationDate: initialClause?.discontinuationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
                
                // New Classification Fields (renamed)
                primaryCategoryCode: l1Data?.code,
                secondaryCategoryCode: l2Data?.code,
                racewayId: l3Data?.code,
                racewayName: l3Data?.name,

                // Legacy Fields
                primaryCategory: legacyCategory,
                secondaryCategory: l2Data?.name || '',
                selectedResponsibilities: [],

                clauseTextFile: initialClause?.clauseTextFile || '',
                rateTableFile: initialClause?.rateTableFile || '',
                productDescriptionFile: initialClause?.productDescriptionFile || '',
                cashValueTableFile: initialClause?.cashValueTableFile || '',
            });
        } else {
            setNewClause(null);
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!newClause) return;
        const { name, value } = e.target;
        setNewClause(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleFileChange = (field: keyof NewClauseState, value: string) => {
        if (!newClause) return;
        setNewClause(prev => prev ? { ...prev, [field]: value } : null);
    }

    const handleSave = () => {
        console.log('Saving clause:', newClause);
        alert(initialClause ? '条款已修改！' : '条款已保存！');
        onBack();
    };

    const CASH_VALUE_CATEGORIES: PrimaryCategory[] = [
        PrimaryCategory.ANNUITY,
        PrimaryCategory.WHOLE_LIFE,
        PrimaryCategory.TERM_LIFE,
        PrimaryCategory.CRITICAL_ILLNESS
    ];

    const showCashValueUpload = newClause?.primaryCategory && CASH_VALUE_CATEGORIES.includes(newClause.primaryCategory);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                {!newClause ? (
                    <div className="space-y-6 text-center">
                        <h2 className="text-xl font-bold text-gray-800">第一步：选择险种分类</h2>
                        <p className="text-gray-500">请按层级选择您要新增条款的保险分类。</p>
                        
                        <div className="max-w-md mx-auto space-y-4 text-left">
                           <Select label="一级分类" id="level1" name="level1" value={selectedLevel1Name} onChange={handleLevel1Change}>
                                <option value="">-- 请选择 --</option>
                                {LEVEL_1_DATA.map(cat => <option key={cat.code} value={cat.name}>{cat.name}</option>)}
                            </Select>

                            <Select label="二级分类" id="level2" name="level2" value={selectedLevel2Code} onChange={handleLevel2Change} disabled={!selectedLevel1Code}>
                                <option value="">-- 请选择 --</option>
                                {level2Options.map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                            </Select>

                            <Select label="三级分类" id="level3" name="level3" value={selectedLevel3} onChange={handleLevel3Change} disabled={!selectedLevel2Code}>
                                <option value="">-- 请选择 --</option>
                                {level3Options.map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                            </Select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div>
                            {!initialClause && (
                                <button onClick={() => { setSelectedLevel3(''); setNewClause(null); }} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    重新选择险种
                                </button>
                            )}
                            <h2 className="text-xl font-bold text-gray-800">
                                {initialClause ? '修改条款' : '新增条款'}
                                <span className="ml-2 text-base font-normal text-gray-500">
                                    ({selectedLevel1Name} &gt; {LEVEL_2_DATA.find(l => l.code === selectedLevel2Code)?.name || ''} &gt; {newClause.racewayName})
                                </span>
                            </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="条款代码" id="productCode" name="productCode" value={newClause?.productCode || ''} disabled />
                            <Input label="条款名称" id="regulatoryName" name="regulatoryName" value={newClause?.regulatoryName || ''} onChange={handleChange} placeholder="例如：新版健康医疗保险" required />
                            <Select label="保险公司名称" id="companyName" name="companyName" value={newClause?.companyName || ''} onChange={handleChange}>
                                {MOCK_COMPANY_LIST.filter(c => c.status === '生效' && (!companyCode || c.code === companyCode)).map(c => (
                                    <option key={c.code} value={c.shortName}>{c.shortName}</option>
                                ))}
                            </Select>
                            <Select label="条款类型" id="clauseType" name="clauseType" value={newClause?.clauseType || ''} onChange={handleChange}>
                                {CLAUSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </Select>
                             <Select label="状态" id="status" name="status" value={newClause?.status || ''} onChange={handleChange}>
                                {PRODUCT_STATUSES.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                            </Select>
                            <Input label="生效日期" id="effectiveDate" name="effectiveDate" type="date" value={newClause?.effectiveDate || ''} onChange={handleChange} required />
                            <Input label="失效日期" id="discontinuationDate" name="discontinuationDate" type="date" value={newClause?.discontinuationDate || ''} onChange={handleChange} required />
                        </div>

                        {/* Responsibilities selection */}
                        <div className="space-y-3 pt-6 border-t border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900">选择责任（可多选）</h3>
                          <p className="text-sm text-gray-500">从该条款所属一级分类已创建的责任中选取。</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(LEVEL_1_DATA.find(l => l.code === selectedLevel1Code) ? MOCK_RESPONSIBILITIES.filter(r => r.category === LEVEL_1_DATA.find(l => l.code === selectedLevel1Code)!.name) : []).map(item => {
                              const checked = !!newClause?.selectedResponsibilities?.some(r => r.code === item.code);
                              return (
                                <label key={item.code} className="flex items-start space-x-2 p-3 border border-gray-200 rounded-md">
                                  <input type="checkbox" checked={checked} onChange={e => {
                                    const sel = newClause?.selectedResponsibilities || [];
                                    const next = e.target.checked ? [...sel, item] : sel.filter(r => r.code !== item.code);
                                    setNewClause(prev => prev ? { ...prev, selectedResponsibilities: next } : null);
                                  }} />
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-800">{item.name} <span className="ml-2 font-mono text-gray-500">{item.code}</span></div>
                                    <div className="text-gray-600">{item.description}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-gray-200">
                             <h3 className="text-lg font_medium text-gray-900">条款文件上传</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FileUpload 
                                    label="条款原文"
                                    id="clauseTextFile"
                                    value={newClause?.clauseTextFile}
                                    onChange={(value) => handleFileChange('clauseTextFile', value)}
                                    helpText="上传条款原文PDF文件"
                                    accept=".pdf,.doc,.docx"
                                    required
                                />
                                <FileUpload 
                                    label="费率表"
                                    id="rateTableFile"
                                    value={newClause?.rateTableFile}
                                    onChange={(value) => handleFileChange('rateTableFile', value)}
                                    helpText="上传费率表Excel或PDF文件"
                                    accept=".pdf,.xls,.xlsx"
                                    required
                                />
                                 <FileUpload 
                                    label="产品说明"
                                    id="productDescriptionFile"
                                    value={newClause?.productDescriptionFile}
                                    onChange={(value) => handleFileChange('productDescriptionFile', value)}
                                    helpText="上传产品说明文件"
                                    accept=".pdf,.doc,.docx"
                                />
                                {showCashValueUpload && (
                                     <FileUpload 
                                        label="现金价值表"
                                        id="cashValueTableFile"
                                        value={newClause?.cashValueTableFile}
                                        onChange={(value) => handleFileChange('cashValueTableFile', value)}
                                        helpText="上传现金价值表Excel文件"
                                        accept=".xls,.xlsx"
                                    />
                                )}
                             </div>
                        </div>

                        <div className="pt-6 border-t border-gray-200 flex justify-end space-x-3">
                            <button
                                onClick={onBack}
                                className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                                返回
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                                {initialClause ? '修改条款' : '保存条款'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddClausePage;
