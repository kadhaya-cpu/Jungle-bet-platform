import React, { useMemo, useState } from 'react';
import {
  Globe2,
  RefreshCw,
  ArrowUpDown,
  TrendingUp,
  Webhook,
} from 'lucide-react';
import { FxRateItem, useAdminStore } from '../../store/useAdminStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface FxRatesViewerProps {
  rates?: FxRateItem[];
}

type SortKey = 'currencyCode' | 'marketRate' | 'customRate' | 'spreadProfitPerUsd';

/**
 * FX Rates Viewer & n8n Oracle Spread Profit Table
 * Fetches current rates from /api/fx-rates and calculates spread profit per USD.
 */
export const FxRatesViewer: React.FC<FxRatesViewerProps> = ({ rates: propRates }) => {
  const { fxRates, isLoadingFxRates, refreshFxRates } = useAdminStore();
  const list = propRates ?? fxRates;

  const [sortKey, setSortKey] = useState<SortKey>('spreadProfitPerUsd');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'currencyCode');
    }
  };

  const sortedRates = useMemo(() => {
    return [...list].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });
  }, [list, sortKey, sortAsc]);

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700]">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Live FX Conversion Rates & Value-Reduction Spread Engine
            </h3>
            <p className="text-xs text-gray-400">
              Synchronized with /api/fx-rates & automated n8n liquidity oracle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-semibold">
            <Webhook className="w-3.5 h-3.5" />
            <span>n8n Webhook Ready</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            isLoading={isLoadingFxRates}
            onClick={refreshFxRates}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Rates
          </Button>
        </div>
      </div>

      {/* Sortable FX Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('currencyCode')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Currency Code
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('marketRate')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Market Rate (per $1)
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('customRate')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Custom House Rate
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('spreadProfitPerUsd')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Spread Profit per USD
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4 text-right">Last Oracle Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedRates.map((item) => {
              const isBaseUsd = item.currencyCode === 'USD';
              return (
                <tr
                  key={item.currencyCode}
                  className="hover:bg-white/[0.04] transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-[#0f0f0f] border border-white/10 flex items-center justify-center font-mono font-bold text-[#FFD700]">
                        {item.symbol}
                      </span>
                      <div>
                        <div className="font-extrabold text-white text-xs">
                          {item.currencyCode}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {item.currencyName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-gray-200 font-semibold">
                    {item.symbol}
                    {item.marketRate.toLocaleString(undefined, {
                      minimumFractionDigits: item.marketRate < 10 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#FFD700] font-bold">
                    {item.symbol}
                    {item.customRate.toLocaleString(undefined, {
                      minimumFractionDigits: item.customRate < 10 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    {isBaseUsd ? (
                      <span className="text-gray-500 font-mono">0.00 (Base Ledger)</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                          <TrendingUp className="w-3 h-3" />
                          {formatCurrency(item.spreadProfitPerUsd, 'USD')} / $1 USD
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          ({item.spreadPercent}% margin)
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[11px] text-gray-400">
                    {new Date(item.lastUpdated).toLocaleTimeString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FxRatesViewer;
