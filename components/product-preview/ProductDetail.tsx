import React, { useState } from 'react';
import { type InsuranceProduct, PrimaryCategory } from '../../types';
import ValueAddedServiceModal from './ValueAddedServiceModal';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children, action, className = '', icon }) => (
    <div className={`bg-white rounded-xl shadow-sm mb-3 overflow-hidden ${className}`}>
      <div className="px-4 py-3.5 flex justify-between items-center border-b border-gray-50">
        <div className="flex items-center gap-2">
            {icon && <span className="text-blue-500">{icon}</span>}
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
);

const DetailItem: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
    value ? (
    <div className="py-2 flex justify-between items-start text-sm">
        <dt className="text-gray-500 flex-shrink-0 mr-4">{label}</dt>
        <dd className="text-gray-800 font-medium text-right break-all">{value}</dd>
    </div>
    ) : null
);

const ProductDetail: React.FC<{ product: InsuranceProduct }> = ({ product }) => {
  const [isVasModalOpen, setIsVasModalOpen] = useState(false);
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  
  const hasValueAddedServices = (product.primaryCategory === PrimaryCategory.HEALTH || product.primaryCategory === PrimaryCategory.ACCIDENT || product.primaryCategory === PrimaryCategory.CRITICAL_ILLNESS) && product.valueAddedServices && product.valueAddedServices.length > 0;
  
  // Helper to generate tags
  const tags = [];
  if (product.supportsOnlineClaim) tags.push('在线理赔');
  if (product.waitingPeriod) tags.push(`等待期${product.waitingPeriod}`);

  return (
    <div className="relative bg-[#f5f7fa] h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header with Gradient */}
        <div className={`relative px-5 pt-6 pb-12 text-white rounded-b-[2rem] shadow-sm overflow-hidden ${!product.productHeroImage ? 'bg-gradient-to-br from-blue-600 to-blue-500' : ''}`}>
             {product.productHeroImage && (
                 <>
                    <img 
                        src={product.productHeroImage} 
                        alt={product.marketingName} 
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70 z-0" />
                 </>
             )}

             {!product.productHeroImage && (
                 <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 z-0">
                    <svg width="200" height="200" viewBox="0 0 200 200" fill="currentColor">
                        <circle cx="100" cy="100" r="100" />
                    </svg>
                 </div>
             )}
             
             <div className="relative z-10">
                <h1 className="text-xl font-bold leading-tight mb-2">{product.marketingName}</h1>
                {product.productSummary && <p className="text-white/90 text-xs leading-relaxed">{product.productSummary}</p>}
                
                <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] font-medium border border-white/30">
                            {tag}
                        </span>
                    ))}
                </div>
             </div>
        </div>

        <div className="px-3 -mt-6 relative z-20 space-y-3">
          {(product as any).coveragePlans && (product as any).coveragePlans.length > 0 && (
            <Section title="保障计划">
              <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {(product as any).coveragePlans.map((p: any, i: number) => (
                    <button key={i} onClick={() => setActivePlanIdx(i)} className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${activePlanIdx === i ? 'bg-brand-blue-600 text-white border-brand-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                      {p.planType || `方案${i + 1}`}
                    </button>
                  ))}
                </div>
                {(() => {
                  const p = (product as any).coveragePlans[activePlanIdx] || {};
                  return (
                    <div className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-gray-800">{p.planType}</div>
                        <div className="text-xs text-gray-600">{p?.guaranteedRenewalYears ? `保证续保${p.guaranteedRenewalYears}年` : ''}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{p?.annualLimit ? `年度总保额：${p.annualLimit}` : ''}</div>
                      {p?.coverageDetails && p.coverageDetails.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {p.coverageDetails.map((d: any, di: number) => (
                            d.item_name ? (
                              <div key={di} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-800 font-medium">{d.item_name}</span>
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${d.mandatory ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{d.mandatory ? '必选' : '可选'}</span>
                                </div>
                                <div className="md:col-span-2 text-right text-gray-800">
                                  {typeof d.details?.limit === 'number' && (<div>{`限额${d.details.limit}元`}</div>)}
                                  {typeof d.details?.reimbursement_ratio === 'number' && (<div>{`赔付比例${Math.round(d.details.reimbursement_ratio * 100)}%`}</div>)}
                                  {typeof d.details?.deductible === 'number' && (<div>{`免赔${d.details.deductible}元`}</div>)}
                                  {typeof d.details?.payout_ratio === 'number' && (<div>{`单次赔付${Math.round(d.details.payout_ratio * 100)}%`}</div>)}
                                  {Array.isArray(d.details?.payout_ratios) && d.details.payout_ratios.length > 0 && (
                                    <div className="text-xs text-gray-600">多次赔付：{d.details.payout_ratios.map((x: number) => `${Math.round(x * 100)}%`).join(' / ')}</div>
                                  )}
                                  {typeof d.details?.max_payouts === 'number' && d.details.max_payouts > 0 && (<div className="text-xs text-gray-600">最多次：{d.details.max_payouts}</div>)}
                                  {typeof d.details?.interval_years === 'number' && d.details.interval_years > 0 && (<div className="text-xs text-gray-600">间隔期：{d.details.interval_years}年</div>)}
                                  {typeof d.details?.payout_multiplier === 'number' && (<div className="text-xs text-gray-600">额外赔付倍数：{d.details.payout_multiplier}x</div>)}
                                  {typeof d.details?.additional_limit === 'number' && (<div className="text-xs text-gray-600">额外限额：{d.details.additional_limit}元</div>)}
                                  {typeof d.details?.amount_per_day === 'number' && (<div className="text-xs text-gray-600">日额：{d.details.amount_per_day}元</div>)}
                                  {typeof d.details?.deductible_days === 'number' && (<div className="text-xs text-gray-600">免赔天数：{d.details.deductible_days}天</div>)}
                                  {typeof d.details?.max_days === 'number' && (<div className="text-xs text-gray-600">最高天数：{d.details.max_days}天</div>)}
                                  {d.details?.scenario && (<div className="text-xs text-gray-600">场景：{d.details.scenario}</div>)}
                                  {Array.isArray(d.details?.start_age_options) && d.details.start_age_options.length > 0 && (<div className="text-xs text-gray-600">起领年龄：{d.details.start_age_options.join(' / ')}</div>)}
                                  {Array.isArray(d.details?.frequency_options) && d.details.frequency_options.length > 0 && (
                                    <div className="text-xs text-gray-600">领取频率：{d.details.frequency_options.map((f: string) => f === 'ANNUALLY' ? '年领' : '月领').join(' / ')}</div>
                                  )}
                                  {typeof d.details?.guaranteed_period_years === 'number' && d.details.guaranteed_period_years > 0 && (<div className="text-xs text-gray-600">保证领取：{d.details.guaranteed_period_years}年</div>)}
                                </div>
                              </div>
                            ) : (
                              <div key={di} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-800 font-medium">{d.name}</span>
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${(d as any).mandatory ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{(d as any).mandatory ? '必选' : '可选'}</span>
                                </div>
                                <div className="md:col-span-2 text-right text-gray-800">
                                  <div>{d.amount}</div>
                                  <div className="text-xs text-gray-600">{d.details}</div>
                                </div>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            }
          >
              <div className="divide-y divide-gray-50">
                  <DetailItem label="投保年龄" value={product.underwritingAge} />
                  <DetailItem label="保障期限" value={product.coveragePeriod} />
                  <DetailItem label="等待期" value={product.waitingPeriod} />
                  <DetailItem label="免赔额" value={(product as any).deductible} />
                  <DetailItem label="有效保额增长率" value={(product as any).effectiveAmountGrowthRate !== undefined ? `${Math.round(((product as any).effectiveAmountGrowthRate || 0) * 10000) / 100}%` : undefined} />
                  <DetailItem label="交费频率" value={(product as any).paymentFrequency} />
                  <DetailItem label="交费期间" value={(product as any).paymentPeriod} />
                  
                  { (product.primaryCategory === PrimaryCategory.HEALTH || product.primaryCategory === PrimaryCategory.ACCIDENT || product.primaryCategory === PrimaryCategory.CRITICAL_ILLNESS) &&
                      <>
                          <DetailItem label="保障区域" value={product.coverageArea} />
                          <DetailItem label="医院范围" value={product.hospitalScope} />
                          <DetailItem label="职业范围" value={product.occupationScope} />
                          <DetailItem label="续保描述" value={(product as any).renewalWarranty} />
                          <DetailItem label="院外特药保障" value={(product as any).outHospitalMedicine} />
                          <DetailItem label="健康告知" value={(product as any).healthConditionNotice} />
                      </>
                  }
                  { product.primaryCategory === PrimaryCategory.TERM_LIFE &&
                      <>
                          <DetailItem label="基本保额" value={`最高 ${product.basicSumAssured / 10000}万`} />
                          <DetailItem label="交费期间" value={product.paymentPeriod} />
                      </>
                  }
                  { product.primaryCategory === PrimaryCategory.WHOLE_LIFE && (product as any).partialSurrenderRules &&
                      <>
                        <DetailItem label="减保支持" value={(product as any).partialSurrenderRules.is_available ? '支持' : '不支持'} />
                        <DetailItem label="起始保单年度" value={(product as any).partialSurrenderRules.start_policy_year} />
                        <DetailItem label="每年次数上限" value={(product as any).partialSurrenderRules.frequency_per_year} />
                        <DetailItem label="单次最低金额(元)" value={(product as any).partialSurrenderRules.min_amount_per_request} />
                        <DetailItem label="单次最高比例" value={(product as any).partialSurrenderRules.max_ratio_per_request !== undefined ? `${Math.round(((product as any).partialSurrenderRules.max_ratio_per_request || 0) * 100)}%` : undefined} />
                        <DetailItem label="最低剩余保费(元)" value={(product as any).partialSurrenderRules.min_remaining_premium} />
                        {(product as any).partialSurrenderRules.description && <div className="py-2 text-xs text-gray-600">{(product as any).partialSurrenderRules.description}</div>}
                      </>
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
          
          {/* Value-added Services Section */}
          {hasValueAddedServices && (
              <Section 
                title="增值服务" 
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
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
                          <div key={service.id} className="flex items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mr-2 text-orange-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className="text-xs font-medium text-gray-700 line-clamp-2">{service.name}</span>
                          </div>
                      ))}
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
                      {product.productAttachments && product.productAttachments.length > 0 && (
                          <div>
                              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">相关条款</h4>
                              <div className="space-y-2">
                                {product.productAttachments.map((attachment, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                        <div className='flex items-center min-w-0 gap-3'>
                                            <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-red-500 flex-shrink-0">
                                                <span className="text-[10px] font-bold">PDF</span>
                                            </div>
                                            <span className="text-sm text-gray-700 truncate font-medium">{attachment}</span>
                                        </div>
                                        <a href="#" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </a>
                                    </div>
                                ))}
                              </div>
                          </div>
                      )}
                      {(product as any).clausesCode && (product as any).clausesCode.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">条款代码</h4>
                          <div className="flex flex-wrap gap-2">
                            {(product as any).clausesCode.map((code: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded border border-gray-200">{code}</span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
              </Section>
          )}
        </div>
      </div>

      {/* Sticky Footer Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white px-4 py-3 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4 z-30">
          <div className="flex flex-col">
              <span className="text-xs text-gray-500">首年保费</span>
              <span className="text-xl font-bold text-red-500 font-mono">
                  ¥{product.annualPremium || '--'}
                  <span className="text-xs font-normal text-gray-500 ml-1">起</span>
              </span>
          </div>
          <a
            href={product.salesUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 block text-center font-bold py-2.5 px-4 rounded-full transition-all shadow-lg shadow-blue-200 ${
                product.salesUrl 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-blue-300 transform hover:-translate-y-0.5' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            立即投保
          </a>
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
