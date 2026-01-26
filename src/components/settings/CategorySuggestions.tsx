import { useState, useEffect } from 'react';
import { Check, X, RefreshCw, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';
import * as receiptService from '../../services/receiptService';

interface Suggestion {
  id: string;
  receipt_id: string;
  current_category: string | null;
  suggested_category: string;
  reason: string;
  created_at: string;
  receipts: {
    id: string;
    vendor_name: string | null;
    total_amount: number;
    transaction_date: string | null;
  };
}

interface CategorySuggestionsProps {
  businessId: string;
  onSuggestionsChange?: () => void;
}

export function CategorySuggestions({ businessId, onSuggestionsChange }: CategorySuggestionsProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [businessId]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const data = await receiptService.getPendingCategorySuggestions(businessId);
      setSuggestions(data as Suggestion[]);
    } catch (err) {
      logger.error('Failed to load category suggestions', err as Error, {
        component: 'CategorySuggestions',
        businessId
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestionId: string) => {
    if (!user) return;
    try {
      setProcessing(suggestionId);
      await receiptService.acceptCategorySuggestion(suggestionId, user.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      onSuggestionsChange?.();
    } catch (err) {
      logger.error('Failed to accept suggestion', err as Error, {
        component: 'CategorySuggestions',
        suggestionId
      });
      alert('Failed to apply suggestion');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    if (!user) return;
    try {
      setProcessing(suggestionId);
      await receiptService.rejectCategorySuggestion(suggestionId, user.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    } catch (err) {
      logger.error('Failed to reject suggestion', err as Error, {
        component: 'CategorySuggestions',
        suggestionId
      });
      alert('Failed to reject suggestion');
    } finally {
      setProcessing(null);
    }
  };

  const handleAcceptAll = async () => {
    if (!user || suggestions.length === 0) return;
    try {
      setProcessing('all');
      const ids = suggestions.map(s => s.id);
      await receiptService.bulkAcceptSuggestions(ids, user.id);
      setSuggestions([]);
      onSuggestionsChange?.();
    } catch (err) {
      logger.error('Failed to accept all suggestions', err as Error, {
        component: 'CategorySuggestions'
      });
      alert('Failed to apply all suggestions');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectAll = async () => {
    if (!user || suggestions.length === 0) return;
    try {
      setProcessing('all');
      const ids = suggestions.map(s => s.id);
      await receiptService.bulkRejectSuggestions(ids, user.id);
      setSuggestions([]);
    } catch (err) {
      logger.error('Failed to reject all suggestions', err as Error, {
        component: 'CategorySuggestions'
      });
      alert('Failed to reject all suggestions');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
            <Lightbulb className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Category Suggestions
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {suggestions.length} receipt{suggestions.length !== 1 ? 's' : ''} may need re-categorization
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="text-slate-400" size={20} />
        ) : (
          <ChevronDown className="text-slate-400" size={20} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 dark:border-amber-700/50">
          <div className="p-4 bg-amber-100/50 dark:bg-amber-900/30 flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-gray-400">
              Review and accept or reject category changes
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleRejectAll}
                disabled={processing === 'all'}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                disabled={processing === 'all'}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                Accept All
              </button>
            </div>
          </div>

          <div className="divide-y divide-amber-200 dark:divide-amber-700/50">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-4 hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-800 dark:text-white truncate">
                        {suggestion.receipts?.vendor_name || 'Unknown Vendor'}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-gray-400">
                        {formatAmount(suggestion.receipts?.total_amount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500 dark:text-gray-400">
                        {formatDate(suggestion.receipts?.transaction_date)}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600 dark:text-gray-400">
                        {suggestion.current_category || 'Uncategorized'}
                      </span>
                      <span className="text-slate-400">-&gt;</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {suggestion.suggested_category}
                      </span>
                    </div>
                    {suggestion.reason && (
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReject(suggestion.id)}
                      disabled={processing === suggestion.id}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition disabled:opacity-50"
                      title="Reject"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => handleAccept(suggestion.id)}
                      disabled={processing === suggestion.id}
                      className="p-2 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition disabled:opacity-50"
                      title="Accept"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
