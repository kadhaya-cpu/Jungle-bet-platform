import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Flame,
  Wallet,
  User,
  ShieldCheck,
  Video,
  X,
  Bot,
  Send,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useBettingStore } from '../../store/useBettingStore';
import { I18N_TRANSLATIONS } from '../../utils/constants';

export interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Responsive Navigation Sidebar with Live Camera Junction Quick-Select & Admin Guard Link
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile = false, onCloseMobile }) => {
  const { user, language } = useAuthStore();
  const { games, selectedFeedId, setSelectedFeedId, activeBets } = useBettingStore();
  const t = I18N_TRANSLATIONS[language] || I18N_TRANSLATIONS.en;

  const navItems = [
    { to: '/', label: t.nav_home, icon: Home, end: true },
    {
      to: '/betting',
      label: t.nav_betting,
      icon: Flame,
      badge: activeBets.length > 0 ? String(activeBets.length) : 'LIVE',
    },
    { to: '/wallet', label: t.nav_wallet, icon: Wallet },
    { to: '/profile', label: t.nav_profile, icon: User },
  ];

  if (user?.role === 'admin') {
    navItems.push({
      to: '/admin',
      label: t.nav_admin,
      icon: ShieldCheck,
      badge: 'ADMIN',
    });
  }

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-6">
        {/* Mobile close header */}
        {onCloseMobile && (
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">
              Navigation
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Navigation Links */}
        <nav className="space-y-1.5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Platform Arena
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FFD700] text-[#0f0f0f] shadow-[0_0_20px_rgba(255,215,0,0.25)]'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#0f0f0f]' : 'text-[#FFD700]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#0f0f0f]/20 text-[#0f0f0f]'
                            : 'bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Live Camera Feeds Quick Switcher */}
        {games.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Optical Camera Feeds
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {games.length} Online
              </span>
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {games.map((feed) => {
                const isSelected = feed.id === selectedFeedId;
                return (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => {
                      setSelectedFeedId(feed.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#1a1a1a] border border-[#FFD700]/60 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Video
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-[#FFD700]' : 'text-gray-500'
                        }`}
                      />
                      <span className="truncate font-medium">{feed.location}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 uppercase shrink-0">
                      {feed.country_code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Compatibility Hooks: Leo AI Assistant & Telegram Daily Report Status */}
      <div className="space-y-2.5 pt-4 border-t border-white/10">
        <div className="rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs font-bold text-white">Leo AI Sentinel</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Real-time optical odds & anti-fraud protection active on all lanes.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#FFD700] font-semibold">
            <Send className="w-3 h-3" />
            <span>Telegram Daily Report Synced</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#141414] border-r border-white/10 min-h-[calc(100vh-4rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#141414] border-r border-white/10 h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
