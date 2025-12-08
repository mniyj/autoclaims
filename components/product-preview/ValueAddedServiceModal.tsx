import React from 'react';
import { type ValueAddedServiceItem } from '../../types';

interface ValueAddedServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ValueAddedServiceItem[];
}

const ValueAddedServiceModal: React.FC<ValueAddedServiceModalProps> = ({ isOpen, onClose, services }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-50 rounded-xl shadow-xl w-full max-w-md m-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b bg-white rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">附赠服务详情</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {services.map(service => (
            <div key={service.id} className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900">{service.name}</h3>
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
         <div className="p-3 bg-white border-t rounded-b-xl">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-brand-blue-600 text-white font-semibold rounded-lg hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
            >
              关闭
            </button>
        </div>
      </div>
    </div>
  );
};

export default ValueAddedServiceModal;