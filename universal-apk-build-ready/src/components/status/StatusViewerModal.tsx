import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Clock, Users } from 'lucide-react';
import { recordStatusView, deleteStatus, fetchStatusViewers } from '../../lib/supabase/client';
import { getInitials, getAvatarColor, formatMessageTime } from '../../lib/utils';
import type { UserStatus, Profile } from '../../types/database';

interface StatusViewerModalProps {
  isOpen: boolean;
  statuses: UserStatus[];
  initialIndex?: number;
  currentUserId: string;
  onClose: () => void;
  onStatusDeleted?: (statusId: string) => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  isOpen,
  statuses,
  initialIndex = 0,
  currentUserId,
  onClose,
  onStatusDeleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const [viewers, setViewers] = useState<Profile[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const activeStatus = statuses[currentIndex];
  const isMine = activeStatus?.user_id === currentUserId;

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      setShowViewersList(false);
    }
  }, [isOpen, initialIndex]);

  // Mark status as viewed in Supabase
  useEffect(() => {
    if (isOpen && activeStatus && currentUserId) {
      recordStatusView(activeStatus.id, currentUserId);
    }
  }, [isOpen, activeStatus, currentUserId]);

  const handleNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      onClose();
    }
  }, [currentIndex, statuses.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    }
  }, [currentIndex]);

  // Main story progress timer
  useEffect(() => {
    if (!isOpen || isPaused || showViewersList || !activeStatus) return;

    const interval = 50; // update every 50ms
    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgress(pct);

      if (elapsed >= STORY_DURATION) {
        clearInterval(intervalId);
        handleNext();
      }
    }, interval);

    return () => clearInterval(intervalId);
  }, [isOpen, isPaused, showViewersList, activeStatus, handleNext, currentIndex]);

  const handlePause = () => {
    setIsPaused(true);
    elapsedBeforePauseRef.current = (progress / 100) * STORY_DURATION;
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleDelete = async () => {
    if (!activeStatus) return;
    const ok = window.confirm('Delete this status update?');
    if (!ok) return;

    await deleteStatus(activeStatus.id, currentUserId);
    onStatusDeleted?.(activeStatus.id);
    if (statuses.length <= 1) {
      onClose();
    } else {
      handleNext();
    }
  };

  const handleOpenViewers = async () => {
    if (!activeStatus) return;
    setIsPaused(true);
    setShowViewersList(true);
    setLoadingViewers(true);
    const list = await fetchStatusViewers(activeStatus.id);
    setViewers(list);
    setLoadingViewers(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen || !activeStatus) return null;

  const author = activeStatus.user;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Story Card Container */}
      <div
        className="relative w-full max-w-sm sm:max-w-md h-[85vh] max-h-[780px] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handlePause}
        onMouseUp={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        {/* Top Story Controls & Progress Bars */}
        <div className="absolute inset-x-0 top-0 z-20 p-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Progress Segments */}
          <div className="flex gap-1 mb-3">
            {statuses.map((s, idx) => {
              let fillPct = 0;
              if (idx < currentIndex) fillPct = 100;
              else if (idx === currentIndex) fillPct = progress;

              return (
                <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all ease-linear"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ring-2 ring-orange-500 ${
                  author?.avatar_url ? 'bg-neutral-800' : getAvatarColor(author?.username || 'user')
                }`}
              >
                {author?.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.display_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(author?.display_name || author?.username || 'User')
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                  {isMine ? 'Your Status' : author?.display_name || 'User'}
                </span>
                <span className="text-[10px] text-white/70 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatMessageTime(activeStatus.created_at)}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isMine && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2 text-white/80 hover:text-rose-400 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Delete this status"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {activeStatus.media_url ? (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              {activeStatus.media_url.includes('.mp4') ||
              activeStatus.media_url.includes('.webm') ||
              activeStatus.media_url.includes('.mov') ||
              activeStatus.media_url.startsWith('data:video') ? (
                <video
                  src={activeStatus.media_url}
                  autoPlay
                  playsInline
                  onEnded={handleNext}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={activeStatus.media_url}
                  alt="Status Media"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
              {activeStatus.content && (
                <div className="absolute inset-x-0 bottom-12 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center">
                  <p className="text-white text-sm font-medium drop-shadow-md">
                    {activeStatus.content}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`w-full h-full ${
                activeStatus.background_color || 'bg-gradient-to-tr from-orange-500 to-amber-500'
              } p-8 flex items-center justify-center text-center`}
            >
              <p className="text-white text-2xl sm:text-3xl font-bold leading-relaxed break-words max-w-sm drop-shadow-md">
                {activeStatus.content}
              </p>
            </div>
          )}

          {/* Left / Right click zones for story navigation */}
          <div
            className="absolute left-0 top-16 bottom-16 w-1/3 cursor-pointer"
            onClick={handlePrev}
            title="Previous"
          />
          <div
            className="absolute right-0 top-16 bottom-16 w-1/3 cursor-pointer"
            onClick={handleNext}
            title="Next"
          />
        </div>

        {/* Bottom Bar: If own story, show Viewers button */}
        {isMine && (
          <div className="absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center">
            <button
              type="button"
              onClick={handleOpenViewers}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Viewers</span>
            </button>
          </div>
        )}

        {/* Viewers modal popup */}
        {showViewersList && (
          <div
            className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm p-4 flex flex-col animate-in fade-in"
            onClick={() => setShowViewersList(false)}
          >
            <div
              className="mt-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-h-[60%] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Users className="w-4 h-4 text-orange-400" />
                  <span>Viewed by ({viewers.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewersList(false)}
                  className="p-1 text-white/60 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5">
                {loadingViewers ? (
                  <div className="py-6 text-center text-xs text-white/50">Loading viewers...</div>
                ) : viewers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-white/50">
                    No one has viewed this status yet.
                  </div>
                ) : (
                  viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAvatarColor(
                          viewer.username
                        )}`}
                      >
                        {getInitials(viewer.display_name || viewer.username)}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-white">
                          {viewer.display_name}
                        </span>
                        <span className="text-[10px] text-white/50">@{viewer.username}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
