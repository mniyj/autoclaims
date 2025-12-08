
import React from 'react';
import { type InsuranceProduct, PrimaryCategory } from '../../types';
import { PRODUCT_STATUSES, PRIMARY_CATEGORIES, MAPPING_DATA, REGULATORY_OPTIONS, LEVEL_1_DATA } from '../../constants';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FileUpload from '../ui/FileUpload';
import MultiImageUpload from '../ui/MultiImageUpload';
import TagEditor from './TagEditor';
import Textarea from '../ui/Textarea';

interface FormProps {
  product: InsuranceProduct;
  onFormChange: (field: keyof InsuranceProduct, value: any) => void;
}

const GeneralInfoForm: React.FC<FormProps> = ({ product, onFormChange }) => {
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onFormChange(e.target.name as keyof InsuranceProduct, e.target.value);
  };

  

  const handleFileChange = (field: keyof InsuranceProduct, value: string | string[]) => {
    onFormChange(field, value);
  }

  const handleTagsChange = (tags: string[]) => {
    onFormChange('tags', tags);
  };

  const handleTagStylesChange = (styles: Record<string, 'gold' | 'green' | 'red' | 'gray'>) => {
    onFormChange('tagStyles', styles);
  };

  const handleAddAttachment = (file: File | null) => {
    if (file) {
      const currentAttachments = product.productAttachments || [];
      onFormChange('productAttachments', [...currentAttachments, file.name]);
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    const currentAttachments = product.productAttachments || [];
    onFormChange('productAttachments', currentAttachments.filter((_, index) => index !== indexToRemove));
  };

  

  // Derive Classification Information
  const mapping = MAPPING_DATA.find(m => 
    (product.racewayId && m.antLevel3Code === product.racewayId) ||
    (product.secondaryCategory && m.antLevel2Name === product.secondaryCategory)
  );

  const antL1 = mapping?.antLevel1Name || (product.primaryCategoryCode ? (LEVEL_1_DATA.find(l => l.code === product.primaryCategoryCode)?.name || '-') : '-');
  const antL2 = product.secondaryCategory || mapping?.antLevel2Name || '-';
  const antL3 = product.racewayName || mapping?.antLevel3Name || '-';

  const regL2Name = mapping?.regLevel2Name || '-';
  let regL1Name = '-';
  
  if (mapping?.regLevel2Name) {
      // Find parent reg L1
      const regL1Group = REGULATORY_OPTIONS.find(l1 => l1.children.some(l2 => l2.name === mapping.regLevel2Name));
      if (regL1Group) regL1Name = regL1Group.name;
  }
    
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900">通用信息</h3>
        <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="产品代码" id="productCode" name="productCode" value={product.productCode} onChange={handleChange} disabled />
                    <Input label="保险公司名称" id="companyName" name="companyName" value={product.companyName} onChange={handleChange} disabled/>
                    <Input label="监管备案名称" id="regulatoryName" name="regulatoryName" value={product.regulatoryName} onChange={handleChange} disabled />
                    <Input label="市场宣传名称" id="marketingName" name="marketingName" value={product.marketingName} onChange={handleChange} required />
            </div>
            <Textarea label="产品摘要" id="productSummary" name="productSummary" value={product.productSummary || ''} onChange={handleChange} placeholder="在产品详情页顶部显示的简短介绍，可分点说明。" rows={3} required />
            <Textarea label="产品介绍" id="productIntroduction" name="productIntroduction" value={(product as any).productIntroduction || ''} onChange={handleChange} placeholder="详细产品介绍文案" rows={4} />
            <Textarea label="产品亮点" id="productAdvantages" name="productAdvantages" value={(product as any).productAdvantages || ''} onChange={handleChange} placeholder="多条亮点可用换行分隔" rows={3} />
            <Textarea label="注意事项" id="precautions" name="precautions" value={(product as any).precautions || ''} onChange={handleChange} placeholder="投保须知、责任免除等" rows={3} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Textarea label="适用人群" id="crowd" name="crowd" value={(product as any).crowd || ''} onChange={handleChange} placeholder="例如：少儿/老人/上班族" rows={3} />
              <Textarea label="产品点评" id="generalComment" name="generalComment" value={(product as any).generalComment || ''} onChange={handleChange} placeholder="专家或运营点评" rows={3} />
            </div>
            
            {/* Classification Section */}
            <div className="bg-blue-50 border border-blue-100 rounded-md p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">产品分类信息 (基于条款自动关联)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">蚂蚁一级分类</label>
                        <div className="text-sm text-gray-800 font-medium">{antL1}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">蚂蚁二级分类</label>
                        <div className="text-sm text-gray-800 font-medium">{antL2}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">蚂蚁三级分类</label>
                        <div className="text-sm text-gray-800 font-medium">{antL3}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">监管一级分类</label>
                        <div className="text-sm text-gray-800 font-medium">{regL1Name}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">监管二级分类</label>
                        <div className="text-sm text-gray-800 font-medium">{regL2Name}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="版本号" id="version" name="version" value={product.version} onChange={handleChange} required />
                    <Select label="状态" id="status" name="status" value={product.status} onChange={handleChange} required>
                        {PRODUCT_STATUSES.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                    </Select>
                    <Input label="生效日" id="effectiveDate" name="effectiveDate" type="date" value={product.effectiveDate} onChange={handleChange} required />
                    <Input label="停售日" id="discontinuationDate" name="discontinuationDate" type="date" value={product.discontinuationDate} onChange={handleChange} />
            </div>
            <Input label="销售落地页URL" id="salesUrl" name="salesUrl" type="url" value={product.salesUrl || ''} onChange={handleChange} placeholder="https://example.com/product-page" />
            <Input label="销售区域" id="salesRegions" name="salesRegions" value={product.salesRegions} onChange={handleChange} required />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">是否支持在线理赔 <span className="text-red-500">*</span></label>
                <div className="flex items-center space-x-6 mt-2">
                  <div className="flex items-center">
                    <input
                      id="supportsOnlineClaim-yes"
                      name="supportsOnlineClaim"
                      type="radio"
                      checked={product.supportsOnlineClaim === true}
                      onChange={() => onFormChange('supportsOnlineClaim', true)}
                      className="focus:ring-brand-blue-500 h-4 w-4 text-brand-blue-600 border-gray-300"
                    />
                    <label htmlFor="supportsOnlineClaim-yes" className="ml-2 block text-sm text-gray-900">
                      是
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="supportsOnlineClaim-no"
                      name="supportsOnlineClaim"
                      type="radio"
                      checked={product.supportsOnlineClaim === false}
                      onChange={() => onFormChange('supportsOnlineClaim', false)}
                      className="focus:ring-brand-blue-500 h-4 w-4 text-brand-blue-600 border-gray-300"
                    />
                    <label htmlFor="supportsOnlineClaim-no" className="ml-2 block text-sm text-gray-900">
                      否
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">是否支持在线退保 <span className="text-red-500">*</span></label>
                <div className="flex items-center space-x-6 mt-2">
                  <div className="flex items-center">
                    <input
                      id="isOnline-yes"
                      name="isOnline"
                      type="radio"
                      checked={product.isOnline === true}
                      onChange={() => onFormChange('isOnline', true)}
                      className="focus:ring-brand-blue-500 h-4 w-4 text-brand-blue-600 border-gray-300"
                    />
                    <label htmlFor="isOnline-yes" className="ml-2 block text-sm text-gray-900">
                      是
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="isOnline-no"
                      name="isOnline"
                      type="radio"
                      checked={product.isOnline === false}
                      onChange={() => onFormChange('isOnline', false)}
                      className="focus:ring-brand-blue-500 h-4 w-4 text-brand-blue-600 border-gray-300"
                    />
                    <label htmlFor="isOnline-no" className="ml-2 block text-sm text-gray-900">
                      否
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <FileUpload 
                        label="产品卡片配图" 
                        id="productCardImage" 
                        value={product.productCardImage} 
                        onChange={(value) => handleFileChange('productCardImage', value)}
                        helpText="限定方形尺寸，如 400x400（用于产品卡片展示）"
                        accept="image/png, image/jpeg, image/webp"
                        required
                    />
                    <FileUpload 
                        label="产品头图" 
                        id="productHeroImage" 
                        value={product.productHeroImage} 
                        onChange={(value) => handleFileChange('productHeroImage', value)}
                        helpText="建议上传方形图片，支持 PNG, JPG, WebP 格式"
                        accept="image/png, image/jpeg, image/webp"
                        required
                    />
                    <MultiImageUpload 
                        label="产品长图" 
                        id="productLongImage" 
                        values={product.productLongImage || []} 
                        onChange={(values) => handleFileChange('productLongImage', values)}
                        helpText="用于详情页展示，支持多张图片，按上传顺序展示"
                        accept="image/png, image/jpeg, image/webp"
                        required
                    />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                产品附件
                {(!product.productAttachments || product.productAttachments.length === 0) && <span className="text-red-500">*</span>}
              </label>
              <div className="mt-2 space-y-2">
                {product.productAttachments?.map((attachment, index) => (
                  <div key={index} className="flex items-center justify-between p-2 pl-3 border border-gray-200 rounded-md bg-gray-50 text-sm">
                    <div className="flex items-center min-w-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-gray-800 truncate">{attachment}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="ml-4 text-sm font-medium text-red-600 hover:text-red-800 flex-shrink-0"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label htmlFor="add-attachment-input" className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:text-brand-blue-600 hover:border-brand-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition flex justify-center items-center cursor-pointer">
                    + 添加附件
                </label>
                <input
                    type="file"
                    id="add-attachment-input"
                    className="sr-only"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                        if (e.target.files) {
                            handleAddAttachment(e.target.files[0]);
                            e.target.value = ''; // Allow re-uploading the same file
                        }
                    }}
                />
              </div>
            </div>

            

            

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="投保年龄" id="underwritingAge" name="underwritingAge" value={product.underwritingAge} onChange={handleChange} required />
                    <Input label="保障期限" id="coveragePeriod" name="coveragePeriod" value={product.coveragePeriod} onChange={handleChange} required />
                    <Input label="等待期" id="waitingPeriod" name="waitingPeriod" value={product.waitingPeriod} onChange={handleChange} required />
            </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-8">
         <h3 className="text-lg font-medium text-gray-900">产品卡片展示信息</h3>
         <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Input label="指标1标签" id="cardMetric1Label" name="cardMetric1Label" value={product.cardMetric1Label || ''} onChange={handleChange} placeholder="例如：保额" required />
                    <Input label="指标1内容" id="cardMetric1Value" name="cardMetric1Value" value={product.cardMetric1Value || ''} onChange={handleChange} placeholder="例如：最高50万" required />
                </div>
                 <div>
                    <Input label="指标2标签" id="cardMetric2Label" name="cardMetric2Label" value={product.cardMetric2Label || ''} onChange={handleChange} placeholder="例如：保障疾病" required />
                    <Input label="指标2内容" id="cardMetric2Value" name="cardMetric2Value" value={product.cardMetric2Value || ''} onChange={handleChange} placeholder="例如：最多180种" required />
                </div>
                 <div>
                    <Input label="指标3标签" id="cardMetric3Label" name="cardMetric3Label" value={product.cardMetric3Label || ''} onChange={handleChange} placeholder="例如：保障对象" required />
                    <Input label="指标3内容" id="cardMetric3Value" name="cardMetric3Value" value={product.cardMetric3Value || ''} onChange={handleChange} placeholder="例如：28天-65岁" required />
                </div>
            </div>
            <TagEditor 
                items={product.tags || []} 
                tagStyles={product.tagStyles || {}} 
                onChange={handleTagsChange} 
                onStyleChange={handleTagStylesChange}
            />
            <Input label="营销标语" id="promoTag" name="promoTag" value={product.promoTag || ''} onChange={handleChange} placeholder="例如：重疾险热销榜第1名" />
         </div>
      </div>
    </div>
  );
};

export default GeneralInfoForm;
