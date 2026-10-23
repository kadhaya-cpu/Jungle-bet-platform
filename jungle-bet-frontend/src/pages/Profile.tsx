import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Copy,
  Gift,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useWalletStore } from '../store/useWalletStore';
import {
  LanguageCode,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
} from '../utils/constants';
import { formatCurrency } from '../utils/formatCurrency';
import { Button } from '../components/common/Button';

/**
 * Racer Profile Page — Account Dossier, KYC Upload Hook, Affiliate Program & i18n Settings
 */
export const Profile: React.FC = () => {
  const { user, language, setLanguage, updateUser } = useAuthStore();
  const { balance, preferredCurrency, setPreferredCurrency } = useWalletStore();

  const [docType, setDocType] = useState<'passport' | 'national_id' | 'drivers_license'>(
    'passport'
  );
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const referralCode =
    user?.referral_code || `JB-${(user?.username || 'RACER').toUpperCase()}-2026`;
  const referralUrl = `${window.location.origin}/register?ref=${referralCode}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied to clipboard!');
  };

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileName) {
      toast.error('Please select a valid identity document first.');
      return;
    }
    updateUser({ kyc_status: 'pending' });
    toast.success('KYC document submitted for compliance review!');
  };

  return (
    <div className="space-y-6">
      {/* Top Profile Summary Card */}
      <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-amber-600 text-[#0f0f0f] flex items-center justify-center font-black text-2xl shadow-lg">
            {(user?.username || 'R').slice(0, 1).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{user?.username || 'Racer'}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30">
                {user?.role || 'user'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Vault Balance:{' '}
              <span className="text-[#FFD700] font-bold">
                {formatCurrency(balance, 'USD')}
              </span>{' '}
              • Preferred Currency: {preferredCurrency}
            </p>
          </div>
        </div>

        {/* Leo AI Security Standing Badge */}
        <div className="flex items-center gap-2">
          {user?.is_flagged ? (
            <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-300 font-semibold">
              <ShieldAlert className="w-4 h-4 text-[#FFD700]" />
              <span>Flagged by Leo AI ({user.flag_reason || 'Review Pending'})</span>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Leo AI Security Standing: Verified Clean</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KYC Verification Upload Component (Future-Ready Hook) */}
        <form
          onSubmit={handleKycSubmit}
          className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#FFD700]" />
              <h2 className="text-base font-bold text-white">KYC Identity Verification</h2>
            </div>
            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFD700]">
              {user?.kyc_status || 'unverified'}
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Upload your government-issued ID to unlock higher instant withdrawal limits (&gt; $1,000
            USD) and fast-track compliance review.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as typeof docType)}
              className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
            >
              <option value="passport">International Passport</option>
              <option value="national_id">National Identity Card</option>
              <option value="drivers_license">Driver&apos;s License</option>
            </select>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-[#FFD700]/60 rounded-2xl p-6 cursor-pointer transition-colors bg-[#141414]">
            <Upload className="w-6 h-6 text-[#FFD700] mb-2" />
            <span className="text-xs font-semibold text-white">
              {selectedFileName || 'Click to select ID scan (PDF, JPG, PNG)'}
            </span>
            <span className="text-[11px] text-gray-500 mt-1">
              Encrypted 256-bit compliance upload
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) =>
                setSelectedFileName(e.target.files?.[0]?.name || '')
              }
            />
          </label>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Submit KYC Verification
          </Button>
        </form>

        {/* Affiliate & Referral Program Section (Future-Ready Hook) */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#1f1a0a] to-[#1a1a1a] border border-[#FFD700]/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#FFD700]" />
                <h2 className="text-base font-bold text-white">
                  Affiliate & Referral Rewards
                </h2>
              </div>
              <span className="text-xs font-extrabold text-[#FFD700]">15% RevShare</span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Invite fellow traffic telemetry predictors and earn 15% commission on net house spread
              from every wager they place.
            </p>

            <div className="rounded-xl bg-[#121212] border border-white/10 p-3 flex items-center justify-between gap-2">
              <div className="truncate text-xs font-mono text-[#FFD700]">
                {referralUrl}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyReferral}
                leftIcon={<Copy className="w-3.5 h-3.5" />}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Preferences: Multi-language (i18n) & Currency */}
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Globe className="w-4 h-4 text-[#FFD700]" />
              <h3 className="text-sm font-bold text-white">
                Localization & Currency Preferences
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Interface Language (i18n)
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#1a1a1a]">
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Display Currency
                </label>
                <select
                  value={preferredCurrency}
                  onChange={(e) => setPreferredCurrency(e.target.value)}
                  className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#1a1a1a]">
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
