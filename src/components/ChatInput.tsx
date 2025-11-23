import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, ChevronDown, Database } from 'lucide-react';
import { Dataset } from '@/lib/chat-store.clean';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  datasets: Dataset[];
  selectedDataset: string | null;
  onDatasetChange: (datasetName: string | null) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, datasets, selectedDataset, onDatasetChange, disabled = false }: ChatInputProps) {
  const t = useTranslations();
  const [message, setMessage] = useState('');
  const [showDatasetDropdown, setShowDatasetDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'up' | 'down'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDatasetDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateDropdownPosition = () => {
    if (!dropdownRef.current) return 'down';

    const buttonRect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 200; // Approximate max height of dropdown

    // Check if there's enough space below (with some margin)
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      return 'up';
    }
    return 'down';
  };

  const handleDatasetButtonClick = () => {
    const position = calculateDropdownPosition();
    setDropdownPosition(position);
    setShowDatasetDropdown(!showDatasetDropdown);
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedDatasetInfo = datasets.find(d => d.index_name === selectedDataset);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          {/* Unified Input Container */}
          <div className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
            {/* Text Input Area */}
            <div className="px-4 py-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('chat.placeholder')}
                disabled={disabled}
                className="w-full resize-none bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-h-32"
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
            </div>

            {/* Separator Line */}
            <div className="h-px bg-gray-200 dark:bg-gray-600 mx-4"></div>

            {/* Controls Area */}
            <div className="px-4 py-3 flex items-center justify-between">
              {/* Help Text */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('chat.helpText')}
              </div>

              {/* Dataset Selector and Send Button */}
              <div className="flex items-center gap-3">
                {/* Dataset Selector */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={handleDatasetButtonClick}
                    disabled={disabled}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    <span className="max-w-32 truncate">
                      {selectedDatasetInfo ? selectedDatasetInfo.index_name.split('_')[0] : t('dataset.selectPlaceholder')}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDatasetDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDatasetDropdown && (
                    <div
                      ref={dropdownContentRef}
                      className={`absolute right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 ${
                        dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
                      }`}
                    >
                      <div className="py-1 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            onDatasetChange(null);
                            setShowDatasetDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          {t('dataset.selectPlaceholder')}
                        </button>
                        {datasets.map((dataset) => (
                          <button
                            key={dataset.index_name}
                            onClick={() => {
                              onDatasetChange(dataset.index_name);
                              setShowDatasetDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              selectedDataset === dataset.index_name
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="font-medium truncate">{dataset.index_name}</div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">
                              {dataset.document_count} {t('dataset.documents')}, {dataset.dimensions}{t('dataset.dimensions')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || disabled}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}