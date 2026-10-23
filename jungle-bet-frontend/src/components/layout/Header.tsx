import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Sun,
  Moon,
  Wallet,
  LogOut,
  User as UserIcon,
  Globe,
  Menu,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import {
  I18N_TRANSLATIONS,
  LanguageCode,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
} from '../../utils/constants';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface HeaderProps {
  onOpenMobileSidebar?: () => void;
}

/**
 * Top Navigation Bar with Leo AI Fraud Alert Banner, Theme Toggle, Currency & i18n Switchers
 */
export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, theme, toggleTheme, language, setLanguage, logout } =
    useAuthStore();
  const { balance, preferredCurrency, setPreferredCurrency } = useWalletStore();

  const t = I18N_TRANSLATIONS[language] || I18N_TRANSLATIONS.en;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0f0f0f]/90 border-b border-white/10">
      {/* Leo AI Fraud Alert Hook Banner (visible when user.is_flagged is true) */}
      {isAuthenticated && user?.is_flagged && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 text-[#FFD700] shrink-0 animate-pulse" />
            <span>
              {t.leo_fraud_banner}{' '}
              {user.flag_reason ? `(${user.flag_reason})` : ''}
            </span>
          </div>
          <Link
            to="/profile"
            className="underline font-semibold text-[#FFD700] hover:text-amber-200 ml-4 shrink-0"
          >
            Verify KYC →
          </Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Mobile Menu & Brand Logo */}
        <div className="flex items-center gap-3">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-[#1a1a1a] border border-white/10 text-gray-300 hover:text-[#FFD700]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFD700] to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.3)] group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-[#0f0f0f]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  JUNGLE<span className="text-[#FFD700]">BET</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  YOLOv8 Live
                </span>
              </div>
              <p className="text-[10px] text-gray-400 hidden sm:block leading-none">
                Optical Traffic Telemetry Wagering
              </p>
            </div>
          </Link>
        </div>

        {/* Right Controls: Language, Currency, Theme Toggle, Wallet Pill & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Multi-language i18n selector */}
          <div className="hidden md:flex items-center gap-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-2.5 py-1.5">
            <Globe className="w-3.5 h-3.5 text-[#FFD700]" />
            <select
              aria-label="Select language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-xs font-medium text-gray-200 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#1a1a1a] text-white">
                  {lang.flag} {lang.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Display Currency Switcher */}
          <div className="hidden sm:flex items-center bg-[#1a1a1a] border border-white/10 rounded-xl px-2.5 py-1.5">
            <select
              aria-label="Select display currency"
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#FFD700] focus:outline-none cursor-pointer"
            >
              {Object.keys(SUPPORTED_CURRENCIES).map((code) => (
                <option key={code} value={code} className="bg-[#1a1a1a] text-white">
                  {code} ({SUPPORTED_CURRENCIES[code].symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-xl bg-[#1a1a1a] border border-white/10 text-gray-300 hover:text-[#FFD700] hover:border-[#FFD700]/40 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#FFD700]" />
            ) : (
              <Moon className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {isAuthenticated && user ? (
            <>
              {/* Real-Time Balance Pill */}
              <Link
                to="/wallet"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1a1a] border border-[#FFD700]/30 hover:border-[#FFD700] transition-colors"
              >
                <Wallet className="w-4 h-4 text-[#FFD700]" />
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {formatCurrency(balance, 'USD')}
                  </div>
                  {preferredCurrency !== 'USD' && (
                    <div className="text-[10px] text-[#FFD700] leading-none">
                      ≈ {formatCurrency(balance, preferredCurrency, { convertFromUsd: true })}
                    </div>
                  )}
                </div>
              </Link>

              {/* Profile & Logout */}
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1a1a] border border-white/10 hover:border-white/30 text-xs font-semibold text-gray-200"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#FFD700]" />
                <span className="max-w-[90px] truncate">{user.username}</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl bg-[#1a1a1a] border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Join Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
