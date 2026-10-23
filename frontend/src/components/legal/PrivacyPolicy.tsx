import React, { useState } from 'react';
import {
  Lock,
  HardDrive,
  UserCheck,
  Shield,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { COMPLIANCE_STORAGE_KEYS } from '../../store/useAuthStore';

export interface PrivacyPolicyProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  showCheckbox?: boolean;
  compact?: boolean;
}

/**
 * PrivacyPolicy Legal Component
 * Details data collection, encrypted Google Drive compliance storage integration,
 * Leo AI telemetry logging, and mandatory 18+ age verification procedures.
 */
export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  checked,
  onChange,
  showCheckbox = true,
  compact = false,
}) => {
  const [internalChecked, setInternalChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COMPLIANCE_STORAGE_KEYS.PRIVACY) === 'true';
  });

  const isControlled = typeof checked === 'boolean' && typeof onChange === 'function';
  const effectiveChecked = isControlled ? checked : internalChecked;

  const handleToggle = (nextValue: boolean) => {
    if (!isControlled) {
      setInternalChecked(nextValue);
      try {
        localStorage.setItem(COMPLIANCE_STORAGE_KEYS.PRIVACY, String(nextValue));
      } catch {
        // Ignore storage errors
      }
    }
    onChange?.(nextValue);
  };

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden text-gray-200 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a1a] via-[#132028] to-[#1a1a1a] border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Privacy Policy, Data Storage & KYC Verification
            </h2>
            <p className="text-xs text-gray-400">
              GDPR, East African Data Protection & Cloud Archival Compliance
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-400/30">
          Data Protection Notice
        </span>
      </div>

      {/* Red Critical Age & Identity Warning */}
      <div className="bg-red-950/35 border-b border-red-500/35 px-5 py-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-red-300 leading-relaxed">
          <strong className="text-red-400 uppercase">Mandatory Age & Identity Verification (18+):</strong>{' '}
          Jungle Bet strictly prohibits minors under 18 from registering or transacting. We perform automated and manual age verification checks on all accounts and retain encrypted audit records for regulatory compliance.
        </p>
      </div>

      {/* Scrollable Legal Content */}
      <div
        className={`${
          compact ? 'max-h-[340px]' : 'max-h-[440px]'
        } overflow-y-auto px-5 py-5 space-y-5 text-sm leading-relaxed text-gray-300 select-text`}
      >
        {/* Section 1: Data Collection */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FFD700]" />
            1. Personal & Financial Information We Collect
          </h3>
          <p>
            1.1. To provide real-time optical wagering, multi-currency wallet settlement, and anti-fraud security, Jungle Bet collects:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>
              <strong>Account & Identity Data:</strong> Username, email address, declared jurisdiction/location, date of birth, and government-issued KYC identification documents.
            </li>
            <li>
              <strong>Financial & FX Transaction Data:</strong> Deposit and withdrawal records across USD, EUR, GBP, UGX, KES, TZS, and NGN, payment gateway references (Stripe, Safaricom M-Pesa Daraja, Paystack, Flutterwave), and applied proprietary FX rates.
            </li>
            <li>
              <strong>Security & Telemetry Logs:</strong> IP addresses, device fingerprints, session timestamps, and betting velocity metrics analyzed by our Leo AI Fraud Detection Engine.
            </li>
          </ul>
        </section>

        {/* Section 2: Google Drive Integration & Cloud Data Storage */}
        <section className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-4 space-y-2">
          <h3 className="text-sky-300 font-bold text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-400" />
            2. Data Storage Architecture & Google Drive Integration
          </h3>
          <p>
            2.1. <strong>Primary Database & Encrypted Cloud Backups:</strong> Active account state, wallet balances, and optical betting history are stored in our encrypted PostgreSQL production cluster and Redis telemetry caches.
          </p>
          <p>
            2.2. <strong>Google Drive Enterprise Integration:</strong> For regulatory auditability, disaster recovery, and KYC document archival, Jungle Bet utilizes an automated <strong>Google Drive API / Google Cloud Workspace integration</strong>. Encrypted daily settlement snapshots, KYC identity verification artifacts, and immutable treasury audit logs are synchronized to restricted, access-controlled Google Drive compliance vaults with AES-256 encryption at rest.
          </p>
          <p className="text-xs text-gray-400">
            2.3. Access to Google Drive compliance folders is strictly restricted to authorized Jungle Bet Compliance & Treasury Officers under multi-factor authentication (MFA) and zero-trust IAM policies.
          </p>
        </section>

        {/* Section 3: Age Verification */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#FFD700]" />
            3. Mandatory Age Verification (18+) & KYC Screening
          </h3>
          <p className="text-red-400 font-semibold">
            3.1. STRICT 18+ ENFORCEMENT: We do not knowingly collect personal data from or provide services to anyone under 18 years of age.
          </p>
          <p>
            3.2. During onboarding and prior to processing withdrawals exceeding regulatory thresholds, users must complete age and identity verification. If an account is suspected of belonging to a minor, or if falsified age credentials are submitted, the account is immediately locked, deposits are handled in accordance with statutory gaming regulations, and verification logs are preserved.
          </p>
        </section>

        {/* Section 4: Cookies & LocalStorage */}
        <section className="space-y-2">
          <h3 className="text-white font-bold text-base">
            4. LocalStorage, Cookies & Session Security
          </h3>
          <p>
            4.1. Jungle Bet uses browser <code>localStorage</code> and secure cookies to store your JWT authentication tokens, theme preferences, 18+ age verification status, legal compliance acceptance timestamps, and 30-minute inactivity session timeout trackers.
          </p>
          <p>
            4.2. You may request access to, correction of, or statutory deletion of your personal data (subject to mandatory 5-year anti-money laundering and financial ledger retention laws) by contacting our Data Protection Officer via the Racer Profile portal.
          </p>
        </section>
      </div>

      {/* Mandatory Checkbox Footer */}
      {showCheckbox && (
        <div className="bg-[#1b1b1b] border-t border-white/15 px-5 py-4">
          <label className="flex items-start gap-3.5 cursor-pointer select-none group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                checked={effectiveChecked}
                onChange={(e) => handleToggle(e.target.checked)}
                data-testid="privacy-policy-checkbox"
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-[#FFD700]/60 bg-black/60 checked:border-[#FFD700] checked:bg-[#FFD700] transition-all"
              />
              <CheckCircle2 className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1">
              <span className="text-sm sm:text-base font-bold text-white group-hover:text-[#FFD700] transition-colors">
                I have read and agree to the Privacy Policy, including Google Drive data archival and 18+ Age Verification.
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                * Mandatory: Consents to identity/age verification, anti-fraud telemetry logging, and encrypted Google Drive compliance storage.
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default PrivacyPolicy;
