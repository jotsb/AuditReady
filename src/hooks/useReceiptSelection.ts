import { useState } from 'react';
import { Receipt } from './useReceiptsData';

export function useReceiptSelection(receipts: Receipt[]) {
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedReceipts(new Set());
      setSelectAll(false);
    }
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelection = new Set(selectedReceipts);
    if (newSelection.has(receiptId)) {
      newSelection.delete(receiptId);
    } else {
      newSelection.add(receiptId);
    }
    setSelectedReceipts(newSelection);
    setSelectAll(newSelection.size === receipts.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedReceipts(new Set());
      setSelectAll(false);
    } else {
      setSelectedReceipts(new Set(receipts.map(r => r.id)));
      setSelectAll(true);
    }
  };

  const clearSelection = () => {
    setSelectedReceipts(new Set());
    setSelectAll(false);
    setIsSelectMode(false);
  };

  return {
    selectedReceipts,
    isSelectMode,
    selectAll,
    toggleSelectMode,
    toggleReceiptSelection,
    toggleSelectAll,
    clearSelection
  };
}
