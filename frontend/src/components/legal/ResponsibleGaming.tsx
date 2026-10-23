import React, { useState } from 'react';
import {
  HeartHandshake,
  AlertOctagon,
  ShieldBan,
  PhoneCall,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { COMPLIANCE_STORAGE_KEYS } from '../../store/useAuthStore';

export interface ResponsibleGamingProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  showCheckbox?: boolean;
  compact?: boolean;
}

/**
 * ResponsibleGaming Legal Component
 * Provides gambling addiction warnings, strict 18+ age limit enforcement,
 * financial risk notices, and interactive self-exclusion / cooling-off controls.
 */
export const ResponsibleGaming: React.FC<ResponsibleGamingProps> = ({
  checked,
  onChange,
  showCheckbox = true,
  compact = false,
}) => {
  const [internalChecked, setInternalChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING) === 'true';
  });

  const [selfExclusionStatus, setSelfExclusionStatus] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('junglebet_self_exclusion_period');
  });

  const isControlled = typeof checked === 'boolean' && typeof onChange === 'function';
  const effectiveChecked = isControlled ? checked : internalChecked;

  const handleToggle = (nextValue: boolean) => {
    if (!isControlled) {
      setInternalChecked(nextValue);
      try {
        localStorage.setItem(
          COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING,
          String(nextValue)
        );
      } catch {
        // Ignore storage errors
      }
    }
    onChange?.(nextValue);
  };

  const handleRequestSelfExclusion = (periodLabel: string) => {
    try {
      localStorage.setItem('junglebet_self_exclusion_period', periodLabel);
      setSelfExclusionStatus(periodLabel);
      toast.success(
        `Self-exclusion preference (${periodLabel}) recorded. Contact support or visit Racer Profile to enforce immediately.`
      );
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden text-gray-200 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a1a] via-[#241313] to-[#1a1a1a] border-b border-red-500/30 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Responsible Gaming, Addiction Warning & 18+ Policy
            </h2>
            <p className="text-xs text-gray-400">
              Player Protection, Self-Exclusion Controls & Problem Gambling Support
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow">
          18+ ONLY
        </span>
      </div>

      {/* Prominent Red Addiction & Age Limit Alert */}
      <div className="bg-red-950/50 border-b border-red-500/50 px-5 py-3.5 flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-extrabold text-red-400 uppercase tracking-wide">
            GAMBLING ADDICTION & FINANCIAL RISK WARNING (STRICTLY 18+):
          </p>
          <p className="text-red-300 mt-0.5">
            Wagering on rapid 30-second optical traffic rounds can be highly addictive and may result in rapid financial loss.{' '}
            <strong className="text-red-400 underline">
              Underage gambling (under 18 years old) is a criminal offense and strictly prohibited.
            </strong>{' '}
            Never chase losses, never gamble with borrowed money, and never treat betting as a source of income.
          </p>
        </div>
      </div>

      {/* Scrollable Body */}
      <div
        className={`${
          compact ? 'max-h-[340px]' : 'max-h-[440px]'
        } overflow-y-auto px-5 py-5 space-y-5 text-sm leading-relaxed text-gray-300 select-text`}
      >
        {/* Section 1: Age Limit */}
        <section className="space-y-2">
          <h3 className="text-red-400 font-extrabold text-base flex items-center gap-2">
            1. Strict 18+ Age Limit & Minor Protection
          </h3>
          <p className="text-red-300 font-medium">
            1.1. No person under the age of 18 is permitted to create an account, deposit funds, view live betting odds, or place wagers on Jungle Bet.
          </p>
          <p>
            1.2. Parents and guardians are strongly encouraged to install parental control software (such as Net Nanny, CyberPatrol, or Qustodio) and to keep login credentials and payment methods secure from minors.
          </p>
        </section>

        {/* Section 2: Recognizing Problem Gambling */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FFD700]" />
            2. Recognizing Signs of Gambling Addiction
          </h3>
          <p>
            Ask yourself the following questions honestly. If you answer &ldquo;Yes&rdquo; to any of them, we strongly advise activating Self-Exclusion immediately:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 text-xs sm:text-sm">
            <li>Do you wager larger amounts to recover previous losses (&ldquo;chasing losses&rdquo;)?</li>
            <li>Have you staked money needed for rent, food, tuition, or family obligations?</li>
            <li>Do you feel anxious, irritable, or restless when trying to stop betting?</li>
            <li>Have you lied to family members or colleagues about the time or money spent wagering?</li>
          </ul>
        </section>

        {/* Section 3: Self-Exclusion Options */}
        <section className="rounded-xl border border-amber-500/40 bg-amber-950/15 p-4 space-y-3">
          <h3 className="text-[#FFD700] font-bold text-base flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-[#FFD700]" />
            3. Self-Exclusion & Cooling-Off Options
          </h3>
          <p>
            Jungle Bet provides binding player protection tools to restrict your access to betting markets and deposits at any time:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleRequestSelfExclusion('24-Hour Cooling-Off')}
              className="text-left p-3 rounded-xl bg-black/50 border border-white/10 hover:border-[#FFD700]/50 transition-colors"
            >
              <div className="text-xs font-extrabold text-[#FFD700] uppercase">
                24-Hour Cooling-Off
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Immediately pauses all wagering & deposits for 24 hours.
              </p>
            </button>
            <button
              type="button"
              onClick={() => handleRequestSelfExclusion('30-Day Suspension')}
              className="text-left p-3 rounded-xl bg-black/50 border border-white/10 hover:border-amber-400/50 transition-colors"
            >
              <div className="text-xs font-extrabold text-amber-400 uppercase">
                30-Day Suspension
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Locks betting access for 30 days while allowing balance withdrawal.
              </p>
            </button>
            <button
              type="button"
              onClick={() => handleRequestSelfExclusion('Permanent Self-Exclusion')}
              className="text-left p-3 rounded-xl bg-red-950/30 border border-red-500/30 hover:border-red-500 transition-colors"
            >
              <div className="text-xs font-extrabold text-red-400 uppercase">
                Permanent Exclusion
              </div>
              <p className="text-[11px] text-red-300/80 mt-1">
                Irrevocably closes wagering privileges and settles remaining vault funds.
              </p>
            </button>
          </div>
          {selfExclusionStatus && (
            <p className="text-xs text-amber-300 font-semibold">
              Selected Self-Exclusion Option: {selfExclusionStatus}
            </p>
          )}
        </section>

        {/* Section 4: Independent Helpline Resources */}
        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            4. Confidential 24/7 Gambling Addiction Helplines
          </h3>
          <ul className="space-y-1.5 text-xs sm:text-sm text-gray-300">
            <li>
              • <strong>BeGambleAware (International / UK):</strong>{' '}
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noreferrer"
                className="text-[#FFD700] underline"
              >
                www.begambleaware.org
              </a>{' '}
              | Helpline: 0808 8020 133
            </li>
            <li>
              • <strong>GamCare Support & Live Chat:</strong>{' '}
              <a
                href="https://www.gamcare.org.uk"
                target="_blank"
                rel="noreferrer"
                className="text-[#FFD700] underline"
              >
                www.gamcare.org.uk
              </a>
            </li>
            <li>
              • <strong>National Problem Gambling Helpline (US / Global):</strong> Call or Text{' '}
              <strong className="text-white">1-800-GAMBLER (1-800-426-2537)</strong>
            </li>
            <li>
              • <strong>Gamblers Anonymous International:</strong>{' '}
              <a
                href="https://www.gamblersanonymous.org"
                target="_blank"
                rel="noreferrer"
                className="text-[#FFD700] underline"
              >
                www.gamblersanonymous.org
              </a>
            </li>
          </ul>
        </section>
      </div>

      {/* Mandatory Checkbox Footer */}
      {showCheckbox && (
        <div className="bg-[#1b1b1b] border-t border-red-500/30 px-5 py-4">
          <label className="flex items-start gap-3.5 cursor-pointer select-none group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                checked={effectiveChecked}
                onChange={(e) => handleToggle(e.target.checked)}
                data-testid="responsible-gaming-checkbox"
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-[#FFD700]/60 bg-black/60 checked:border-[#FFD700] checked:bg-[#FFD700] transition-all"
              />
              <CheckCircle2 className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1">
              <span className="text-sm sm:text-base font-bold text-white group-hover:text-[#FFD700] transition-colors">
                I confirm that I am 18+ years old and acknowledge the Responsible Gaming & Financial Risk warnings.
              </span>
              <p className="text-xs text-red-400 font-medium mt-0.5">
                * Mandatory: Confirms you meet the strict 18+ legal age limit and understand self-exclusion options.
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default ResponsibleGaming;
