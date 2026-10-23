import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Scale,
  Lock,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  useAuthStore,
  COMPLIANCE_STORAGE_KEYS,
  readComplianceFromStorage,
} from '../../store/useAuthStore';
import { TermsOfService } from '../legal/TermsOfService';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';
import { ResponsibleGaming } from '../legal/ResponsibleGaming';
import { AgeVerificationGate } from '../security/AgeVerificationGate';

export interface ComplianceGateProps {
  children: React.ReactNode;
}

type LegalTabKey = 'terms' | 'privacy' | 'responsible';

/**
 * ComplianceGate Onboarding & Route Protection Wrapper
 * Wraps the entire application so any deep-link (/wallet, /betting, /profile, /)
 * is intercepted until the user passes the 18+ Age Gate AND explicitly checks all 3
 * mandatory legal checkboxes (Terms & FX Spread, Privacy Policy, Responsible Gaming).
 */
export const ComplianceGate: React.FC<ComplianceGateProps> = ({ children }) => {
  const { hasAcceptedTerms, acceptTerms } = useAuthStore();

  const [activeTab, setActiveTab] = useState<LegalTabKey>('terms');

  const [termsFxChecked, setTermsFxChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX) === 'true';
  });

  const [privacyChecked, setPrivacyChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.PRIVACY) === 'true';
  });

  const [responsibleChecked, setResponsibleChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING) === 'true';
  });

  const [isStorageCompliant, setIsStorageCompliant] = useState<boolean>(() =>
    readComplianceFromStorage()
  );

  // Sync localStorage state on mount
  useEffect(() => {
    const storedCompliant = readComplianceFromStorage();
    setIsStorageCompliant(storedCompliant);
    if (storedCompliant && !hasAcceptedTerms) {
      acceptTerms();
    }
  }, [hasAcceptedTerms, acceptTerms]);

  const handleTermsChange = (checked: boolean) => {
    setTermsFxChecked(checked);
    try {
      localStorage.setItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX, String(checked));
    } catch {
      // Ignore storage errors
    }
  };

  const handlePrivacyChange = (checked: boolean) => {
    setPrivacyChecked(checked);
    try {
      localStorage.setItem(COMPLIANCE_STORAGE_KEYS.PRIVACY, String(checked));
    } catch {
      // Ignore storage errors
    }
  };

  const handleResponsibleChange = (checked: boolean) => {
    setResponsibleChecked(checked);
    try {
      localStorage.setItem(COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING, String(checked));
    } catch {
      // Ignore storage errors
    }
  };

  const allThreeChecked = Boolean(
    termsFxChecked && privacyChecked && responsibleChecked
  );

  const handleAcceptAllAndProceed = () => {
    if (!allThreeChecked) return;
    acceptTerms();
    setIsStorageCompliant(true);
  };

  const isFullyAccepted = Boolean(hasAcceptedTerms && isStorageCompliant);

  return (
    <AgeVerificationGate>
      {isFullyAccepted ? (
        <>{children}</>
      ) : (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-sans"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compliance-gate-heading"
          // Explicitly prevent closing by clicking outside
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-4xl my-auto rounded-3xl bg-[#111111] border-2 border-[#FFD700]/50 shadow-[0_0_60px_rgba(255,215,0,0.16)] overflow-hidden flex flex-col max-h-[95vh]">
            {/* Top Compliance Gate Header */}
            <div className="bg-gradient-to-r from-[#171717] via-[#221d0a] to-[#171717] border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1
                    id="compliance-gate-heading"
                    className="text-lg sm:text-xl font-black text-white tracking-tight"
                  >
                    JUNGLE<span className="text-[#FFD700]">BET</span> REGULATORY COMPLIANCE GATE
                  </h1>
                  <p className="text-xs text-gray-400">
                    Mandatory Legal Onboarding • Review & accept all 3 policies (including the FX Spread Clause) to unlock platform access
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-red-600/20 text-red-400 border border-red-500/40">
                  {[termsFxChecked, privacyChecked, responsibleChecked].filter(Boolean).length} / 3 Accepted
                </span>
              </div>
            </div>

            {/* Tab Selector for the 3 Legal Documents */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#161616] px-5 py-3 border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                  activeTab === 'terms'
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700]'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/25'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Scale className="w-4 h-4 shrink-0" />
                  <span className="truncate">1. Terms & FX Spread</span>
                </span>
                {termsFxChecked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-extrabold">
                    Req
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                  activeTab === 'privacy'
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700]'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/25'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span className="truncate">2. Privacy & Google Drive</span>
                </span>
                {privacyChecked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-extrabold">
                    Req
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('responsible')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                  activeTab === 'responsible'
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700]'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/25'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <HeartHandshake className="w-4 h-4 shrink-0" />
                  <span className="truncate">3. Responsible Gaming (18+)</span>
                </span>
                {responsibleChecked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-extrabold">
                    Req
                  </span>
                )}
              </button>
            </div>

            {/* Active Document Viewer */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {activeTab === 'terms' && (
                <TermsOfService
                  checked={termsFxChecked}
                  onChange={handleTermsChange}
                  compact
                />
              )}
              {activeTab === 'privacy' && (
                <PrivacyPolicy
                  checked={privacyChecked}
                  onChange={handlePrivacyChange}
                  compact
                />
              )}
              {activeTab === 'responsible' && (
                <ResponsibleGaming
                  checked={responsibleChecked}
                  onChange={handleResponsibleChange}
                  compact
                />
              )}
            </div>

            {/* Persistent 3-Checkbox Master Verification Summary & Submit Action */}
            <div className="bg-[#181818] border-t border-white/15 px-5 py-4 space-y-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Checkbox 1: Terms & FX Spread */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    termsFxChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                      : 'bg-black/40 border-red-500/30 text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={termsFxChecked}
                    onChange={(e) => handleTermsChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#FFD700] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs leading-snug">
                    <strong className="text-white block">Terms & FX Spread Clause</strong>
                    I have read and agree to the Terms, specifically the FX Spread Clause & No Arbitrage policy.
                  </span>
                </label>

                {/* Checkbox 2: Privacy Policy */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    privacyChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                      : 'bg-black/40 border-red-500/30 text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={privacyChecked}
                    onChange={(e) => handlePrivacyChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#FFD700] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs leading-snug">
                    <strong className="text-white block">Privacy & Cloud Storage</strong>
                    I agree to the Privacy Policy, Google Drive compliance archival, and Age Verification.
                  </span>
                </label>

                {/* Checkbox 3: Responsible Gaming */}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    responsibleChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                      : 'bg-black/40 border-red-500/30 text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={responsibleChecked}
                    onChange={(e) => handleResponsibleChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#FFD700] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs leading-snug">
                    <strong className="text-white block">18+ & Responsible Gaming</strong>
                    I confirm I am 18+ years old and understand the addiction & financial loss warnings.
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-red-400 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>
                    All 3 checkboxes are mandatory. This compliance gate cannot be bypassed or dismissed.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!allThreeChecked}
                  onClick={handleAcceptAllAndProceed}
                  data-testid="compliance-accept-btn"
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-sm inline-flex items-center justify-center gap-2 transition-all ${
                    allThreeChecked
                      ? 'bg-[#FFD700] hover:bg-[#ffe033] text-black shadow-lg shadow-[#FFD700]/25 cursor-pointer'
                      : 'bg-white/10 text-gray-500 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <span>Accept All & Enter Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AgeVerificationGate>
  );
};

export default ComplianceGate;
