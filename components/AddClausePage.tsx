
import React, { useState, useEffect } from 'react';
import { type Clause, ProductStatus, PrimaryCategory, ClauseType } from '../types';
import Input from './ui/Input';
import Select from './ui/Select';
import FileUpload from './ui/FileUpload';
import { PRODUCT_STATUSES, MOCK_COMPANY_LIST, CLAUSE_TYPES, MOCK_CLAUSES } from '../constants';
import { api } from '../services/api';


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
    basicSumInsuredTableFile?: string;
    selectedResponsibilities?: any[];
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
    if (l1Name === '车险') return PrimaryCategory.CAR_INSURANCE;
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
        [PrimaryCategory.CAR_INSURANCE]: 'CI', // Added to fix lint
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
    const [selectedLevel1Name, setSelectedLevel1Name] = useState<string>(initialClause?.primaryCategory || '');
    const [selectedLevel1Code, setSelectedLevel1Code] = useState<string>(initialClause?.primaryCategoryCode || '');
    const [selectedLevel2Code, setSelectedLevel2Code] = useState<string>(initialClause?.secondaryCategoryCode || '');
    const [selectedLevel3, setSelectedLevel3] = useState<string>(initialClause?.racewayId || initialClause?.categoryLevel3Code || '');

    const [newClause, setNewClause] = useState<NewClauseState | null>(initialClause ? { ...initialClause } as NewClauseState : null);

    // Derived options based on selection
    const [insuranceTypes, setInsuranceTypes] = useState<any>({ level1: [], level2: [], mappings: [] });
    const [level2Options, setLevel2Options] = useState<{ code: string, name: string }[]>([]);
    const [level3Options, setLevel3Options] = useState<{ code: string, name: string }[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [allResponsibilities, setAllResponsibilities] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [typesData, companiesData, mappingData, responsibilitiesData] = await Promise.all([
                    api.insuranceTypes.list().catch(() => null),
                    api.companies.list().catch(() => []),
                    api.mappingData.list().catch(() => []),
                    api.responsibilities.list().catch(() => [])
                ]);

                // Merge mapping data into insurance types
                const mergedTypes = {
                    ...(typesData || { level1: [], level2: [] }),
                    mappings: Array.isArray(mappingData) ? mappingData : (typesData?.mappings || [])
                };
                setInsuranceTypes(mergedTypes);

                // Process companies data similar to CompanyManagementPage
                const mappedCompanies = (companiesData || []).map((item: any) => {
                    if (item.basicInfo) {
                        return {
                            code: item.code,
                            fullName: item.basicInfo.companyName,
                            shortName: item.shortName,
                            status: '生效'
                        };
                    }
                    return item;
                });
                setCompanies(mappedCompanies);
                setAllResponsibilities(responsibilitiesData || []);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedLevel1Code && insuranceTypes.level2) {
            const options = insuranceTypes.level2
                .filter((l2: any) => l2.code.charAt(0) === selectedLevel1Code)
                .map((l2: any) => ({ code: l2.code, name: l2.name }));
            setLevel2Options(options);
        } else {
            setLevel2Options([]);
        }
    }, [selectedLevel1Code, insuranceTypes]);

    useEffect(() => {
        if (selectedLevel2Code && insuranceTypes?.mappings) {
            const options = insuranceTypes.mappings
                .filter((l3: any) => l3?.antLevel3Code?.slice(0, 3) === selectedLevel2Code)
                .map((l3: any) => ({ code: l3.antLevel3Code, name: l3.antLevel3Name }));
            setLevel3Options(options);
        } else {
            setLevel3Options([]);
        }
    }, [selectedLevel2Code, insuranceTypes]);


    const handleLevel1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const l1Data = insuranceTypes.level1.find((l: any) => l.name === value);
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
            const l1Data = insuranceTypes.level1?.find((l: any) => l.code === selectedLevel1Code);
            const l2Data = insuranceTypes.level2?.find((l: any) => l.code === selectedLevel2Code);
            const l3Data = insuranceTypes.mappings?.find((l: any) => l.antLevel3Code === code);

            const legacyCategory = mapToLegacyCategory(l1Data?.name || '', l2Data?.name || '');

            setNewClause({
                ...initialClause,
                productCode: initialClause?.productCode || generateClauseCode(companyCode, legacyCategory),
                regulatoryName: initialClause?.regulatoryName || '',
                companyName: initialClause?.companyName || (
                    companyCode ? (companies.find(c => c.code === companyCode)?.shortName || '') : (companies.find(c => c.status === '生效')?.shortName || '')
                ),
                status: initialClause?.status || ProductStatus.DRAFT,
                clauseType: initialClause?.clauseType || ClauseType.MAIN,
                effectiveDate: initialClause?.effectiveDate || new Date().toISOString().split('T')[0],
                discontinuationDate: initialClause?.discontinuationDate || new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],

                // New Classification Fields
                categoryLevel1Code: l1Data?.code,
                categoryLevel1Name: l1Data?.name,
                categoryLevel2Code: l2Data?.code,
                categoryLevel2Name: l2Data?.name,
                categoryLevel3Code: l3Data?.antLevel3Code,
                categoryLevel3Name: l3Data?.antLevel3Name,

                // Legacy Fields
                primaryCategory: legacyCategory,
                secondaryCategory: l2Data?.name || '',

                clauseTextFile: initialClause?.clauseTextFile || '',
                rateTableFile: initialClause?.rateTableFile || '',
                productDescriptionFile: initialClause?.productDescriptionFile || '',
                cashValueTableFile: initialClause?.cashValueTableFile || '',
                basicSumInsuredTableFile: initialClause?.basicSumInsuredTableFile || '',
                selectedResponsibilities: initialClause?.selectedResponsibilities || [],
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

    const handleResponsibilityToggle = (resp: any) => {
        if (!newClause) return;
        const current = newClause.selectedResponsibilities || [];
        const exists = current.find(r => r.id === resp.id);
        const updated = exists
            ? current.filter(r => r.id !== resp.id)
            : [...current, resp];
        setNewClause({ ...newClause, selectedResponsibilities: updated });
    };



    const handleSave = async () => {
        if (!newClause) return;

        try {
            if (initialClause) {
                // Edit Mode: Fetch list -> Update item -> Save list
                const list = (await api.clauses.list()) as Clause[];
                const updatedList = list.map(c => c.productCode === initialClause.productCode ? newClause : c) as Clause[];
                // If not found (shouldn't happen), assume append? No, just save list.
                // If the code changed (not possible as it is disabled), we are good.
                await api.clauses.saveAll(updatedList);
                alert('条款已修改！');
            } else {
                // Add Mode
                await api.clauses.add(newClause);
                alert('条款已保存！');
            }
            onBack();
        } catch (error) {
            console.error('Failed to save clause:', error);
            alert('保存失败，请重试');
        }
    };

    const CASH_VALUE_CATEGORIES: PrimaryCategory[] = [
        PrimaryCategory.ANNUITY,
        PrimaryCategory.WHOLE_LIFE,
        PrimaryCategory.TERM_LIFE,
        PrimaryCategory.CRITICAL_ILLNESS
    ];

    const showCashValueUpload = newClause?.primaryCategory && CASH_VALUE_CATEGORIES.includes(newClause.primaryCategory);

    const BASIC_SUM_INSURED_CATEGORIES: PrimaryCategory[] = [
        PrimaryCategory.ANNUITY,
        PrimaryCategory.WHOLE_LIFE,
    ];
    const showBasicSumInsuredUpload = newClause?.primaryCategory && BASIC_SUM_INSURED_CATEGORIES.includes(newClause.primaryCategory);

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
                                {insuranceTypes.level1.map((cat: any) => <option key={cat.code} value={cat.name}>{cat.name}</option>)}
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
                                    ({selectedLevel1Name} &gt; {insuranceTypes.level2.find((l: any) => l.code === selectedLevel2Code)?.name || ''} &gt; {newClause.categoryLevel3Name})
                                </span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="条款代码" id="productCode" name="productCode" value={newClause?.productCode || ''} disabled />
                            <Input label="条款名称" id="regulatoryName" name="regulatoryName" value={newClause?.regulatoryName || ''} onChange={handleChange} placeholder="例如：新版健康医疗保险" required />
                            <Select label="保险公司名称" id="companyName" name="companyName" value={newClause?.companyName || ''} onChange={handleChange}>
                                <option value="">-- 请选择 --</option>
                                {companies.filter(c => c.status === '生效' && (!companyCode || c.code === companyCode)).map(c => (
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

                        <div className="space-y-6 pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">条款文件上传</h3>
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
                                {showBasicSumInsuredUpload && (
                                    <FileUpload
                                        label="基本保险金额表"
                                        id="basicSumInsuredTableFile"
                                        value={newClause?.basicSumInsuredTableFile}
                                        onChange={(value) => handleFileChange('basicSumInsuredTableFile', value)}
                                        helpText="上传基本保险金额表Excel文件"
                                        accept=".xls,.xlsx"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Responsibility Association Section */}
                        <div className="space-y-6 pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">责任关联</h3>
                            <p className="text-sm text-gray-500">选择该条款包含的保障责任。已按险种分类为您筛选建议责任。</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-gray-100 p-4 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                                {allResponsibilities
                                    .filter(resp => !newClause.primaryCategory || resp.category === newClause.primaryCategory)
                                    .map(resp => (
                                        <div
                                            key={resp.id}
                                            className={`flex items-start p-3 rounded-md border transition-all cursor-pointer ${newClause.selectedResponsibilities?.find(r => r.id === resp.id)
                                                    ? 'bg-brand-blue-50 border-brand-blue-200 ring-1 ring-brand-blue-200'
                                                    : 'bg-white border-gray-200 hover:border-brand-blue-300'
                                                }`}
                                            onClick={() => handleResponsibilityToggle(resp)}
                                        >
                                            <div className="flex items-center h-5 mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={!!newClause.selectedResponsibilities?.find(r => r.id === resp.id)}
                                                    onChange={() => { }} // Handled by div click
                                                    className="h-4 w-4 text-brand-blue-600 border-gray-300 rounded focus:ring-brand-blue-500"
                                                />
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label className="font-medium text-gray-700">{resp.name}</label>
                                                <p className="text-gray-500 text-xs line-clamp-1">{resp.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                {allResponsibilities.filter(resp => !newClause.primaryCategory || resp.category === newClause.primaryCategory).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-400">
                                        该险种下暂无可选责任
                                    </div>
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
