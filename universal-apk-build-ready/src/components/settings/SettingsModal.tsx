import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  User,
  Shield,
  Bell,
  Phone,
  Palette,
  Globe,
  UserX,
  Upload,
  Play,
  Square,
  Check,
  Loader2,
  Mic,
  Video,
  Sun,
  Moon,
  Volume2,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  uploadFileToStorage,
  fetchBlockedUsers,
  unblockUser,
  exportUserData,
  deleteUserAccount,
} from '../../lib/supabase/client';
import { ringtonePlayer } from '../../lib/audio/ringtonePlayer';
import { requestNotificationPermission } from '../../lib/utils';
import { callNotificationService } from '../../lib/notifications/callNotificationService';
import type { Profile } from '../../types/database';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'account' | 'privacy' | 'privacy_data' | 'notifications' | 'calls' | 'appearance' | 'language' | 'blocked';
  onOpenPrivacyPolicy?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'account',
  onOpenPrivacyPolicy,
}) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Account State
  const [editDisplayName, setEditDisplayName] = useState(profile?.display_name || '');
  const [editBio, setEditBio] = useState(profile?.bio || profile?.status || '');
  const [savingAccount, setSavingAccount] = useState(false);

  // Calls & Audio Settings State
  const [customRingtoneUrl, setCustomRingtoneUrl] = useState(profile?.custom_ringtone_url || '');
  const [customOutgoingUrl, setCustomOutgoingUrl] = useState(profile?.custom_outgoing_tone_url || '');
  const [isPlayingIncomingPreview, setIsPlayingIncomingPreview] = useState(false);
  const [isPlayingOutgoingPreview, setIsPlayingOutgoingPreview] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Device Test State
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Device Test Functions
  const stopMicTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsTestingMic(false);
    setMicVolumeLevel(0);
  }, []);

  const stopCameraTest = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsTestingCamera(false);
  }, []);

  const startMicTest = useCallback(async () => {
    try {
      stopMicTest();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
      setIsTestingMic(true);
    } catch {
      showNotice('error', 'Unable to access microphone. Please check browser permissions.');
    }
  }, [stopMicTest]);

  const startCameraTest = useCallback(async () => {
    try {
      stopCameraTest();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setIsTestingCamera(true);
    } catch {
      showNotice('error', 'Unable to access camera. Please check browser permissions.');
    }
  }, [stopCameraTest]);

  // Privacy State
  const [readReceipts, setReadReceipts] = useState(profile?.privacy_read_receipts ?? true);
  const [typingIndicator, setTypingIndicator] = useState(profile?.privacy_typing ?? true);
  const [callPrivacy, setCallPrivacy] = useState(profile?.privacy_calls || 'everyone');
  const [onlinePrivacy, setOnlinePrivacy] = useState(profile?.privacy_online || 'everyone');
  const [statusPrivacy, setStatusPrivacy] = useState(profile?.privacy_status || 'everyone');

  // Appearance State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('universal_theme') as 'light' | 'dark') || 'light';
  });

  // Language State
  const [language, setLanguage] = useState<'en' | 'ur' | 'hi' | 'ar'>(() => {
    return (localStorage.getItem('universal_lang') as any) || 'en';
  });

  // Notifications Sound State
  const [playCallSounds, setPlayCallSounds] = useState<boolean>(() => {
    const val = localStorage.getItem('universal_pref_call_sound');
    return val !== 'false';
  });
  const [playMsgSounds, setPlayMsgSounds] = useState<boolean>(() => {
    const val = localStorage.getItem('universal_pref_msg_sound');
    return val !== 'false';
  });

  // Blocked Users
  const [blockedUsers, setBlockedUsers] = useState<Profile[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Saving status
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const showNotice = (type: 'error' | 'success' | 'info', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (profile) {
      setEditDisplayName(profile.display_name || '');
      setEditBio(profile.bio || profile.status || '');
      setCustomRingtoneUrl(profile.custom_ringtone_url || '');
      setCustomOutgoingUrl(profile.custom_outgoing_tone_url || '');
      setReadReceipts(profile.privacy_read_receipts ?? true);
      setTypingIndicator(profile.privacy_typing ?? true);
      setCallPrivacy(profile.privacy_calls || 'everyone');
      setOnlinePrivacy(profile.privacy_online || 'everyone');
      setStatusPrivacy(profile.privacy_status || 'everyone');
      if (profile.theme_preference) {
        setTheme(profile.theme_preference as 'light' | 'dark');
      }
      if (profile.language) {
        setLanguage(profile.language as any);
      }
    }
  }, [profile]);

  // Load blocked users when blocked tab opened
  useEffect(() => {
    if (activeTab === 'blocked' && profile?.id) {
      setLoadingBlocked(true);
      fetchBlockedUsers(profile.id).then((users) => {
        setBlockedUsers(users);
        setLoadingBlocked(false);
      });
    }
  }, [activeTab, profile?.id]);

  // Stop device testing on unmount or tab change
  useEffect(() => {
    return () => {
      stopMicTest();
      stopCameraTest();
      ringtonePlayer.stopAll();
    };
  }, [stopMicTest, stopCameraTest]);

  // Whenever modal closes, safely terminate any active mic or camera testing or ringtone previews
  useEffect(() => {
    if (!isOpen) {
      stopMicTest();
      stopCameraTest();
      ringtonePlayer.stopAll();
      setIsPlayingIncomingPreview(false);
      setIsPlayingOutgoingPreview(false);
    }
  }, [isOpen, stopMicTest, stopCameraTest]);

  // --- Audio Upload Handlers ---
  const handleAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'incoming' | 'outgoing'
  ) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      showNotice('error', 'Audio file size cannot exceed 10MB');
      return;
    }

    setUploadingAudio(true);
    const res = await uploadFileToStorage(file, 'audio-custom');
    setUploadingAudio(false);

    if (res.publicUrl) {
      if (type === 'incoming') {
        setCustomRingtoneUrl(res.publicUrl);
        await updateProfile({ custom_ringtone_url: res.publicUrl });
      } else {
        setCustomOutgoingUrl(res.publicUrl);
        await updateProfile({ custom_outgoing_tone_url: res.publicUrl });
      }
      setSaveSuccess(true);
      showNotice('success', 'Custom audio saved successfully!');
      setTimeout(() => setSaveSuccess(false), 2000);
    } else {
      showNotice('error', res.error || 'Audio upload failed. Please try again.');
    }
  };

  const handleToggleIncomingPreview = () => {
    if (isPlayingIncomingPreview) {
      ringtonePlayer.stopAll();
      setIsPlayingIncomingPreview(false);
    } else {
      ringtonePlayer.playIncomingRingtone(customRingtoneUrl);
      setIsPlayingIncomingPreview(true);
      setIsPlayingOutgoingPreview(false);
    }
  };

  const handleToggleOutgoingPreview = () => {
    if (isPlayingOutgoingPreview) {
      ringtonePlayer.stopAll();
      setIsPlayingOutgoingPreview(false);
    } else {
      ringtonePlayer.playOutgoingRingback(customOutgoingUrl);
      setIsPlayingOutgoingPreview(true);
      setIsPlayingIncomingPreview(false);
    }
  };

  const handleRestoreDefaultAudio = async (type: 'incoming' | 'outgoing') => {
    ringtonePlayer.stopAll();
    setIsPlayingIncomingPreview(false);
    setIsPlayingOutgoingPreview(false);

    if (type === 'incoming') {
      setCustomRingtoneUrl('');
      await updateProfile({ custom_ringtone_url: null });
    } else {
      setCustomOutgoingUrl('');
      await updateProfile({ custom_outgoing_tone_url: null });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // --- Save Account Profile ---
  const handleSaveAccount = async () => {
    if (!editDisplayName.trim()) {
      showNotice('error', 'Display name cannot be empty');
      return;
    }
    setSavingAccount(true);
    const res = await updateProfile({
      display_name: editDisplayName.trim(),
      bio: editBio.trim(),
      status: editBio.trim(),
    });
    setSavingAccount(false);
    if (res.error) {
      showNotice('error', res.error);
    } else {
      setSaveSuccess(true);
      showNotice('success', 'Profile updated successfully!');
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // --- Save Privacy Settings ---
  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    const res = await updateProfile({
      privacy_read_receipts: readReceipts,
      privacy_typing: typingIndicator,
      privacy_calls: callPrivacy as any,
      privacy_online: onlinePrivacy as any,
      privacy_status: statusPrivacy as any,
    });
    setSavingPrivacy(false);
    if (res.error) {
      showNotice('error', res.error);
    } else {
      setSaveSuccess(true);
      showNotice('success', 'Privacy preferences saved!');
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // --- Theme Toggle ---
  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('universal_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    await updateProfile({ theme_preference: newTheme });
  };

  // --- Language Toggle ---
  const handleLanguageChange = async (newLang: 'en' | 'ur' | 'hi' | 'ar') => {
    setLanguage(newLang);
    localStorage.setItem('universal_lang', newLang);
    if (newLang === 'ar' || newLang === 'ur') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
    await updateProfile({ language: newLang });
  };

  // --- Notification Sound Toggle ---
  const handleToggleCallSound = (enabled: boolean) => {
    setPlayCallSounds(enabled);
    localStorage.setItem('universal_pref_call_sound', String(enabled));
  };

  const handleToggleMsgSound = (enabled: boolean) => {
    setPlayMsgSounds(enabled);
    localStorage.setItem('universal_pref_msg_sound', String(enabled));
  };

  // --- Unblock User ---
  const handleUnblock = async (targetUserId: string) => {
    if (!profile?.id) return;
    const ok = await unblockUser(profile.id, targetUserId);
    if (ok) {
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      showNotice('success', 'Contact unblocked');
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'calls', label: 'Calls & Audio', icon: Phone },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'privacy_data', label: 'Data & Privacy Policy', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'language', label: 'Language', icon: Globe },
    { id: 'blocked', label: 'Blocked Users', icon: UserX },
  ] as const;

  // Data Export & Account Deletion state
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputConfirmation, setDeleteInputConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleExportData = async () => {
    if (!profile?.id) return;
    setExportingData(true);
    try {
      const data = await exportUserData(profile.id);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `universal_data_export_${profile.username || 'user'}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showNotice('success', 'Personal data archive downloaded successfully!');
    } catch (err: any) {
      console.error('Data export error:', err);
      showNotice('error', err?.message || 'Failed to export personal data.');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile?.id) return;
    if (deleteInputConfirmation.trim().toLowerCase() !== 'delete') {
      showNotice('error', 'Please type "DELETE" exactly to confirm.');
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await deleteUserAccount(profile.id);
      if (res.success) {
        showNotice('success', 'Your account and data have been permanently removed.');
        setTimeout(async () => {
          onClose();
          await signOut();
          window.location.reload();
        }, 1200);
      } else {
        showNotice('error', res.error || 'Failed to delete account.');
        setDeletingAccount(false);
      }
    } catch (err: any) {
      console.error('Account deletion error:', err);
      showNotice('error', err?.message || 'Failed to delete account.');
      setDeletingAccount(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-4xl h-[90vh] max-h-[720px] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Left Navigation Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/60 p-2 sm:p-4 flex md:flex-col shrink-0 overflow-x-auto md:overflow-x-visible no-scrollbar">
          <div className="hidden md:flex items-center gap-2.5 px-3 py-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
              U
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">Universal</h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Settings & Preferences</p>
            </div>
          </div>

          <div className="flex md:flex-col gap-1 w-full shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    stopMicTest();
                    stopCameraTest();
                    ringtonePlayer.stopAll();
                    setIsPlayingIncomingPreview(false);
                    setIsPlayingOutgoingPreview(false);
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content View */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-900 overflow-hidden">
          {/* Content Header */}
          <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white capitalize">
                {activeTab === 'calls' ? 'Calls & Audio Preferences' : activeTab}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Manage your real configuration and preferences
              </p>
            </div>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <button
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notice Banner */}
          {notice && (
            <div
              className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between animate-in fade-in shrink-0 ${
                notice.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                  : notice.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
              }`}
            >
              <span>{notice.message}</span>
              <button
                onClick={() => setNotice(null)}
                className="p-1 hover:opacity-75 cursor-pointer ml-2"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* 1. CALLS & AUDIO PREFERENCES */}
            {activeTab === 'calls' && (
              <div className="space-y-6">
                {/* Incoming Ringtone Customization */}
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Incoming Call Ringtone</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {customRingtoneUrl ? 'Custom uploaded audio active' : 'Universal Default Bell Melody'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleIncomingPreview}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isPlayingIncomingPreview ? (
                          <>
                            <Square className="w-3.5 h-3.5 text-rose-500" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Preview
                          </>
                        )}
                      </button>

                      {customRingtoneUrl && (
                        <button
                          onClick={() => handleRestoreDefaultAudio('incoming')}
                          className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Restore Default
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <label className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                      {uploadingAudio ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Upload Custom Ringtone (.mp3, .wav, .m4a)</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleAudioUpload(e, 'incoming')}
                      />
                    </label>
                  </div>
                </div>

                {/* Outgoing Ringback Tone Customization */}
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Outgoing Ringback Tone</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {customOutgoingUrl ? 'Custom uploaded tone active' : 'Universal Default 440+480Hz Cadence'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleOutgoingPreview}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isPlayingOutgoingPreview ? (
                          <>
                            <Square className="w-3.5 h-3.5 text-rose-500" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Preview
                          </>
                        )}
                      </button>

                      {customOutgoingUrl && (
                        <button
                          onClick={() => handleRestoreDefaultAudio('outgoing')}
                          className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Restore Default
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <label className="px-3.5 py-1.5 rounded-xl bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                      {uploadingAudio ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Upload Custom Outgoing Tone</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleAudioUpload(e, 'outgoing')}
                      />
                    </label>
                  </div>
                </div>

                {/* Device Hardware Testing */}
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-4">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Audio & Video Hardware Diagnostics</h4>

                  {/* Microphone test */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-neutral-500 dark:text-neutral-400" /> Test Microphone Volume Level
                      </span>
                      <button
                        onClick={isTestingMic ? stopMicTest : startMicTest}
                        className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
                      >
                        {isTestingMic ? 'Stop Mic Test' : 'Start Mic Test'}
                      </button>
                    </div>

                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-75"
                        style={{ width: `${micVolumeLevel}%` }}
                      />
                    </div>
                    {isTestingMic && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Speak into your microphone. The green meter will respond to your voice volume.
                      </p>
                    )}
                  </div>

                  {/* Camera test */}
                  <div className="pt-3 border-t border-neutral-200/80 dark:border-neutral-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-neutral-500 dark:text-neutral-400" /> Test Webcam Preview
                      </span>
                      <button
                        onClick={isTestingCamera ? stopCameraTest : startCameraTest}
                        className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
                      >
                        {isTestingCamera ? 'Stop Camera Test' : 'Start Camera Test'}
                      </button>
                    </div>

                    {isTestingCamera && (
                      <div className="w-full sm:w-64 aspect-video rounded-xl bg-neutral-900 overflow-hidden mt-2">
                        <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. ACCOUNT SETTINGS */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-4">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Edit Profile Details</h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400 block mb-1">Username (Permanent Handle)</span>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                        @{profile?.username}
                      </p>
                    </div>

                    <div>
                      <label className="text-neutral-500 dark:text-neutral-400 block mb-1 font-medium">Display Name</label>
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>

                    <div>
                      <label className="text-neutral-500 dark:text-neutral-400 block mb-1 font-medium">About / Bio Status</label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        rows={2}
                        placeholder="Share a status or bio note..."
                        className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 resize-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAccount}
                    disabled={savingAccount}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    {savingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Profile Changes</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                  <h4 className="font-bold text-sm text-rose-800 dark:text-rose-300">Security & Sign Out</h4>
                  <p className="text-xs text-rose-700/80 dark:text-rose-400">
                    Signing out will securely clear your session token on this device.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Log Out of Universal
                  </button>
                </div>
              </div>
            )}

            {/* 3. PRIVACY SETTINGS */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Read Receipts (Blue Ticks)</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Show message sender when you have read their message</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Typing Indicator</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Let contacts see when you are actively composing a message</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={typingIndicator}
                    onChange={(e) => setTypingIndicator(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                  <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Who Can Call Me</h4>
                  <select
                    value={callPrivacy}
                    onChange={(e) => setCallPrivacy(e.target.value as any)}
                    className="w-full py-2 px-3 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900"
                  >
                    <option value="everyone">Everyone on Universal</option>
                    <option value="contacts">Existing Contacts Only</option>
                    <option value="nobody">Nobody (Do Not Disturb)</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                  <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Who Can See My Status Updates</h4>
                  <select
                    value={statusPrivacy}
                    onChange={(e) => setStatusPrivacy(e.target.value as any)}
                    className="w-full py-2 px-3 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900"
                  >
                    <option value="everyone">Everyone (All Contacts)</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="nobody">Only Me</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                  <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Last Seen & Online Presence</h4>
                  <select
                    value={onlinePrivacy}
                    onChange={(e) => setOnlinePrivacy(e.target.value as any)}
                    className="w-full py-2 px-3 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <button
                  onClick={handleSavePrivacy}
                  disabled={savingPrivacy}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingPrivacy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Privacy Preferences</span>
                </button>
              </div>
            )}

            {/* 3.1 PRIVACY & DATA MANAGEMENT (Export, Deletion & Policy) */}
            {activeTab === 'privacy_data' && (
              <div className="space-y-6">
                {/* Official Privacy Policy Access */}
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-orange-500" /> Universal Privacy Policy
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Transparent disclosures regarding your data, peer-to-peer WebRTC calls, and storage practices.
                      </p>
                    </div>
                    {onOpenPrivacyPolicy && (
                      <button
                        onClick={onOpenPrivacyPolicy}
                        className="px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-orange-500" />
                        <span>Read Full Policy</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Data Export (GDPR Portability) */}
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-orange-500" /> Export Your Personal Data
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                      Download a complete, machine-readable JSON copy of all user-owned data stored on Universal (your profile, authored posts, call history logs, 24h statuses, and drive files).
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={exportingData}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {exportingData ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Preparing Data Archive...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download JSON Data Archive</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Permanent Account Deletion (Right to Erasure) */}
                <div className="p-4 sm:p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Permanent Account Deletion
                    </h4>
                    <p className="text-xs text-rose-700/90 dark:text-rose-400 mt-1 leading-relaxed">
                      Permanently and irrevocably delete your profile, handle, status updates, personal posts, drive records, and active sessions. This action cannot be undone.
                    </p>
                  </div>

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Request Permanent Deletion
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in">
                      <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          To confirm permanent deletion of <strong>@{profile?.username}</strong>, please type <strong>DELETE</strong> below:
                        </span>
                      </div>
                      <input
                        type="text"
                        value={deleteInputConfirmation}
                        onChange={(e) => setDeleteInputConfirmation(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="w-full p-2.5 rounded-xl border border-rose-300 dark:border-rose-700 text-xs bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white font-mono uppercase focus:outline-none"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deletingAccount || deleteInputConfirmation.trim().toLowerCase() !== 'delete'}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          {deletingAccount ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Purging Records...</span>
                            </>
                          ) : (
                            <span>Confirm & Erase My Account</span>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteInputConfirmation('');
                          }}
                          className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. NOTIFICATIONS SETTINGS */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-3">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Browser Push & Background Call Alerts</h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Receive instant system alerts with Answer and Decline actions for incoming audio/video calls and direct messages, even when Universal is minimized or in a background tab.
                  </p>
                  <button
                    onClick={async () => {
                      await callNotificationService.initialize();
                      const granted = await callNotificationService.requestPermission();
                      if (granted && user?.id) {
                        await callNotificationService.registerDeviceSubscription(user.id);
                      }
                      showNotice(
                        granted ? 'success' : 'info',
                        granted ? 'Push & background call notifications registered successfully!' : 'Notification permission was denied or dismissed.'
                      );
                    }}
                    className="px-4 py-2 bg-neutral-900 dark:bg-neutral-700 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Enable Background Call & Push Notifications
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Call Ringtone Audio</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Play ringing tones for incoming and outgoing calls</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={playCallSounds}
                    onChange={(e) => handleToggleCallSound(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">Message Alert Chimes</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Play subtle chime when receiving incoming chat messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={playMsgSounds}
                    onChange={(e) => handleToggleMsgSound(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* 5. APPEARANCE (Light / Dark Mode) */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Theme Preference</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <Sun className="w-8 h-8 text-amber-500" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-white">Universal Light Mode</span>
                  </button>

                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <Moon className="w-8 h-8 text-neutral-700 dark:text-orange-400" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-white">Universal Dark Mode</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. LANGUAGE & RTL */}
            {activeTab === 'language' && (
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Choose Language</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'en', name: 'English (US)', rtl: false },
                    { id: 'ur', name: 'اردو (Urdu)', rtl: true },
                    { id: 'ar', name: 'العربية (Arabic)', rtl: true },
                    { id: 'hi', name: 'हिन्दी (Hindi)', rtl: false },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => handleLanguageChange(l.id as any)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        language === l.id
                          ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <span className="text-xs font-semibold">{l.name}</span>
                      {language === l.id && <Check className="w-4 h-4 text-orange-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7. BLOCKED USERS */}
            {activeTab === 'blocked' && (
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Blocked Contacts</h4>
                {loadingBlocked ? (
                  <div className="flex items-center justify-center py-10 text-neutral-400">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 py-6 text-center">No blocked users.</p>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {blockedUsers.map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white">{u.display_name}</p>
                          <p className="text-[11px] text-neutral-400 font-mono">@{u.username}</p>
                        </div>
                        <button
                          onClick={() => handleUnblock(u.id)}
                          className="px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 cursor-pointer"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
