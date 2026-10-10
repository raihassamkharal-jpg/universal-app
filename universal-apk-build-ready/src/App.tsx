/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { LandingPage } from './components/landing/LandingPage';
import { ChatLayout } from './components/chat/ChatLayout';
import { CallHistoryView } from './components/calling/CallHistoryView';
import { CallModal } from './components/calling/CallModal';
import { SocialFeedView } from './components/social/SocialFeedView';
import { UniversalDriveView } from './components/drive/UniversalDriveView';
import { MessageCapsuleView } from './components/capsule/MessageCapsuleView';
import { SettingsModal } from './components/settings/SettingsModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { UniversalIdCardModal } from './components/qr/UniversalIdCardModal';
import { AuthModal } from './components/auth/AuthModal';
import { UserProfileModal } from './components/chat/UserProfileModal';
import { PrivacyPolicyModal } from './components/privacy/PrivacyPolicyModal';
import { callManager } from './lib/webrtc/callManager';
import { callNotificationService } from './lib/notifications/callNotificationService';
import {
  MessageSquare,
  Phone,
  Share2,
  HardDrive,
  Bookmark,
  Loader2,
} from 'lucide-react';
import type { MainViewTab, Profile } from './types/database';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<MainViewTab>('chats');
  const [isChatActive, setIsChatActive] = useState(false);

  // Modals state
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
  }>({
    isOpen: false,
    mode: 'login',
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<Profile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIdCardOpen, setIsIdCardOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);

  // Initialize WebRTC calling listeners whenever the user logs in or profile updates
  useEffect(() => {
    callNotificationService.initialize().catch(() => {});
    if (user) {
      callManager.initializeForUser(user, profile);
      callNotificationService.registerDeviceSubscription(user.id).catch(() => {});

      // Inspect URL parameters for actions triggered from Service Worker notifications
      try {
        const params = new URLSearchParams(window.location.search);
        const callAction = params.get('callAction') as 'answer' | 'decline' | 'open' | null;
        const callId = params.get('callId');
        const callType = (params.get('callType') || 'audio') as 'audio' | 'video';
        if (callId && callAction) {
          // Clean the query parameter from URL to prevent duplicate action on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          callManager.handleDeepLinkCall(callId, callAction, callType);
        }
      } catch {}
    }
  }, [user, profile]);

  // Apply saved theme & language directions on mount, and sync with profile
  useEffect(() => {
    const savedTheme = profile?.theme_preference || localStorage.getItem('universal_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedLang = profile?.language || localStorage.getItem('universal_lang');
    if (savedLang === 'ar' || savedLang === 'ur') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [profile?.theme_preference, profile?.language]);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalState({ isOpen: true, mode });
  };

  const handleCloseAuth = () => {
    setAuthModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenUserProfile = (targetUser?: Profile) => {
    setProfileModalTarget(targetUser || null);
    setIsProfileModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md mb-4 animate-bounce">
          <span className="font-extrabold text-xl">U</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          <span>Connecting to Universal...</span>
        </div>
      </div>
    );
  }

  const mobileTabs = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'calls', label: 'Calls', icon: Phone },
    { id: 'social', label: 'Social', icon: Share2 },
    { id: 'drive', label: 'Drive', icon: HardDrive },
    { id: 'capsule', label: 'Capsule', icon: Bookmark },
  ] as const;

  return (
    <div className="h-screen h-[100dvh] w-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden select-none">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={() => handleOpenUserProfile()}
        onOpenAuth={handleOpenAuth}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenIdCard={() => setIsIdCardOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden relative">
        {user ? (
          <>
            {activeTab === 'chats' && (
              <ChatLayout onActiveChatChange={(isActive) => setIsChatActive(isActive)} />
            )}
            {activeTab === 'calls' && (
              <CallHistoryView
                currentUserId={user.id}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onStartNewCall={() => setActiveTab('chats')}
              />
            )}
            {activeTab === 'social' && (
              <SocialFeedView
                currentUserId={user.id}
                onOpenProfile={(target) => handleOpenUserProfile(target)}
              />
            )}
            {activeTab === 'drive' && <UniversalDriveView currentUserId={user.id} />}
            {activeTab === 'capsule' && <MessageCapsuleView currentUserId={user.id} />}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <LandingPage
              onOpenAuth={handleOpenAuth}
              onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile screens when authenticated AND not in active conversation) */}
      {user && !isChatActive && (
        <nav className="md:hidden h-16 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs flex items-center justify-around px-2 z-20 shrink-0">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-colors cursor-pointer ${
                  isActive ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Global WebRTC In-Call and Incoming Call Screen */}
      <CallModal />

      {/* Global Search Modal */}
      {user && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          currentUserId={user.id}
          onSelectUser={(selectedUser) => {
            setActiveTab('chats');
            handleOpenUserProfile(selectedUser);
          }}
        />
      )}

      {/* Universal QR ID Card Modal */}
      {user && profile && (
        <UniversalIdCardModal
          isOpen={isIdCardOpen}
          onClose={() => setIsIdCardOpen(false)}
          profile={profile}
        />
      )}

      {/* Comprehensive Settings Modal */}
      {user && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={handleCloseAuth}
        onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
        onOpenDataManagement={() => {
          setIsPrivacyPolicyOpen(false);
          if (user) {
            setIsSettingsOpen(true);
          }
        }}
      />

      {/* Profile Modal */}
      {user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          targetUser={profileModalTarget}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
