import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {props.required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm disabled:bg-gray-100"
      />
    </div>
  );
};

export default Input;
