import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ label, id, children, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {props.required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={id}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm"
      >
        {children}
      </select>
    </div>
  );
};

export default Select;
