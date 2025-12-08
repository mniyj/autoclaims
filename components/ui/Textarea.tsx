import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {props.required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        id={id}
        {...props}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm"
      />
    </div>
  );
};

export default Textarea;
