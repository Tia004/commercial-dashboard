'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: string;
  isAction?: boolean;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Seleziona…',
  className = '',
  ariaLabel,
  size = 'md',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const heightClasses = size === 'sm' ? 'min-h-[34px] py-1.5 px-3 text-xs' : 'min-h-[38px] py-2 px-3 text-xs';

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2.5 rounded-lg border text-left font-medium transition-all cursor-pointer ${heightClasses} ${
          isOpen
            ? 'border-indigo-500 bg-indigo-50/60 text-zinc-950 shadow-none dark:border-indigo-400/40 dark:bg-[#16171d] dark:text-white [data-theme=oled]:bg-black'
            : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-[#121316] dark:hover:border-white/18 dark:hover:bg-[#15161c] dark:text-zinc-300 [data-theme=oled]:bg-black [data-theme=oled]:hover:bg-[#08080a]'
        }`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined text-[16px] text-zinc-500 dark:text-zinc-400">
              {selectedOption.icon}
            </span>
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>

        {/* Minimal Linear Chevron Arrow */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-200' : ''
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Custom Linear Floating Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-1 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#121316] [data-theme=oled]:bg-black dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <div className="flex flex-col gap-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;

              if (option.isAction) {
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04] transition-colors text-left border-t border-zinc-200/80 dark:border-white/[0.06] mt-1 pt-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px] text-indigo-500">add</span>
                    <span>{option.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-white/[0.08] dark:text-white'
                      : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.04] dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {option.icon && (
                      <span className="material-symbols-outlined text-[15px] text-zinc-500 dark:text-zinc-400">
                        {option.icon}
                      </span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </span>

                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-indigo-600 dark:text-indigo-400"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
