import React from 'react';
import {
  MessageSquare,
  AtSign,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Search,
  CheckCheck,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenPrivacyPolicy?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onOpenPrivacyPolicy }) => {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Hero Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Modern Username-Based Messaging
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1] text-balance">
                Universal
              </h1>

              <div className="space-y-2 text-lg sm:text-xl text-neutral-600 font-normal">
                <p className="font-semibold text-neutral-900">Connect Everyone.</p>
                <p>Search by username.</p>
                <p>Start a conversation instantly.</p>
              </div>

              <p className="text-sm sm:text-base text-neutral-500 max-w-xl leading-relaxed">
                Experience lightweight, private one-to-one communication without sharing phone numbers.
                Instant live delivery, clean typography, and zero clutter.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-orange-500/15 flex items-center gap-2 group whitespace-nowrap cursor-pointer"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-6 py-3.5 bg-white hover:bg-neutral-100 text-neutral-800 font-semibold text-sm rounded-xl border border-neutral-200 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
                >
                  Log in
                </button>
              </div>

              {/* Trust markers */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Row-level security
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Real-time sync
                </span>
                <span aria-hidden="true">·</span>
                <span>No phone number needed</span>
              </div>
            </div>

            {/* Right Column: High-fidelity Interface Mockup / Generated Asset */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Visual Card Mockup */}
                <div className="bg-white rounded-2xl shadow-xl border border-neutral-200/80 p-5 space-y-4">
                  {/* Mock search bar */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-500">
                    <Search className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Search username: @hassam</span>
                  </div>

                  {/* Mock active conversation header */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                        HK
                      </div>
                      <div>
                        <div className="font-bold text-sm text-neutral-900 leading-tight">Hassam Kharal</div>
                        <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active now
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">@hassam</span>
                  </div>

                  {/* Mock chat messages */}
                  <div className="space-y-3 py-2 text-xs">
                    <div className="flex justify-start">
                      <div className="bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-xs px-3.5 py-2 max-w-[80%] space-y-1">
                        <p>Hey! Did you check out the new messaging platform?</p>
                        <span className="block text-[10px] text-neutral-400 text-right">10:41 AM</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="bg-orange-500 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[80%] space-y-1 shadow-xs">
                        <p>Yes, finding friends by @username is so effortless! Messages arrive instantly.</p>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-orange-200">
                          <span>10:42 AM</span>
                          <CheckCheck className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mock input field */}
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 py-2 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-400">
                      Type a message...
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Ambient glow accent */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="py-16 bg-white border-y border-neutral-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight text-balance">
              Designed for effortless direct communication
            </h2>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Everything you need for instant one-to-one chats, built with privacy and speed at the core.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/60 space-y-3 hover:border-orange-200 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <AtSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Username-Based Discovery</h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Claim your handle like <span className="font-mono text-neutral-900 font-medium">@username</span>.
                Search for friends without exchanging sensitive phone numbers or personal identifiers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/60 space-y-3 hover:border-orange-200 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Real-Time WebSocket Sync</h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Messages, typing updates, and read confirmations stream directly to your active device
                with zero page refreshes and sub-second latency.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/60 space-y-3 hover:border-orange-200 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Protected Conversations</h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Database-enforced Row Level Security ensures only members of a conversation can ever read or send
                messages in that private thread.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action footer banner */}
      <section className="py-16 bg-neutral-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            Ready to start chatting?
          </h2>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            Create your account in under 30 seconds, pick your unique username, and begin messaging.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-orange-500/20 cursor-pointer"
            >
              Claim Your Username
            </button>
          </div>
        </div>
      </section>

      {/* Quiet footer */}
      <footer className="py-6 border-t border-neutral-200 text-center text-xs text-neutral-500">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <p>&copy; {new Date().getFullYear()} Universal — Connect Everyone. All rights reserved.</p>
          {onOpenPrivacyPolicy && (
            <>
              <span className="hidden sm:inline text-neutral-300">·</span>
              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="text-neutral-600 hover:text-orange-600 font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                Privacy & Data Policy (WebRTC & Zero Tracking)
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
