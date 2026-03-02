import React, { useState, useEffect, useRef } from 'react';
import { type HospitalInfo } from '../../types';
import { api } from '../../services/api';

interface HospitalSelectorProps {
  value: string;
  onChange: (hospitalName: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const HospitalSelector: React.FC<HospitalSelectorProps> = ({
  value,
  onChange,
  placeholder = '请搜索或输入就诊医院名称',
  required = false,
  className = '',
}) => {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const data = await api.hospitalInfo.list() as HospitalInfo[];
        setHospitals(data || []);
      } catch (error) {
        console.error('Failed to fetch hospitals:', error);
        setHospitals([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    setSearchQuery(value || '');
  }, [value]);

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 筛选医院
  const filteredHospitals = hospitals.filter((hospital) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      hospital.name.toLowerCase().includes(query) ||
      hospital.city.toLowerCase().includes(query) ||
      hospital.province.toLowerCase().includes(query) ||
      (hospital.address && hospital.address.toLowerCase().includes(query))
    );
  });

  // 优先显示合规医院
  const sortedHospitals = [...filteredHospitals].sort((a, b) => {
    if (a.qualifiedForInsurance === b.qualifiedForInsurance) return 0;
    return a.qualifiedForInsurance ? -1 : 1;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectHospital = (hospital: HospitalInfo) => {
    setSearchQuery(hospital.name);
    onChange(hospital.name);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const getProvinceLabel = (provinceCode: string): string => {
    const provinceMap: Record<string, string> = {
      beijing: '北京', tianjin: '天津', hebei: '河北', shanxi: '山西',
      neimenggu: '内蒙古', liaoning: '辽宁', jilin: '吉林', heilongjiang: '黑龙江',
      shanghai: '上海', jiangsu: '江苏', zhejiang: '浙江', anhui: '安徽',
      fujian: '福建', jiangxi: '江西', shandong: '山东', henan: '河南',
      hubei: '湖北', hunan: '湖南', guangdong: '广东', guangxi: '广西',
      hainan: '海南', chongqing: '重庆', sichuan: '四川', guizhou: '贵州',
      yunnan: '云南', xizang: '西藏', shaanxi: '陕西', gansu: '甘肃',
      qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆',
    };
    return provinceMap[provinceCode] || provinceCode;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
        {!isLoading && searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              onChange('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 下拉列表 */}
      {isOpen && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {sortedHospitals.length > 0 ? (
            <div className="py-1">
              {sortedHospitals.slice(0, 50).map((hospital) => (
                <button
                  key={hospital.id}
                  type="button"
                  onClick={() => handleSelectHospital(hospital)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {hospital.name}
                        </span>
                        {hospital.qualifiedForInsurance ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 shrink-0">
                            合规
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-100 shrink-0">
                            不合规
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getProvinceLabel(hospital.province)}</span>
                        <span>·</span>
                        <span>{hospital.city}</span>
                        <span>·</span>
                        <span>{hospital.level}</span>
                        <span>·</span>
                        <span>{hospital.type}</span>
                      </div>
                      {hospital.address && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {hospital.address}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {sortedHospitals.length > 50 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
                  显示前50条结果，请输入更多关键词缩小范围
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-gray-600 mb-1">未找到匹配的医院</p>
              <p className="text-xs text-gray-400">
                {searchQuery ? '您可以直接输入医院名称' : '请输入关键词搜索医院'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalSelector;
