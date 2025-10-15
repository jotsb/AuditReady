import { useState, useMemo } from 'react';
import { actionTracker } from '../lib/actionTracker';
import { Receipt } from './useReceiptsData';

export interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  paymentMethod: string;
  categories: string[];
}

export function useReceiptFilters(receipts: Receipt[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    paymentMethod: '',
    categories: [],
  });

  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const matchesSearch = !searchQuery ||
        receipt.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.total_amount?.toString().includes(searchQuery);

      const matchesCategory = !filterCategory || receipt.category === filterCategory;

      const matchesDateFrom = !advancedFilters.dateFrom ||
        (receipt.transaction_date && receipt.transaction_date >= advancedFilters.dateFrom);

      const matchesDateTo = !advancedFilters.dateTo ||
        (receipt.transaction_date && receipt.transaction_date <= advancedFilters.dateTo);

      const matchesAmountMin = !advancedFilters.amountMin ||
        receipt.total_amount >= parseFloat(advancedFilters.amountMin);

      const matchesAmountMax = !advancedFilters.amountMax ||
        receipt.total_amount <= parseFloat(advancedFilters.amountMax);

      const matchesPaymentMethod = !advancedFilters.paymentMethod ||
        receipt.payment_method === advancedFilters.paymentMethod;

      const matchesCategories = advancedFilters.categories.length === 0 ||
        (receipt.category && advancedFilters.categories.includes(receipt.category));

      return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo &&
             matchesAmountMin && matchesAmountMax && matchesPaymentMethod && matchesCategories;
    });
  }, [receipts, searchQuery, filterCategory, advancedFilters]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 3) {
      actionTracker.searchPerformed(query, filteredReceipts.length, { context: 'receipts' });
    }
  };

  const handleCategoryFilterChange = (category: string) => {
    setFilterCategory(category);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      paymentMethod: '',
      categories: [],
    });
  };

  return {
    searchQuery,
    filterCategory,
    advancedFilters,
    filteredReceipts,
    handleSearchChange,
    handleCategoryFilterChange,
    setAdvancedFilters,
    clearAdvancedFilters
  };
}
