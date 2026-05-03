import { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

const FormInput = ({ 
  label, 
  name, 
  type = 'text', 
  value, 
  onChange, 
  placeholder = '',
  required = false,
  error = '',
  disabled = false,
  className = '',
  hint = '',
  submitted = false,
  loading = false,
  ...props 
}) => {
  const [touched, setTouched] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const hasValue = value && value.toString().trim().length > 0;
  const showSuccess = required && hasValue && !error && !loading && touched;
  // Show error if: field has error, OR (required AND (touched OR submitted) AND empty)
  const showRequiredError = required && (touched || submitted) && !hasValue && !error;
  const displayError = error || (showRequiredError ? 'This field is required' : '');
  
  // Trigger shake when submitted and field has error
  useEffect(() => {
    if (submitted && showRequiredError) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [submitted, showRequiredError]);
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={name} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {label}
          {required && <span className="text-red-500">*</span>}
          {!required && <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={() => setTouched(true)}
          onWheel={(e) => { if (type === 'number') e.target.blur(); }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all shadow-sm
            ${displayError 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20' 
              : showSuccess
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600 focus:border-primary-500 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-60' : ''}
            ${shouldShake ? 'animate-shake' : ''}
            focus:outline-none focus:ring-4 pr-10 dark:placeholder-gray-400
          `}
          {...props}
        />
        {/* Status Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading && <Loader2 size={18} className="text-blue-500 animate-spin" />}
          {!loading && displayError && <AlertCircle size={18} className="text-red-500" />}
          {!loading && showSuccess && !displayError && <Check size={18} className="text-green-500" />}
        </div>
      </div>
      {hint && !displayError && !loading && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {loading && <p className="mt-1.5 text-xs text-blue-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Checking availability...</p>}
      {displayError && !loading && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{displayError}</p>}
    </div>
  );
};

const FormSelect = ({ 
  label, 
  name, 
  value, 
  onChange, 
  options = [],
  placeholder = 'Select option',
  required = false,
  error = '',
  disabled = false,
  className = '',
  hint = '',
  submitted = false,
}) => {
  const [touched, setTouched] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const hasValue = value && value.toString().trim().length > 0;
  const showSuccess = required && hasValue && !error && touched;
  const showRequiredError = required && (touched || submitted) && !hasValue && !error;
  const displayError = error || (showRequiredError ? 'Please select an option' : '');
  
  // Trigger shake when submitted and field has error
  useEffect(() => {
    if (submitted && showRequiredError) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [submitted, showRequiredError]);
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={name} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {label}
          {required && <span className="text-red-500">*</span>}
          {!required && <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={() => setTouched(true)}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all appearance-none cursor-pointer shadow-sm pr-10
            ${displayError 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20' 
              : showSuccess
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600 focus:border-primary-500 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-60' : ''}
            ${shouldShake ? 'animate-shake' : ''}
            focus:outline-none focus:ring-4 dark:placeholder-gray-400
          `}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Dropdown Arrow + Status */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          {displayError && <AlertCircle size={16} className="text-red-500" />}
          {showSuccess && !displayError && <Check size={16} className="text-green-500" />}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {hint && !displayError && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {displayError && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{displayError}</p>}
    </div>
  );
};

const FormTextarea = ({ 
  label, 
  name, 
  value, 
  onChange, 
  placeholder = '',
  required = false,
  error = '',
  disabled = false,
  rows = 3,
  className = '',
  hint = '',
  submitted = false,
}) => {
  const [touched, setTouched] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const hasValue = value && value.toString().trim().length > 0;
  const showSuccess = required && hasValue && !error && touched;
  const showRequiredError = required && (touched || submitted) && !hasValue && !error;
  const displayError = error || (showRequiredError ? 'This field is required' : '');
  
  // Trigger shake when submitted and field has error
  useEffect(() => {
    if (submitted && showRequiredError) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [submitted, showRequiredError]);
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={name} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {label}
          {required && <span className="text-red-500">*</span>}
          {!required && <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all resize-none shadow-sm
            ${displayError 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20' 
              : showSuccess
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600 focus:border-primary-500 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-60' : ''}
            ${shouldShake ? 'animate-shake' : ''}
            focus:outline-none focus:ring-4 dark:placeholder-gray-400
          `}
        />
        {/* Status Icon */}
        <div className="absolute right-3 top-3">
          {displayError && <AlertCircle size={18} className="text-red-500" />}
          {showSuccess && !displayError && <Check size={18} className="text-green-500" />}
        </div>
      </div>
      {hint && !displayError && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {displayError && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{displayError}</p>}
    </div>
  );
};

export { FormInput, FormSelect, FormTextarea };