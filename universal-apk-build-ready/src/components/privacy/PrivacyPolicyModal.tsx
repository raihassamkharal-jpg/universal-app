import React from 'react';
import { X, ShieldCheck, Lock, Eye, Download, Trash2, Smartphone, CheckCircle, ExternalLink } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDataManagement?: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  onOpenDataManagement,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-3xl h-[85vh] max-h-[700px] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Universal Privacy & Data Policy
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Effective Date: September 25, 2026 · Transparent & Plain-Language
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Close Privacy Policy"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {/* Quick Summary Pill Banner */}
          <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/60 space-y-2">
            <h3 className="font-bold text-orange-900 dark:text-orange-300 flex items-center gap-1.5 text-xs sm:text-sm">
              <CheckCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              Summary at a Glance
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-orange-950 dark:text-orange-200/90">
              <li>No phone numbers required — accounts are identified solely by unique usernames.</li>
              <li>Peer-to-peer WebRTC calls — call audio & video stream directly between browsers and are <strong>never recorded or stored</strong>.</li>
              <li>24-hour expiring status updates with customizable visibility (Everyone, Contacts, Only Me).</li>
              <li>Full user data export and one-click self-service account deletion available directly in Settings.</li>
            </ul>
          </div>

          {/* Section 1: Information We Collect */}
          <section className="space-y-2">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
              1. Information We Collect
            </h3>
            <p>
              Universal collects only the minimal data strictly necessary to provide real-time messaging, social interaction, and browser communications:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                <span className="font-bold text-xs text-neutral-900 dark:text-white block mb-0.5">Account & Profile</span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Email, chosen unique @username, display name, avatar URL, and optional bio status. No phone numbers are collected.
                </p>
              </div>
              <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                <span className="font-bold text-xs text-neutral-900 dark:text-white block mb-0.5">Messages & Media</span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Direct messages, voice recordings, shared photos, and file attachments securely routed via Supabase database and storage buckets.
                </p>
              </div>
              <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                <span className="font-bold text-xs text-neutral-900 dark:text-white block mb-0.5">Social & Statuses</span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Posts, comments, likes, and 24-hour status stories. Statuses automatically expire and cease display after 24 hours.
                </p>
              </div>
              <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                <span className="font-bold text-xs text-neutral-900 dark:text-white block mb-0.5">Call History & Signaling</span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Timestamps, duration, and call status (answered, missed, ended) for your call log. Media streams remain strictly peer-to-peer.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: WebRTC Peer-to-Peer Calling Policy */}
          <section className="space-y-2">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
              2. WebRTC Peer-to-Peer Calls (Zero Media Storage)
            </h3>
            <p>
              When initiating or receiving voice and video calls through Universal:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
              <li>Media packets (your camera video and microphone audio) travel directly between participants via encrypted WebRTC peer connections.</li>
              <li>Universal servers and databases <strong>never record, tap, listen to, or store your voice or video calls</strong>.</li>
              <li>Public STUN servers (such as Google STUN) are utilized solely for network address translation (NAT) handshake routing.</li>
            </ul>
          </section>

          {/* Section 3: Third-Party Authentication & Google OAuth */}
          <section className="space-y-2">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
              3. Third-Party Authentication & Google OAuth
            </h3>
            <p>
              When you choose to sign in with Google or an OAuth provider:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
              <li>We receive only your public profile info (name, email, and avatar) from the provider to establish your account.</li>
              <li>We never request or access your Google contacts, Google Drive files, or Google account passwords.</li>
              <li>Google OAuth credentials are exchanged securely via standard OAuth 2.0 and Supabase Auth.</li>
            </ul>
          </section>

          {/* Section 4: Privacy Settings & Controls */}
          <section className="space-y-2">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
              4. Privacy Controls & Data Retention
            </h3>
            <p>
              You maintain full control over your privacy directly in the Settings menu:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
              <li><strong>Status Visibility:</strong> Choose who views your 24h stories (Everyone, Contacts Only, or Only Me).</li>
              <li><strong>Read Receipts & Typing:</strong> Enable or disable read confirmations and live typing bubbles at any time.</li>
              <li><strong>Contact Blocking:</strong> Block any user from sending you messages or calling you.</li>
              <li><strong>Retention:</strong> Statuses expire and are hidden after 24 hours. Messages persist in your private thread until deleted by participants.</li>
            </ul>
          </section>

          {/* Section 5: Data Portability & Account Deletion */}
          <section className="space-y-3">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
              5. Your Rights: Data Export & Self-Account Deletion
            </h3>
            <p>
              Under applicable data protection laws (including GDPR and CCPA), you have the right to access and erase your personal data at any time:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="flex-1 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
                <span className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-orange-500" /> Export Personal Data
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Download a complete, machine-readable JSON archive of your profile, posts, call logs, and drive records.
                </p>
              </div>
              <div className="flex-1 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1.5">
                <span className="font-bold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Permanent Account Deletion
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Self-service purge: deletes your profile, posts, active statuses, call logs, and credentials instantly.
                </p>
              </div>
            </div>
            {onOpenDataManagement && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDataManagement();
                }}
                className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Go to Settings → Privacy & Data Management</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </section>

          {/* Section 6: Contact */}
          <section className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
              6. Contact & Support
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              For security reports or privacy inquiries, please contact the administrative team at{' '}
              <span className="font-mono text-neutral-700 dark:text-neutral-300">privacy@universal-chat.local</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40">
          <span className="text-[11px] text-neutral-400 font-mono">Universal Protocol v2.5</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
