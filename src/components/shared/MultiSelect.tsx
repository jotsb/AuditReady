import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  formatLabel?: (value: string) => string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  formatLabel
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const selectAll = () => {
    onChange(options);
  };

  const clearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return formatLabel ? formatLabel(selected[0]) : selected[0];
    }
    if (selected.length === options.length) return 'All selected';
    return `${selected.length} selected`;
  };

  const formatOptionLabel = (option: string) => {
    if (formatLabel) return formatLabel(option);
    return option.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:border-slate-400 dark:hover:border-gray-500 transition"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
          {getDisplayText()}
        </span>
        <ChevronDown
          size={20}
          className={`text-slate-400 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* Header with Select All / Clear All */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-gray-400">
              {selected.length} of {options.length} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-slate-600 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48">
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={`w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition flex items-center justify-between group ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-700 dark:text-gray-300'}`}>
                    {formatOptionLabel(option)}
                  </span>
                  {isSelected && (
                    <Check size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.slice(0, 5).map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md"
            >
              {formatLabel ? formatLabel(item) : formatOptionLabel(item)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(item);
                }}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {selected.length > 5 && (
            <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 text-xs rounded-md">
              +{selected.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
