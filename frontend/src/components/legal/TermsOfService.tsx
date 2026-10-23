import React, { useState } from 'react';
import {
  Scale,
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  ShieldAlert,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { SUPPORTED_CURRENCIES, FINANCIAL_LIMITS } from '../../utils/constants';
import { COMPLIANCE_STORAGE_KEYS } from '../../store/useAuthStore';

export interface TermsOfServiceProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  showCheckbox?: boolean;
  compact?: boolean;
}

/**
 * TermsOfService Legal Component
 * Displays the full Jungle Bet Terms of Service with prominent, mandatory
 * Currency Conversion & Exchange Rates (FX Spread) and No Arbitrage clauses.
 */
export const TermsOfService: React.FC<TermsOfServiceProps> = ({
  checked,
  onChange,
  showCheckbox = true,
  compact = false,
}) => {
  const [internalChecked, setInternalChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX) === 'true';
  });

  const isControlled = typeof checked === 'boolean' && typeof onChange === 'function';
  const effectiveChecked = isControlled ? checked : internalChecked;

  const handleToggle = (nextValue: boolean) => {
    if (!isControlled) {
      setInternalChecked(nextValue);
      try {
        localStorage.setItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX, String(nextValue));
      } catch {
        // Ignore storage errors
      }
    }
    onChange?.(nextValue);
  };

  const nonUsdCurrencies = Object.values(SUPPORTED_CURRENCIES).filter(
    (c) => c.code !== 'USD'
  );

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden text-gray-200 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1a1a1a] via-[#221f10] to-[#1a1a1a] border-b border-[#FFD700]/25 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              Terms of Service & Financial Settlement Agreement
            </h2>
            <p className="text-xs text-gray-400">
              Effective Date: October 2026 • Version 4.2 (Mandatory FX & Optical Telemetry Clauses)
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
          Mandatory Legal Agreement
        </span>
      </div>

      {/* Critical Red Financial & Age Warning Banner */}
      <div className="bg-red-950/40 border-b border-red-500/40 px-5 py-3.5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-bold text-red-400 uppercase tracking-wide">
            CRITICAL WARNING — 18+ AGE LIMIT & HIGH FINANCIAL RISK:
          </p>
          <p className="text-red-300 mt-0.5">
            Participation on Jungle Bet is strictly restricted to individuals aged{' '}
            <strong className="text-red-400 underline">18 years or older</strong>. Optical
            traffic wagering involves substantial risk of financial loss. Furthermore, all
            non-USD deposits and withdrawals are subject to{' '}
            <strong className="text-red-400 underline">
              proprietary exchange rates with embedded FX spreads
            </strong>
            . Never wager funds you cannot afford to lose.
          </p>
        </div>
      </div>

      {/* Scrollable Legal Body */}
      <div
        className={`${
          compact ? 'max-h-[340px]' : 'max-h-[460px]'
        } overflow-y-auto px-5 py-5 space-y-6 text-sm leading-relaxed text-gray-300 select-text`}
      >
        {/* Section 1 */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FFD700]" />
            1. Scope of Service & YOLOv8 Optical Telemetry Settlement
          </h3>
          <p>
            1.1. Welcome to <strong>Jungle Bet</strong> (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By creating an account, accessing live camera feeds, depositing funds, or locking in a wager, you enter into a legally binding contract governed by these Terms of Service.
          </p>
          <p>
            1.2. Jungle Bet operates real-time optical vehicle-counting prediction markets powered by YOLOv8 computer vision telemetry across global traffic feeds. Market outcomes (&ldquo;Under 10 Vehicles&rdquo;, &ldquo;Over 13 Vehicles&rdquo;, &ldquo;Star Pick Exact 7&rdquo;, and &ldquo;Exact High 20&rdquo;) are resolved deterministically by our automated backend optical counting engine at the conclusion of each 30-second window. Server telemetry logs are final and binding.
          </p>
          <p className="text-red-400 font-semibold">
            1.3. STRICT AGE REQUIREMENT (18+): You must be at least eighteen (18) years of age (or the legal age of majority in your jurisdiction, whichever is higher) to access or use this Platform. Accounts found to belong to underage users will be immediately terminated and reported to regulatory authorities.
          </p>
        </section>

        {/* Section 2: PROMINENT FX SPREAD CLAUSE */}
        <section
          id="fx-spread-clause"
          className="rounded-xl border-2 border-[#FFD700] bg-gradient-to-br from-[#231d07] via-[#1a1608] to-[#1f1212] p-4 sm:p-5 space-y-3 shadow-lg"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[#FFD700] font-extrabold text-base sm:text-lg flex items-center gap-2 uppercase tracking-wide">
              <ArrowLeftRight className="w-5 h-5 text-[#FFD700]" />
              2. Currency Conversion & Exchange Rates (FX Spread Clause)
            </h3>
            <span className="px-2.5 py-0.5 rounded bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-wider">
              Mandatory Disclosure
            </span>
          </div>

          <p className="text-white font-medium">
            2.1. <strong>Base Settlement Currency (USD):</strong> All wagers, account balances, reserve pool calculations, and payout liabilities on Jungle Bet are denominated and settled internally in <strong>United States Dollars (USD)</strong>.
          </p>

          <p className="text-red-300 font-semibold bg-red-950/50 border border-red-500/40 rounded-lg p-3">
            2.2. <strong>PROPRIETARY RATES & HIDDEN FX SPREADS:</strong> Whenever you deposit or withdraw funds in a local or non-USD currency (including but not limited to EUR, GBP, UGX, KES, TZS, or NGN), Jungle Bet applies <u>proprietary internal foreign exchange rates that include an embedded, hidden FX spread and treasury liquidity margin</u> (typically ranging from 3% to 8.5% depending on currency volatility and payment corridor). These proprietary rates intentionally differ from mid-market interbank or central bank reference rates.
          </p>

          <p className="text-gray-200">
            2.3. <strong>Two-Way Conversion Impact:</strong> You expressly acknowledge and agree that:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-200 text-xs sm:text-sm">
            <li>
              <strong>Deposits:</strong> Local currency deposits are converted into USD using Jungle Bet&apos;s proprietary conversion rate, which incorporates our internal FX spread and gateway clearing fees prior to crediting your USD vault balance.
            </li>
            <li>
              <strong>Withdrawals:</strong> USD withdrawal requests paid out to local mobile money (M-Pesa, Airtel Money), Paystack, Flutterwave, or European banking rails are converted at Jungle Bet&apos;s prevailing proprietary payout rate, which deducts the embedded FX spread.
            </li>
            <li>
              <strong>Dynamic Rate Adjustments:</strong> Proprietary exchange rates and hidden spreads may be adjusted at any time without prior notice to protect the Platform&apos;s 25% Treasury Safety Float against foreign exchange volatility.
            </li>
          </ul>

          {/* Indicative Rate Comparison Table */}
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/15 bg-black/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-gray-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-2 px-3">Currency</th>
                  <th className="py-2 px-3">Benchmark Market Rate</th>
                  <th className="py-2 px-3 text-[#FFD700]">Proprietary Platform Rate</th>
                  <th className="py-2 px-3 text-red-400">Embedded FX Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {nonUsdCurrencies.map((curr) => {
                  const spreadPct = (
                    ((curr.marketRate - curr.customRate) / curr.marketRate) *
                    100
                  ).toFixed(2);
                  return (
                    <tr key={curr.code} className="hover:bg-white/5">
                      <td className="py-1.5 px-3 font-semibold text-white">
                        {curr.code} ({curr.symbol})
                      </td>
                      <td className="py-1.5 px-3 text-gray-400">
                        1 USD = {curr.marketRate.toLocaleString()} {curr.code}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-[#FFD700]">
                        1 USD = {curr.customRate.toLocaleString()} {curr.code}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-red-400">
                        ~{spreadPct}% Spread Applied
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: NO ARBITRAGE CLAUSE */}
        <section
          id="no-arbitrage-clause"
          className="rounded-xl border-2 border-red-500/60 bg-red-950/25 p-4 sm:p-5 space-y-2.5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-red-400 font-extrabold text-base sm:text-lg flex items-center gap-2 uppercase tracking-wide">
              <Ban className="w-5 h-5 text-red-500" />
              3. Strictly No Arbitrage & Rate Exploitation Prohibition
            </h3>
            <span className="px-2.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase">
              Zero Tolerance Policy
            </span>
          </div>

          <p className="text-gray-200">
            3.1. <strong>Prohibition of FX & Odds Arbitrage:</strong> Users are strictly prohibited from engaging in any form of currency arbitrage, triangular conversion cycling, payment rail cycling (e.g., depositing via one currency/gateway and withdrawing via another without bona fide wagering turnover), or exploiting latency between external FX spot markets and Jungle Bet&apos;s internal conversion tables.
          </p>

          <p className="text-gray-200">
            3.2. <strong>Prohibition of Telemetry Latency & Bot Exploitation:</strong> Utilizing automated scripts, high-frequency bots (exceeding {FINANCIAL_LIMITS.RAPID_BET_LIMIT_PER_MIN} bets per minute), syndicates, or direct RTSP camera stream interception to front-run optical vehicle counts is strictly forbidden.
          </p>

          <p className="text-red-400 font-bold">
            3.3. <strong>Enforcement & Forfeiture:</strong> Our Leo AI Fraud Detection Engine continuously monitors all deposits, currency switches, and betting velocity. Any account flagged for FX arbitrage or rate exploitation will be immediately frozen, all illicit gains forfeited to the Reserve Pool, and the user permanently banned.
          </p>
        </section>

        {/* Section 4: Financial Limits & Treasury Protection */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#FFD700]" />
            4. Deposit/Withdrawal Thresholds & 25% Treasury Safety Float
          </h3>
          <p>
            4.1. Minimum deposit is <strong>${FINANCIAL_LIMITS.MIN_DEPOSIT_USD.toFixed(2)} USD</strong> equivalent; minimum withdrawal is <strong>${FINANCIAL_LIMITS.MIN_WITHDRAWAL_USD.toFixed(2)} USD</strong> equivalent. Single wagers must fall between <strong>${FINANCIAL_LIMITS.MIN_BET_USD.toFixed(2)} USD</strong> and <strong>${FINANCIAL_LIMITS.MAX_BET_USD.toLocaleString()} USD</strong>.
          </p>
          <p>
            4.2. To guarantee platform solvency, Jungle Bet enforces an automated <strong>25% Treasury Safety Float</strong>. High-value withdrawals or payouts exceeding ${FINANCIAL_LIMITS.HIGH_WIN_ALERT_USD.toLocaleString()} USD may be queued for manual administrative verification and KYC clearance prior to disbursement.
          </p>
        </section>

        {/* Section 5: Limitation of Liability */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base">
            5. Assumption of Financial Risk & Limitation of Liability
          </h3>
          <p className="text-red-400 font-medium">
            5.1. FINANCIAL RISK WARNING: Wagering on live traffic telemetry carries a high degree of financial risk. Past vehicle flow density in any European or global city does not guarantee future traffic counts. You may lose 100% of your staked capital.
          </p>
          <p>
            5.2. By ticking the acceptance box below, you irrevocably waive any claim, dispute, or chargeback arising from (a) the application of Jungle Bet&apos;s proprietary FX rates and hidden spreads on deposits or withdrawals, or (b) automated YOLOv8 optical settlement determinations.
          </p>
        </section>
      </div>

      {/* Mandatory Acceptance Checkbox Footer */}
      {showCheckbox && (
        <div className="bg-[#1b1b1b] border-t border-[#FFD700]/30 px-5 py-4">
          <label className="flex items-start gap-3.5 cursor-pointer select-none group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                checked={effectiveChecked}
                onChange={(e) => handleToggle(e.target.checked)}
                data-testid="terms-fx-checkbox"
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-[#FFD700]/60 bg-black/60 checked:border-[#FFD700] checked:bg-[#FFD700] transition-all"
              />
              <CheckCircle2 className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1">
              <span className="text-sm sm:text-base font-bold text-white group-hover:text-[#FFD700] transition-colors">
                I have read and agree to the Terms, specifically the FX Spread Clause.
              </span>
              <p className="text-xs text-red-400 font-medium mt-0.5">
                * Mandatory: Includes explicit consent to proprietary currency exchange rates with hidden spreads (Section 2) and the No Arbitrage rule (Section 3).
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default TermsOfService;
