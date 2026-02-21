import React, { useId } from 'react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  id?: string;
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
  onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLSelectElement>;
}

const Select: React.FC<SelectProps> = ({ label, id, options, placeholder, children, onChange, ...props }) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    if (!onChange) return;
    if (options) {
      (onChange as (value: string) => void)(event.target.value);
      return;
    }
    (onChange as React.ChangeEventHandler<HTMLSelectElement>)(event);
  };
  return (
    <div>
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {props.required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={selectId}
        {...props}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm"
      >
        {children || (
          <>
            {placeholder && <option value="">{placeholder}</option>}
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
};

export default Select;
