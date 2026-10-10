import React from 'react';
import {
  MessageSquare,
  Phone,
  Share2,
  HardDrive,
  Bookmark,
  Search,
  Sliders,
  QrCode,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { getInitials, getAvatarColor } from '../../lib/utils';
import type { MainViewTab } from '../../types/database';

interface HeaderProps {
  activeTab?: MainViewTab;
  onTabChange?: (tab: MainViewTab) => void;
  onOpenProfile: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenIdCard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'chats',
  onTabChange,
  onOpenProfile,
  onOpenAuth,
  onOpenSearch,
  onOpenSettings,
  onOpenIdCard,
}) => {
  const { user, profile, signOut } = useAuth();

  const navTabs: { id: MainViewTab; label: string; icon: React.ElementType }[] = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'calls', label: 'Calls', icon: Phone },
    { id: 'social', label: 'Social', icon: Share2 },
    { id: 'drive', label: 'Drive', icon: HardDrive },
    { id: 'capsule', label: 'Capsule', icon: Bookmark },
  ];

  return (
    <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between gap-2 text-neutral-900 dark:text-neutral-100">
      {/* Zone 1: Logo & Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => onTabChange?.('chats')}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs group-hover:bg-orange-600 transition-colors">
            <span className="font-extrabold text-lg tracking-tight">U</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white leading-none">
              Universal
            </span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5 hidden sm:inline">
              Connect Everyone
            </span>
          </div>
        </button>
      </div>

      {/* Zone 2: Navigation Hub Tabs (desktop & larger screens only — mobile uses bottom navigation) */}
      {user && onTabChange && (
        <nav className="hidden md:flex items-center gap-1 bg-neutral-100/80 dark:bg-neutral-800/80 p-1 rounded-2xl border border-neutral-200/60 dark:border-neutral-700/60 overflow-x-auto max-w-[280px] sm:max-w-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-neutral-900 text-orange-600 dark:text-orange-400 shadow-2xs font-bold'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Zone 3: Actions & Profile */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {user && profile ? (
          <>
            {/* Global Search */}
            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                title="Global Search"
                aria-label="Global Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Universal QR ID Card */}
            {onOpenIdCard && (
              <button
                onClick={onOpenIdCard}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                title="Universal QR ID Card"
                aria-label="Universal QR ID Card"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}

            {/* Real Notification Bell */}
            <NotificationBell currentUserId={user.id} />

            {/* Settings Button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                title="Settings & Calls"
                aria-label="Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            {/* Profile Avatar Trigger */}
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 py-1 px-1.5 sm:px-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
              title="View your profile"
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
                  profile.avatar_url ? 'bg-neutral-200 dark:bg-neutral-700' : getAvatarColor(profile.username)
                }`}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(profile.display_name || profile.username)
                )}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight truncate max-w-[100px]">
                  {profile.display_name}
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate max-w-[100px]">
                  @{profile.username}
                </span>
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={() => signOut()}
              className="p-2 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              title="Log out securely"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuth?.('login')}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={() => onOpenAuth?.('register')}
              className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors shadow-xs whitespace-nowrap cursor-pointer"
            >
              Get Started
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
