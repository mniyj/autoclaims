import React from 'react';

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, children, className }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

export default InfoCard;
