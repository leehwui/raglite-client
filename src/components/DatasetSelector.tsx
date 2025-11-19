import React from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { Dataset } from '@/lib/chat-store';

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedDataset: string | null;
  onDatasetChange: (datasetName: string | null) => void;
  disabled?: boolean;
}

export function DatasetSelector({ datasets, selectedDataset, onDatasetChange, disabled = false }: DatasetSelectorProps) {
  const selectedDatasetInfo = datasets.find(d => d.index_name === selectedDataset);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <Database className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      <div className="w-64 min-w-0">
        <select
          value={selectedDataset || ''}
          onChange={(e) => onDatasetChange(e.target.value || null)}
          disabled={disabled}
          className="w-full bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select a dataset...</option>
          {datasets.map((dataset) => (
            <option key={dataset.index_name} value={dataset.index_name}>
              {dataset.index_name} ({dataset.document_count} docs, {dataset.dimensions}d)
            </option>
          ))}
        </select>
      </div>
      <ChevronDown className="w-4 h-4 text-gray-400" />
      {selectedDatasetInfo && (
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {selectedDatasetInfo.document_count} docs
        </div>
      )}
    </div>
  );
}