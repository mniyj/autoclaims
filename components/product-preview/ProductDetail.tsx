import React, { useState } from 'react';
import { type InsuranceProduct, PrimaryCategory } from '../../types';
import ValueAddedServiceModal from './ValueAddedServiceModal';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  headerClassName?: string;
}

const Section: React.FC<SectionProps> = ({ title, children, action, className = '', icon, headerClassName = '' }) => (
    <div className={`bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-3 overflow-hidden ${className}`}>
      <div className={`px-4 py-3 flex justify-between items-center ${headerClassName}`}>
        <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 pb-4 pt-1">
        {children}
      </div>
    </div>
);

const DetailItem: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
    value ? (
    <div className="py-2.5 flex justify-between items-start text-[13px]">
        <dt className="text-gray-500 flex-shrink-0 mr-4 min-w-[4em]">{label}</dt>
        <dd className="text-gray-900 font-bold text-right break-all">{value}</dd>
    </div>
    ) : null
);

const ProductDetail: React.FC<{ product: InsuranceProduct }> = ({ product }) => {
  const [isVasModalOpen, setIsVasModalOpen] = useState(false);
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  
  const hasValueAddedServices = (product.primaryCategory === PrimaryCategory.HEALTH || product.primaryCategory === PrimaryCategory.ACCIDENT || product.primaryCategory === PrimaryCategory.CRITICAL_ILLNESS) && product.valueAddedServices && product.valueAddedServices.length > 0;
  
  const getNoticeItems = () => {
    const common = [
      { label: '投保年龄', value: product.underwritingAge },
      { label: '保障期间', value: product.coveragePeriod },
    ];

    switch (product.primaryCategory) {
      case PrimaryCategory.ACCIDENT:
        return [
          ...common,
          { label: '保障区域', value: (product as any).coverageArea },
          { label: '医院范围', value: (product as any).hospitalScope },
          { label: '赔付范围', value: (product as any).claimScope },
          { label: '投保职业', value: (product as any).occupationScope },
          { label: '犹豫期', value: (product as any).hesitationPeriod },
          { label: '等待期', value: product.waitingPeriod },
          { label: '保单生效日', value: (product as any).policyEffectiveDate },
          { label: '购买份数', value: (product as any).purchaseLimit },
        ];
      case PrimaryCategory.HEALTH:
        return [
          ...common,
          { label: '保障区域', value: (product as any).coverageArea },
          { label: '医院范围', value: (product as any).hospitalScope },
          { label: '赔付范围', value: (product as any).claimScope },
          { label: '投保职业', value: (product as any).occupationScope },
          { label: '犹豫期', value: (product as any).hesitationPeriod },
          { label: '等待期', value: product.waitingPeriod },
          { label: '保单生效日', value: (product as any).policyEffectiveDate },
          { label: '健康告知', value: (product as any).healthConditionNotice },
          { label: '购买份数', value: (product as any).purchaseLimit },
        ];
      case PrimaryCategory.CRITICAL_ILLNESS:
        return [
          ...common,
          { label: '交费方式', value: (product as any).paymentMethod || (product as any).paymentFrequency },
          { label: '交费期间', value: (product as any).paymentPeriod },
          { label: '等待期', value: product.waitingPeriod },
          { label: '投保职业', value: (product as any).occupationScope },
        ];
      case PrimaryCategory.ANNUITY:
        return [
          ...common,
          { label: '交费方式', value: (product as any).paymentMethod },
          { label: '交费期间', value: (product as any).paymentPeriod },
          { label: '领取年龄', value: (product as any).payoutStartAge },
          { label: '投保职业', value: (product as any).underwritingOccupation },
        ];
      case PrimaryCategory.WHOLE_LIFE:
        const items = [
          ...common,
          { label: '交费频率', value: (product as any).paymentFrequency },
          { label: '交费期间', value: (product as any).paymentPeriod },
        ];
        if ((product as any).partialSurrenderRules) {
             items.push(
                { label: '减保支持', value: (product as any).partialSurrenderRules.is_available ? '支持' : '不支持' },
                { label: '起始保单年度', value: (product as any).partialSurrenderRules.start_policy_year },
                { label: '每年次数上限', value: (product as any).partialSurrenderRules.frequency_per_year },
                { label: '单次最低金额(元)', value: (product as any).partialSurrenderRules.min_amount_per_request },
                { label: '单次最高比例', value: (product as any).partialSurrenderRules.max_ratio_per_request !== undefined ? `${Math.round(((product as any).partialSurrenderRules.max_ratio_per_request || 0) * 100)}%` : undefined },
                { label: '最低剩余保费(元)', value: (product as any).partialSurrenderRules.min_remaining_premium }
             );
        }
        return items;
      case PrimaryCategory.TERM_LIFE:
          return [
              ...common,
              { label: '等待期', value: product.waitingPeriod },
              { label: '基本保额', value: (product as any).basicSumAssured ? `最高 ${(product as any).basicSumAssured / 10000}万` : undefined },
              { label: '交费期间', value: (product as any).paymentPeriod },
              { label: '投保职业', value: (product as any).underwritingOccupation },
          ];
      default:
        return [
          ...common,
          { label: '等待期', value: product.waitingPeriod },
          { label: '免赔额', value: (product as any).deductible },
          { label: '交费频率', value: (product as any).paymentFrequency },
          { label: '交费期间', value: (product as any).paymentPeriod },
        ];
    }
  };

  const noticeItems = getNoticeItems();

  // Helper to generate tags
  const tags = [];
  if (product.supportsOnlineClaim) tags.push({ text: '在线理赔', type: 'green' });
  if (product.waitingPeriod) tags.push({ text: `等待期${product.waitingPeriod}`, type: 'blue' });

  return (
    <div className="relative bg-[#f0f4f8] h-full flex flex-col overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Header with Gradient */}
        <div className={`relative px-5 pt-6 pb-8 bg-gradient-to-b from-white to-[#f0f4f8] z-10`}>
             {product.productHeroImage && (
                 <>
                    <img 
                        src={product.productHeroImage} 
                        alt={product.marketingName} 
                        className="absolute inset-0 w-full h-48 object-cover z-0 opacity-20 mask-image-gradient"
                        referrerPolicy="no-referrer"
                    />
                 </>
             )}

             <div className="relative z-10">
                <h1 className="text-xl font-bold leading-tight mb-2 text-gray-900">{product.marketingName}</h1>
                {product.productSummary && <p className="text-gray-500 text-xs leading-relaxed mb-3">{product.productSummary}</p>}
                
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${tag.type === 'green' ? 'bg-[#e6f7f4] text-[#00b69b]' : 'bg-[#eef6ff] text-[#3b82f6]'}`}>
                            {tag.text}
                        </span>
                    ))}
                </div>
             </div>
        </div>

        <div className="px-3 relative z-20 space-y-3">
          {(product as any).coveragePlans && (product as any).coveragePlans.length > 0 && (product as any).coveragePlans[activePlanIdx] && (
            <Section 
                title="保障计划"
                icon={
                    <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                }
                headerClassName="bg-gradient-to-r from-blue-50/50 to-transparent"
            >
              <div className="space-y-3">
                {(product as any).coveragePlans.length > 1 && (
                <div className="flex items-center gap-6 border-b border-gray-100 pb-2 mb-2">
                  {(product as any).coveragePlans.map((p: any, i: number) => (
                    <button 
                        key={i} 
                        onClick={() => setActivePlanIdx(i)} 
                        className={`text-[13px] font-medium transition-colors relative pb-1 ${activePlanIdx === i ? 'text-blue-600' : 'text-gray-500'}`}
                    >
                      {p?.planType || `方案${i + 1}`}
                      {activePlanIdx === i && <span className="absolute bottom-[-9px] left-0 right-0 h-[2px] bg-blue-600 rounded-t-full"></span>}
                    </button>
                  ))}
                </div>
                )}
                {(() => {
                  const p = (product as any).coveragePlans[activePlanIdx];
                  if (!p) return null;
                  return (
                    <div className="rounded-md">
                      {p?.coverageDetails && p.coverageDetails.length > 0 && (
                        <div className="space-y-3">
                          {p.coverageDetails.map((d: any, di: number) => (
                            d?.item_name ? (
                              <div key={di} className="flex items-start justify-between gap-2 text-[13px]">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-gray-800 font-medium">{d.item_name}</span>
                                  <span className={`px-1 text-[10px] rounded border ${d.mandatory ? 'border-blue-300 text-blue-500' : 'border-gray-300 text-gray-500'}`}>{d.mandatory ? '必选' : '可选'}</span>
                                </div>
                                {d.description && <span className="text-xs text-gray-400 text-right flex-1 ml-4 leading-tight">{d.description}</span>}
                              </div>
                            ) : (
                              <div key={di} className="flex items-start justify-between gap-2 text-[13px]">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-gray-800 font-medium">{d?.name || '-'}</span>
                                  <span className={`px-1 text-[10px] rounded border ${(d as any)?.mandatory ? 'border-blue-300 text-blue-500' : 'border-gray-300 text-gray-500'}`}>{(d as any)?.mandatory ? '必选' : '可选'}</span>
                                </div>
                                {d?.details && <span className="text-xs text-gray-400 text-right flex-1 ml-4 leading-tight">{d.details}</span>}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Section>
          )}

          
          
          {/* Basic Info Section */}
          <Section 
            title="投保须知"
            icon={
                <div className="w-5 h-5 flex items-center justify-center text-orange-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
            }
          >
              <div className="divide-y divide-gray-50/50">
                  {noticeItems.map((item, i) => (
                      <DetailItem key={i} label={item.label} value={item.value} />
                  ))}
                  { product.primaryCategory === PrimaryCategory.WHOLE_LIFE && (product as any).partialSurrenderRules && (product as any).partialSurrenderRules.description &&
                      <div className="py-2 text-xs text-gray-600">{(product as any).partialSurrenderRules.description}</div>
                  }
              </div>
          </Section>

          { product.primaryCategory === PrimaryCategory.WHOLE_LIFE && (product as any).coverageDetails && (product as any).coverageDetails.length > 0 && (
            <Section title="保障责任">
              <div className="space-y-3">
                {(product as any).coverageDetails.map((d: any, i: number) => (
                  <div key={i} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <span>{d.item_name}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${d.mandatory ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{d.mandatory ? '必选' : '可选'}</span>
                      </div>
                      <div className="text-xs text-gray-600 font-mono">{d.item_code}</div>
                    </div>
                    {d.description && <div className="text-xs text-gray-500 mt-1">{d.description}</div>}
                    <div className="mt-2 text-xs text-gray-700">{d.details?.payout_logic}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          
          {/* Value-added Services Section */}
          {hasValueAddedServices && (
              <Section 
                title="增值服务" 
                icon={
                    <div className="w-5 h-5 flex items-center justify-center text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                }
                action={
                  <button onClick={() => setIsVasModalOpen(true)} className="flex items-center text-xs text-gray-400 hover:text-blue-600 transition-colors">
                    全部服务
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                }
              >
                  <div className="grid grid-cols-2 gap-3">
                      {product.valueAddedServices.map(service => (
                          <div key={service.id} className="flex items-center justify-center p-2 bg-gray-50 rounded-lg text-center">
                              <span className="text-xs font-medium text-gray-700 line-clamp-1">{service.name}</span>
                          </div>
                      ))}
                  </div>
              </Section>
          )}
          


          {(product as any).productIntroduction && (
            <Section title="产品介绍">
              <div className="text-sm text-gray-800 whitespace-pre-line">{(product as any).productIntroduction}</div>
            </Section>
          )}
          {(product as any).productAdvantages && (
            <Section title="产品亮点">
              <div className="space-y-1 text-sm text-gray-800 whitespace-pre-line">{(product as any).productAdvantages}</div>
            </Section>
          )}
          {(product as any).precautions && (
            <Section title="注意事项">
              <div className="text-sm text-gray-800 whitespace-pre-line">{(product as any).precautions}</div>
            </Section>
          )}
          {((product as any).crowd || (product as any).generalComment) && (
            <Section title="更多信息">
              <div className="space-y-2">
                <DetailItem label="适用人群" value={(product as any).crowd} />
                <DetailItem label="产品点评" value={(product as any).generalComment} />
              </div>
            </Section>
          )}
          
          
          {((product.productLongImage && product.productLongImage.length > 0) || (product.productAttachments && product.productAttachments.length > 0) || ((product as any).clausesCode && (product as any).clausesCode.length > 0)) && (
              <Section 
                title="产品资料"
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                }
              >
                  <div className="space-y-4">
                      {product.productLongImage && product.productLongImage.length > 0 && (
                          <div>
                              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">产品介绍</h4>
                              <div className="space-y-2">
                                {product.productLongImage.map((img, idx) => (
                                    <img key={idx} src={img} alt={`产品长图-${idx + 1}`} className="w-full rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                                ))}
                              </div>
                          </div>
                      )} 
                  </div>
              </Section>
          )}
                    <div className="px-1 py-4 text-xs text-gray-400">
            <span className="mr-1 text-gray-500 font-medium">请阅读</span>
            <span className="text-blue-600">服务协议</span>
            <span className="mx-1">|</span>
            <span className="text-blue-600">客户告知书</span>
            <span className="mx-1">|</span>
            <span className="text-blue-600">投保须知</span>
            <span className="mx-1">|</span>
            <span className="text-blue-600">保险条款</span>
          </div>
        </div>
        
      </div>

      {/* Sticky Footer Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white px-4 py-3 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4 z-30 safe-area-bottom">
          <div className="flex flex-col">
              <span className="text-xs text-gray-500">首年保费</span>
              <span className="text-xl font-bold text-red-500 font-mono leading-none">
                  ¥{product.annualPremium || '--'}
                  <span className="text-xs font-normal text-gray-500 ml-1">起</span>
              </span>
          </div>
          <button className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold py-2.5 px-4 rounded-full shadow-lg shadow-blue-200 transform active:scale-95 transition-all text-sm">
            我要投保
          </button>
      </div>

      {hasValueAddedServices && (
        <ValueAddedServiceModal 
          isOpen={isVasModalOpen}
          onClose={() => setIsVasModalOpen(false)}
          services={product.valueAddedServices}
        />
      )}
    </div>
  );
};

export default ProductDetail;
