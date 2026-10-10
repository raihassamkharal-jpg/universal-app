import React, { useState, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  FileText,
  Check,
  Loader2,
  Calendar,
  Camera,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { uploadFileToStorage } from '../../lib/supabase/client';
import { getInitials, getAvatarColor, formatLastSeen } from '../../lib/utils';
import type { Profile } from '../../types/database';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: Profile | null; // If passed, view other user's profile; otherwise view/edit current user
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
}) => {
  const { profile: myProfile, updateProfile } = useAuth();
  const isSelf = !targetUser || targetUser.id === myProfile?.id;
  const activeProfile = isSelf ? myProfile : targetUser;

  const [displayName, setDisplayName] = useState(activeProfile?.display_name || '');
  const [username, setUsername] = useState(activeProfile?.username || '');
  const [status, setStatus] = useState(activeProfile?.status || '');
  const [avatarUrl, setAvatarUrl] = useState(activeProfile?.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !activeProfile) return null;

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar file size cannot exceed 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSelf) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setError('Username cannot be empty.');
      setSaving(false);
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3-24 characters containing only lowercase letters, numbers, and underscores.');
      setSaving(false);
      return;
    }

    let finalAvatarUrl = avatarUrl;

    // If a new avatar file was chosen, upload it to Supabase Storage
    if (avatarFile) {
      const uploadRes = await uploadFileToStorage(avatarFile, 'avatars');
      if (uploadRes.error || !uploadRes.publicUrl) {
        setError(`Avatar upload failed: ${uploadRes.error || 'Check storage permissions'}`);
        setSaving(false);
        return;
      }
      finalAvatarUrl = uploadRes.publicUrl;
    }

    const res = await updateProfile({
      display_name: displayName.trim() || activeProfile.username,
      username: cleanUsername,
      status: status.trim(),
      avatar_url: finalAvatarUrl.trim() || null,
    });

    setSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setAvatarUrl(finalAvatarUrl);
      setAvatarFile(null);
      setTimeout(() => setSuccess(false), 2500);
    }
  };

  const presence = formatLastSeen(activeProfile.last_seen);
  const displayAvatar = avatarPreview || avatarUrl || activeProfile.avatar_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">
            {isSelf ? 'Your Profile' : 'User Profile'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Avatar & Top Info */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-md overflow-hidden relative ${
                  displayAvatar ? 'bg-neutral-200' : getAvatarColor(activeProfile.username)
                }`}
              >
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={activeProfile.display_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(activeProfile.display_name || activeProfile.username)
                )}
              </div>

              {/* Upload avatar overlay button for self */}
              {isSelf && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Change profile picture"
                  >
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[9px] font-semibold">Change</span>
                  </button>
                </>
              )}
            </div>

            {isSelf && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload new photo</span>
              </button>
            )}

            <h3 className="mt-3 text-lg font-bold text-neutral-900">
              {activeProfile.display_name}
            </h3>
            <p className="text-sm font-mono text-neutral-500 font-medium">
              @{activeProfile.username}
            </p>

            {/* Online indicator */}
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  presence.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'
                }`}
              />
              <span>{presence.text}</span>
            </div>
          </div>

          {/* Form if self / Display info if other */}
          {isSelf ? (
            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Username Handle */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Unique Username Handle
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="your_handle"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Allowed: 3-24 characters (lowercase letters, numbers, and underscores).
                </p>
              </div>

              {/* Status / Bio */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  About / Status
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={140}
                    placeholder="Hey there! I am using Universal."
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[11px] font-semibold text-neutral-400 block mb-1 uppercase tracking-wider">
                  Status
                </span>
                <p className="text-sm text-neutral-700">
                  {activeProfile.status || 'Hey there! I am using Universal.'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-500 px-1">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span>
                  Member since{' '}
                  {new Date(activeProfile.created_at).toLocaleDateString([], {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
