import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Ban,
  CheckCircle2,
  PhoneCall,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { COMPLIANCE_STORAGE_KEYS } from '../../store/useAuthStore';

export interface AgeVerificationGateProps {
  children?: React.ReactNode;
  onVerified?: () => void;
}

const AGE_COOKIE_NAME = 'junglebet_age_verified';

const readAgeVerifiedStatus = (): 'verified' | 'denied' | 'pending' => {
  if (typeof window === 'undefined') return 'pending';
  try {
    const localVal = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.AGE_VERIFIED);
    if (localVal === 'true') return 'verified';
    if (localVal === 'false') return 'denied';

    const cookieMatch = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${AGE_COOKIE_NAME}=`));
    if (cookieMatch) {
      const val = cookieMatch.split('=')[1];
      if (val === 'true') return 'verified';
      if (val === 'false') return 'denied';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'pending';
};

const persistAgeVerification = (verified: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.AGE_VERIFIED, String(verified));
    const maxAge = verified ? 60 * 60 * 24 * 365 : 60 * 60 * 24;
    document.cookie = `${AGE_COOKIE_NAME}=${String(
      verified
    )}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    // Ignore storage errors
  }
};

/**
 * AgeVerificationGate Security Component
 * Displays a mandatory, non-dismissible "Are you 18 or older?" gate on first visit.
 * If 'No' is selected, blocks platform access and renders Responsible Gaming resources.
 * If 'Yes' is selected, persists verification in both Cookie and localStorage.
 */
export const AgeVerificationGate: React.FC<AgeVerificationGateProps> = ({
  children,
  onVerified,
}) => {
  const [status, setStatus] = useState<'verified' | 'denied' | 'pending'>(() =>
    readAgeVerifiedStatus()
  );

  useEffect(() => {
    if (status === 'verified') {
      onVerified?.();
    }
  }, [status, onVerified]);

  const handleConfirmAdult = () => {
    persistAgeVerification(true);
    setStatus('verified');
    onVerified?.();
  };

  const handleDenyUnderage = () => {
    persistAgeVerification(false);
    setStatus('denied');
  };

  const handleResetPrompt = () => {
    try {
      localStorage.removeItem(COMPLIANCE_STORAGE_KEYS.AGE_VERIFIED);
      document.cookie = `${AGE_COOKIE_NAME}=; max-age=0; path=/`;
    } catch {
      // Ignore
    }
    setStatus('pending');
  };

  if (status === 'verified') {
    return <>{children}</>;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      // Prevent any click-outside dismissal
      onClick={(e) => e.stopPropagation()}
    >
      {status === 'denied' ? (
        /* BLOCKED ACCESS VIEW FOR UNDER-18 USERS */
        <div className="w-full max-w-lg rounded-3xl bg-[#141414] border-2 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.35)] overflow-hidden p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500">
            <Ban className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-widest">
              Access Restricted • 18+ Only
            </span>
            <h1
              id="age-gate-title"
              className="text-2xl sm:text-3xl font-black text-white tracking-tight"
            >
              Access Blocked: Underage Protection
            </h1>
            <p className="text-sm text-red-400 font-semibold leading-relaxed">
              You must be 18 years of age or older to enter Jungle Bet. Underage wagering is strictly prohibited by law and platform security policy.
            </p>
          </div>

          <div className="text-left rounded-2xl bg-red-950/30 border border-red-500/40 p-4 space-y-3 text-xs sm:text-sm text-gray-200">
            <div className="font-bold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#FFD700]" />
              Responsible Gaming & Youth Protection Resources
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              If you or someone you know needs support regarding underage gambling or gambling addiction, free confidential help is available 24/7:
            </p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                <span>BeGambleAware Support</span>
                <a
                  href="https://www.begambleaware.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#FFD700] font-bold inline-flex items-center gap-1 hover:underline"
                >
                  begambleaware.org <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                <span>GamCare Youth & Family Helpline</span>
                <a
                  href="https://www.gamcare.org.uk"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#FFD700] font-bold inline-flex items-center gap-1 hover:underline"
                >
                  gamcare.org.uk <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                <span>National Problem Gambling Helpline</span>
                <span className="text-white font-bold">1-800-GAMBLER</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetPrompt}
              className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
            >
              Clicked &ldquo;No&rdquo; by mistake? Re-open age verification
            </button>
          </div>
        </div>
      ) : (
        /* INITIAL 18+ VERIFICATION POPUP */
        <div className="w-full max-w-md rounded-3xl bg-[#141414] border-2 border-[#FFD700]/60 shadow-[0_0_50px_rgba(255,215,0,0.18)] overflow-hidden p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/15 border-2 border-[#FFD700] flex items-center justify-center mx-auto text-[#FFD700]">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-extrabold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              Mandatory 18+ Age Verification
            </div>
            <h1
              id="age-gate-title"
              className="text-2xl sm:text-3xl font-black text-white tracking-tight"
            >
              Are you 18 or older?
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Welcome to <strong className="text-white">JUNGLE<span className="text-[#FFD700]">BET</span></strong>. This platform features real-money optical traffic wagering and proprietary FX currency settlement.
            </p>
          </div>

          <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-3.5 text-left">
            <p className="text-xs text-red-300 font-medium leading-relaxed">
              <strong className="text-red-400 uppercase">Legal & Financial Risk Warning:</strong>{' '}
              It is illegal for anyone under the age of 18 to open an account or gamble on Jungle Bet. Wagering carries a high risk of financial loss.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleDenyUnderage}
              data-testid="age-gate-no"
              className="py-3.5 px-4 rounded-xl font-bold text-sm bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition-all"
            >
              No, I am under 18
            </button>
            <button
              type="button"
              onClick={handleConfirmAdult}
              data-testid="age-gate-yes"
              className="py-3.5 px-4 rounded-xl font-extrabold text-sm bg-[#FFD700] hover:bg-[#ffe033] text-black shadow-lg shadow-[#FFD700]/20 inline-flex items-center justify-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Yes, I am 18+
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgeVerificationGate;
