import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { callManager, type CallSessionState } from '../../lib/webrtc/callManager';
import { getInitials, getAvatarColor, formatDuration } from '../../lib/utils';

export const CallModal: React.FC = () => {
  const [callState, setCallState] = useState<CallSessionState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteMediaElRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = callManager.subscribe((state) => {
      setCallState(state);
    });
    return unsubscribe;
  }, []);

  // Callback ref for remote media element (attaches immediately on mount)
  const setRemoteMediaRef = useCallback(
    (node: HTMLVideoElement | HTMLAudioElement | null) => {
      remoteMediaElRef.current = node;
      if (node && callState?.remoteStream) {
        if (node.srcObject !== callState.remoteStream) {
          node.srcObject = callState.remoteStream;
        }
        node
          .play?.()
          .then(() => setAutoplayBlocked(false))
          .catch((err) => {
            console.warn('[WebRTC] Remote media play blocked:', err);
            setAutoplayBlocked(true);
          });
      }
    },
    [callState?.remoteStream]
  );

  // Callback ref for local preview video
  const setLocalVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      localVideoElRef.current = node;
      if (node && callState?.localStream) {
        if (node.srcObject !== callState.localStream) {
          node.srcObject = callState.localStream;
        }
        node.play?.().catch(() => {});
      }
    },
    [callState?.localStream]
  );

  // Re-attach if streams change during session
  useEffect(() => {
    if (remoteMediaElRef.current && callState?.remoteStream) {
      if (remoteMediaElRef.current.srcObject !== callState.remoteStream) {
        remoteMediaElRef.current.srcObject = callState.remoteStream;
      }
      remoteMediaElRef.current
        .play?.()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }
  }, [callState?.remoteStream]);

  useEffect(() => {
    if (localVideoElRef.current && callState?.localStream) {
      if (localVideoElRef.current.srcObject !== callState.localStream) {
        localVideoElRef.current.srcObject = callState.localStream;
      }
      localVideoElRef.current.play?.().catch(() => {});
    }
  }, [callState?.localStream]);

  if (!callState) return null;

  const {
    callType,
    status,
    isCaller,
    otherUser,
    isMuted,
    isCameraOff,
    callDuration,
    error,
  } = callState;

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleUnblockAutoplay = () => {
    if (remoteMediaElRef.current) {
      remoteMediaElRef.current.play().then(() => setAutoplayBlocked(false)).catch(() => {});
    }
  };

  // 1. INCOMING CALL BANNER / MODAL (Ringing state for callee)
  if (status === 'ringing' && !isCaller) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center border border-neutral-100 flex flex-col items-center">
          {/* Animated Avatar Ring */}
          <div className="relative mb-4">
            <div className="absolute -inset-3 rounded-full bg-orange-500/20 animate-ping" />
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden shadow-lg border-4 border-white ${
                otherUser.avatar_url ? 'bg-neutral-200' : getAvatarColor(otherUser.username)
              }`}
            >
              {otherUser.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt={otherUser.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(otherUser.display_name || otherUser.username)
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-neutral-900 leading-tight">
            {otherUser.display_name}
          </h3>
          <p className="text-xs text-neutral-500 font-mono mt-0.5 mb-2">
            @{otherUser.username}
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold mb-6">
            {callType === 'video' ? (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Incoming Video Call...</span>
              </>
            ) : (
              <>
                <Phone className="w-3.5 h-3.5 animate-bounce" />
                <span>Incoming Audio Call...</span>
              </>
            )}
          </div>

          {/* Action Buttons: Accept / Reject */}
          <div className="flex items-center justify-center gap-6 w-full">
            <button
              onClick={() => callManager.rejectCall()}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 active:scale-95 transition-transform">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-neutral-600">Decline</span>
            </button>

            <button
              onClick={() => callManager.acceptCall()}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 active:scale-95 transition-transform animate-pulse">
                {callType === 'video' ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <Phone className="w-6 h-6" />
                )}
              </div>
              <span className="text-xs font-semibold text-neutral-600">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ERROR DISPLAY
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border border-rose-100">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-neutral-900 mb-2">Call Notice</h3>
          <p className="text-xs text-neutral-600 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => callManager.endCall()}
            className="w-full py-2.5 px-4 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // 3. ACTIVE IN-CALL MODAL
  const isVideo = callType === 'video';
  const isConnected = status === 'connected' || status === 'accepted';

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white select-none animate-in fade-in"
    >
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 z-20 h-16 px-4 sm:px-6 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden border border-white/20 ${
              otherUser.avatar_url ? 'bg-neutral-800' : getAvatarColor(otherUser.username)
            }`}
          >
            {otherUser.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(otherUser.display_name || otherUser.username)
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white leading-tight">
              {otherUser.display_name}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
              {isConnected ? (
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatDuration(callDuration)}
                </span>
              ) : status === 'calling' ? (
                <span className="flex items-center gap-1 text-orange-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Calling...
                </span>
              ) : status === 'ringing' ? (
                <span className="text-orange-400 animate-pulse">Ringing...</span>
              ) : status === 'connecting' ? (
                <span className="flex items-center gap-1 text-amber-400 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
                </span>
              ) : status === 'rejected' ? (
                <span className="text-rose-400">Call Declined</span>
              ) : status === 'busy' ? (
                <span className="text-amber-400">User Busy</span>
              ) : status === 'missed' ? (
                <span className="text-rose-400">Missed Call</span>
              ) : (
                <span className="text-neutral-400">Call Ended</span>
              )}
            </div>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          {isVideo && (
            <button
              onClick={() => callManager.flipCamera()}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
              title="Switch camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Autoplay blocked banner fallback */}
      {autoplayBlocked && (
        <div className="absolute top-18 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 bg-amber-500 text-black px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-bold animate-bounce">
          <VolumeX className="w-4 h-4" />
          <span>Tap to enable audio</span>
          <button
            onClick={handleUnblockAutoplay}
            className="px-2.5 py-1 bg-black text-white rounded-xl text-[11px] font-semibold ml-2 cursor-pointer"
          >
            Unmute
          </button>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            {/* Remote Video Stream (Main Viewport) */}
            <video
              ref={setRemoteMediaRef as any}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-neutral-900"
            />

            {/* Remote user avatar placeholder if remote video not transmitting */}
            {(!callState.remoteStream || callState.remoteStream.getVideoTracks().length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden shadow-2xl mb-4 border-2 border-white/20 ${
                    otherUser.avatar_url ? 'bg-neutral-800' : getAvatarColor(otherUser.username)
                  }`}
                >
                  {otherUser.avatar_url ? (
                    <img
                      src={otherUser.avatar_url}
                      alt={otherUser.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(otherUser.display_name || otherUser.username)
                  )}
                </div>
                <h4 className="text-lg font-bold text-white">{otherUser.display_name}</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  {isConnected ? 'Connecting video stream...' : 'Waiting for answer...'}
                </p>
              </div>
            )}

            {/* Local Video Stream (Picture-in-Picture) */}
            <div className="absolute bottom-28 right-4 sm:right-6 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden bg-neutral-800 border-2 border-white/20 shadow-2xl z-20">
              <video
                ref={setLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
              />
              {isCameraOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800 text-neutral-400 text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-neutral-500" />
                  <span>Camera off</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Audio Call Presentation */
          <div className="flex flex-col items-center justify-center p-6 text-center">
            {/* Animated Avatar Glow */}
            <div className="relative mb-6">
              {isConnected && (
                <div className="absolute -inset-4 rounded-full bg-orange-500/20 animate-pulse" />
              )}
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden shadow-2xl border-4 border-white/10 ${
                  otherUser.avatar_url ? 'bg-neutral-800' : getAvatarColor(otherUser.username)
                }`}
              >
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(otherUser.display_name || otherUser.username)
                )}
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white">{otherUser.display_name}</h3>
            <p className="text-sm font-mono text-neutral-400 mt-1">@{otherUser.username}</p>

            <div className="mt-4 px-4 py-1.5 rounded-full bg-white/10 text-xs font-semibold tracking-wide">
              {isConnected ? (
                <span className="text-emerald-400 font-mono text-sm">
                  {formatDuration(callDuration)}
                </span>
              ) : status === 'calling' ? (
                <span className="text-orange-400">Calling...</span>
              ) : status === 'connecting' ? (
                <span className="text-amber-400">Connecting...</span>
              ) : status === 'rejected' ? (
                <span className="text-rose-400">Call Declined</span>
              ) : (
                <span className="text-neutral-400">Ringing...</span>
              )}
            </div>

            {/* Audio element for receiving remote audio in audio-only calls */}
            <audio ref={setRemoteMediaRef as any} autoPlay playsInline />
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="absolute bottom-6 inset-x-0 z-30 flex items-center justify-center gap-4 px-4">
        {/* Mute Mic */}
        <button
          onClick={() => callManager.toggleMute()}
          className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
            isMuted
              ? 'bg-rose-500 text-white'
              : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Toggle (if video call) */}
        {isVideo && (
          <button
            onClick={() => callManager.toggleCamera()}
            className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isCameraOff
                ? 'bg-rose-500 text-white'
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
            }`}
            title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* End Call Button */}
        <button
          onClick={() => callManager.endCall()}
          className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer"
          title="End call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
