/**
 * WebRTC Calling System & Realtime Signaling Engine for Universal
 * Authoritative WebRTC lifecycle for real 1-to-1 Audio & Video calls.
 */

import { supabase, isSupabaseConfigured } from '../supabase/client';
import { ringtonePlayer } from '../audio/ringtonePlayer';
import { callNotificationService } from '../notifications/callNotificationService';
import type { CallType, CallStatus, Profile, CallRecord } from '../../types/database';

export interface CallSessionState {
  callId: string;
  callType: CallType;
  status: CallStatus;
  isCaller: boolean;
  otherUser: Profile;
  conversationId?: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  callDuration: number; // in seconds
  error: string | null;
}

type CallStateListener = (state: CallSessionState | null) => void;

// Production STUN configuration (extensible for TURN via env without leaking credentials)
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

class WebRTCCallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallState: CallSessionState | null = null;
  private signalingChannel: any = null;
  private globalUserChannel: any = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private isSignalingSubscribed: boolean = false;
  private signalQueue: any[] = [];
  private timerInterval: number | null = null;
  private callTimeoutTimer: number | null = null;
  private currentUserId: string | null = null;
  private currentUserProfile: Profile | null = null;
  private listeners: Set<CallStateListener> = new Set();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private initialOffer: RTCSessionDescriptionInit | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private processedSignalIds: Set<string> = new Set();

  constructor() {
    // Cross-tab broadcast channel for local multi-window/account instant signaling
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('universal_call_signals');
        this.localBroadcastChannel.onmessage = async (event) => {
          const signal = event.data;
          if (signal && signal.callId) {
            // Check if this signal is relevant for current call or user
            if (this.currentCallState && this.currentCallState.callId === signal.callId) {
              if (signal.senderId !== this.currentUserId) {
                await this.handleIncomingSignal(signal);
              }
            } else if (signal.type === 'incoming_call' && signal.targetUserId === this.currentUserId) {
              this.handleIncomingCallInvite(signal.payload);
            }
          }
        };
      } catch (e) {
        console.warn('[WebRTC] BroadcastChannel not supported:', e);
      }
    }
  }

  public subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentCallState ? { ...this.currentCallState } : null);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const clone = this.currentCallState ? { ...this.currentCallState } : null;
    this.listeners.forEach((cb) => {
      try {
        cb(clone);
      } catch (err) {
        console.error('[WebRTC] Call state listener error:', err);
      }
    });
  }

  /**
   * Internal invisible audio element to guarantee remote audio playback
   * regardless of React modal rendering or lifecycle.
   */
  private ensureRemoteAudioElement(): HTMLAudioElement {
    if (!this.remoteAudioElement && typeof window !== 'undefined') {
      const audio = new Audio();
      audio.autoplay = true;
      (audio as any).playsInline = true;
      this.remoteAudioElement = audio;
    }
    return this.remoteAudioElement!;
  }

  /**
   * Initialize Global Realtime Listener for incoming calls targeted at this user
   */
  public initializeForUser(user: { id: string }, profile: Profile | null): void {
    this.currentUserId = user.id;
    this.currentUserProfile = profile;

    if (!isSupabaseConfigured) return;

    if (this.globalUserChannel) {
      supabase.removeChannel(this.globalUserChannel);
      this.globalUserChannel = null;
    }

    const channelName = `user_calls:${user.id}`;
    this.globalUserChannel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'incoming_call' }, async (payload) => {
        const inviteData = payload.payload;
        if (inviteData) {
          this.handleIncomingCallInvite(inviteData);
        }
      })
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const signal = payload.payload;
        if (signal && this.currentCallState && signal.callId === this.currentCallState.callId) {
          if (signal.senderId !== this.currentUserId) {
            await this.handleIncomingSignal(signal);
          }
        }
      })
      .subscribe((status) => {
        console.log(`[WebRTC] Global user channel status=${status} channel=${channelName}`);
      });
  }

  private handleIncomingCallInvite(inviteData: any): void {
    const { callId, callerProfile, callType, conversationId, offer } = inviteData || {};
    if (!callId || !callerProfile) return;

    console.log(`[WebRTC] INCOMING CALL RECEIVED callId=${callId} caller=${callerProfile.username} type=${callType}`);

    // If already in an active call, signal busy to the caller
    if (
      this.currentCallState &&
      this.currentCallState.status !== 'ended' &&
      this.currentCallState.status !== 'rejected' &&
      this.currentCallState.status !== 'missed' &&
      this.currentCallState.status !== 'failed' &&
      this.currentCallState.status !== 'cancelled'
    ) {
      console.log(`[WebRTC] Callee is busy. Sending busy signal for callId=${callId}`);
      this.sendSignalDirect(callerProfile.id, {
        type: 'call-busy',
        callId,
        senderId: this.currentUserId,
      });
      return;
    }

    // Cache initial offer if provided by caller in broadcast
    this.initialOffer = offer || null;

    // Setup incoming call state
    this.currentCallState = {
      callId,
      callType: callType || 'audio',
      status: 'ringing',
      isCaller: false,
      otherUser: callerProfile,
      conversationId,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      isSpeakerOn: true,
      callDuration: 0,
      error: null,
    };

    // Play incoming ringtone with user preference
    ringtonePlayer.playIncomingRingtone(this.currentUserProfile?.custom_ringtone_url);

    // Show background/system incoming-call notification (with Answer / Decline actions)
    callNotificationService.showIncomingCallNotification({
      callId,
      callerName: callerProfile.display_name || callerProfile.username,
      callerAvatar: callerProfile.avatar_url,
      callType: callType || 'audio',
    }).catch(() => {});

    // Pre-subscribe to the call signaling channel immediately
    this.setupCallSignaling(callId);
    this.notify();

    // 45-second timeout on receiver side in case caller disconnects
    if (this.callTimeoutTimer) clearTimeout(this.callTimeoutTimer);
    this.callTimeoutTimer = window.setTimeout(() => {
      if (this.currentCallState && this.currentCallState.status === 'ringing') {
        console.log(`[WebRTC] Incoming call timed out callId=${callId}`);
        this.endCallInternal('missed');
      }
    }, 45000);
  }

  /**
   * Start Outgoing Audio or Video Call
   */
  public async startCall(
    otherUser: Profile,
    callType: CallType,
    conversationId?: string
  ): Promise<boolean> {
    if (!this.currentUserId || !this.currentUserProfile) return false;

    // Reset previous call cleanly
    this.endCallInternal('ended', false);

    const callId = crypto.randomUUID();
    console.log(`[WebRTC] CALL CREATED callId=${callId} to=${otherUser.username} type=${callType}`);

    // 1. Acquire local media stream first and validate tracks
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
    } catch (err: any) {
      console.error('[WebRTC] Media access error:', err);
      let errorMsg = 'Failed to access camera/microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Microphone/camera access was denied. Please allow permissions in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No microphone or camera device detected on this system.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Hardware device is currently in use by another application.';
      }

      this.currentCallState = {
        callId,
        callType,
        status: 'failed',
        isCaller: true,
        otherUser,
        conversationId,
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
        callDuration: 0,
        error: errorMsg,
      };
      this.notify();
      return false;
    }

    this.localStream = stream;
    console.log(`[WebRTC] LOCAL MEDIA READY tracks=${stream.getTracks().map((t) => `${t.kind}:${t.enabled}`).join(', ')}`);

    this.currentCallState = {
      callId,
      callType,
      status: 'calling',
      isCaller: true,
      otherUser,
      conversationId,
      localStream: stream,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      isSpeakerOn: true,
      callDuration: 0,
      error: null,
    };
    this.notify();

    // 2. Play outgoing ringback tone
    ringtonePlayer.playOutgoingRingback(this.currentUserProfile.custom_outgoing_tone_url);

    // 3. Setup signaling channel early
    this.setupCallSignaling(callId);

    // 4. Create WebRTC Peer Connection and generate Offer
    const offer = await this.createPeerConnection(callId, true);

    // 5. Persist call record in Supabase database
    if (isSupabaseConfigured) {
      try {
        await supabase.from('calls').insert({
          id: callId,
          conversation_id: conversationId || null,
          caller_id: this.currentUserId,
          receiver_id: otherUser.id,
          call_type: callType,
          status: 'calling',
          started_at: new Date().toISOString(),
          sdp_offer: offer ? JSON.stringify(offer) : null,
        });
      } catch (e) {
        console.warn('[WebRTC] Supabase calls table insert fallback:', e);
      }
    }

    // 6. Broadcast incoming call to receiver's user channel AND local broadcast channel
    const invitePayload = {
      callId,
      callerProfile: this.currentUserProfile,
      callType,
      conversationId,
      offer,
    };

    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.postMessage({
        type: 'incoming_call',
        callId,
        targetUserId: otherUser.id,
        senderId: this.currentUserId,
        payload: invitePayload,
      });
    }

    if (isSupabaseConfigured) {
      try {
        const receiverChannel = supabase.channel(`user_calls:${otherUser.id}`, {
          config: { broadcast: { self: false } },
        });
        receiverChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await receiverChannel.send({
              type: 'broadcast',
              event: 'incoming_call',
              payload: invitePayload,
            });
            setTimeout(() => {
              supabase.removeChannel(receiverChannel);
            }, 3000);
          }
        });
      } catch (e) {
        console.warn('[WebRTC] Receiver broadcast send error:', e);
      }
    }

    // 6.b Server-Side Web Push Notification for Background Devices & PWAs
    callNotificationService.sendPushCallNotification({
      callId,
      recipientUserId: otherUser.id,
      callerId: this.currentUserId,
      callerName: this.currentUserProfile.display_name || this.currentUserProfile.username,
      callerAvatar: this.currentUserProfile.avatar_url,
      callType,
      conversationId: conversationId || null,
    }).catch(() => {});

    // 7. 45-second timeout for outgoing calls if unanswered
    if (this.callTimeoutTimer) clearTimeout(this.callTimeoutTimer);
    this.callTimeoutTimer = window.setTimeout(() => {
      if (this.currentCallState && (this.currentCallState.status === 'calling' || this.currentCallState.status === 'ringing')) {
        console.log(`[WebRTC] Outgoing call timed out callId=${callId}`);
        this.sendCallSignal({ type: 'call-timeout', callId, senderId: this.currentUserId });
        this.endCallInternal('missed');
      }
    }, 45000);

    return true;
  }

  /**
   * Handle incoming call action from deep-link or Service Worker notification click.
   * Revalidates call status, authorization, and expiration before accepting or rejecting.
   */
  public async handleDeepLinkCall(
    callId: string,
    action: 'answer' | 'decline' | 'open',
    fallbackCallType?: CallType
  ): Promise<void> {
    if (!callId || !this.currentUserId) return;

    console.log(`[WebRTC] handleDeepLinkCall callId=${callId} action=${action}`);

    // If call is already active/ringing in memory for this callId
    if (this.currentCallState && this.currentCallState.callId === callId) {
      if (action === 'answer') {
        await this.acceptCall();
      } else if (action === 'decline') {
        this.rejectCall();
      }
      return;
    }

    // Otherwise, validate against authoritative call record in Supabase
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const { data: callRecord, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error || !callRecord) {
        console.warn('[WebRTC] Call record not found for deep link:', error);
        return;
      }

      // 1. Authoritative Recipient Check: only intended receiver can answer/decline
      if (callRecord.receiver_id !== this.currentUserId) {
        console.warn('[WebRTC] Unauthorized answer attempt: current user is not receiver');
        return;
      }

      // 2. Validate call is still pending
      if (callRecord.status !== 'calling' && callRecord.status !== 'ringing') {
        console.log(`[WebRTC] Call ${callId} is no longer pending (status=${callRecord.status})`);
        const { data: callerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', callRecord.caller_id)
          .single();

        const otherCallerProfile: Profile = callerData || {
          id: callRecord.caller_id,
          username: 'Caller',
          display_name: 'Caller',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile;

        this.currentCallState = {
          callId,
          callType: callRecord.call_type || fallbackCallType || 'audio',
          status: 'ended',
          isCaller: false,
          otherUser: otherCallerProfile,
          conversationId: callRecord.conversation_id,
          localStream: null,
          remoteStream: null,
          isMuted: false,
          isCameraOff: false,
          isSpeakerOn: true,
          callDuration: 0,
          error: callRecord.status === 'accepted'
            ? 'This call was answered on another device.'
            : 'This call has already ended or expired.',
        };
        this.notify();
        return;
      }

      // 3. Check for stale/expired call (> 60s)
      const startedAt = new Date(callRecord.started_at || callRecord.created_at).getTime();
      const elapsed = Date.now() - startedAt;
      if (elapsed > 60000) {
        console.log(`[WebRTC] Call ${callId} has expired (${Math.round(elapsed / 1000)}s old)`);
        await supabase
          .from('calls')
          .update({ status: 'missed', ended_at: new Date().toISOString() })
          .eq('id', callId);
        return;
      }

      // 4. Resolve caller profile
      const { data: callerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', callRecord.caller_id)
        .single();

      const callerProfile: Profile = callerData || {
        id: callRecord.caller_id,
        username: 'Caller',
        display_name: 'Caller',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Profile;

      const resolvedCallType: CallType = callRecord.call_type || fallbackCallType || 'audio';

      // 5. Handle action
      if (action === 'decline') {
        this.sendSignalDirect(callerProfile.id, {
          type: 'call-rejected',
          callId,
          senderId: this.currentUserId,
        });
        await supabase
          .from('calls')
          .update({ status: 'rejected', ended_at: new Date().toISOString() })
          .eq('id', callId);
        ringtonePlayer.stopAll();
        ringtonePlayer.playCallEndTone();
        callNotificationService.dismissIncomingCallNotification(callId);
        return;
      }

      // Set up in-memory call state
      this.currentCallState = {
        callId,
        callType: resolvedCallType,
        status: 'ringing',
        isCaller: false,
        otherUser: callerProfile,
        conversationId: callRecord.conversation_id,
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
        callDuration: 0,
        error: null,
      };

      if (callRecord.sdp_offer) {
        try {
          this.initialOffer = JSON.parse(callRecord.sdp_offer);
        } catch {}
      }

      this.setupCallSignaling(callId);
      this.notify();

      if (action === 'answer') {
        await this.acceptCall();
      } else {
        // 'open': display incoming call modal and play ringtone
        ringtonePlayer.playIncomingRingtone(this.currentUserProfile?.custom_ringtone_url);
      }
    } catch (e) {
      console.error('[WebRTC] handleDeepLinkCall error:', e);
    }
  }

  /**
   * Accept Incoming Call — triggers real WebRTC answer creation and track attachment
   */
  public async acceptCall(): Promise<void> {
    if (!this.currentCallState || this.currentCallState.isCaller) return;

    // Immediately stop ringtone on accept
    ringtonePlayer.stopAll();
    callNotificationService.dismissIncomingCallNotification(this.currentCallState.callId);

    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }

    const { callId, callType, otherUser } = this.currentCallState;
    console.log(`[WebRTC] ACCEPT CLICKED callId=${callId} type=${callType}`);

    // 1. Acquire local media stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
      this.localStream = stream;
      if (this.currentCallState) {
        this.currentCallState.localStream = stream;
        this.currentCallState.status = 'connecting';
        this.notify();
      }
    } catch (err: any) {
      console.error('[WebRTC] Media access error accepting call:', err);
      let errorMsg = 'Failed to access camera/microphone.';
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Microphone/camera access was denied by your browser.';
      }
      this.rejectCall();
      if (this.currentCallState) {
        this.currentCallState.error = errorMsg;
        this.notify();
      }
      return;
    }

    // 2. Notify caller that call was accepted
    this.sendCallSignal({
      type: 'call-accepted',
      callId,
      senderId: this.currentUserId,
      responderId: this.currentUserId,
    });

    // 3. Update database call status
    if (isSupabaseConfigured) {
      supabase
        .from('calls')
        .update({
          status: 'accepted',
          answered_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .then(() => {}, () => {});
    }

    // 4. Create WebRTC peer connection as callee
    await this.createPeerConnection(callId, false);

    // 5. If initial offer is already available, apply it and create answer immediately
    if (this.initialOffer) {
      await this.applyOfferAndAnswer(this.initialOffer, callId);
    }
  }

  /**
   * Reject Incoming Call
   */
  public rejectCall(): void {
    ringtonePlayer.stopAll();
    ringtonePlayer.playCallEndTone();

    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }

    if (this.currentCallState) {
      const { callId } = this.currentCallState;
      console.log(`[WebRTC] CALL REJECTED callId=${callId}`);

      this.sendCallSignal({
        type: 'call-rejected',
        callId,
        senderId: this.currentUserId,
      });

      if (isSupabaseConfigured) {
        supabase
          .from('calls')
          .update({
            status: 'rejected',
            ended_at: new Date().toISOString(),
          })
          .eq('id', callId)
          .then(() => {}, () => {});
      }

      this.endCallInternal('rejected');
    }
  }

  /**
   * End Active Call
   */
  public endCall(): void {
    if (!this.currentCallState) return;

    const { callId, status, callDuration } = this.currentCallState;
    console.log(`[WebRTC] CALL ENDED by user callId=${callId} status=${status} duration=${callDuration}`);

    ringtonePlayer.stopAll();
    ringtonePlayer.playCallEndTone();

    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }

    this.sendCallSignal({
      type: 'call-ended',
      callId,
      senderId: this.currentUserId,
    });

    const finalStatus: CallStatus =
      status === 'calling' || status === 'ringing' ? 'missed' : 'ended';

    // Update call database record
    if (isSupabaseConfigured) {
      supabase
        .from('calls')
        .update({
          status: finalStatus,
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration,
          duration: callDuration,
        })
        .eq('id', callId)
        .then(() => {}, () => {});
    }

    this.endCallInternal(finalStatus);
  }

  /**
   * Toggle Microphone Mute
   */
  public toggleMute(): void {
    if (!this.localStream || !this.currentCallState) return;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextEnabled = !audioTracks[0].enabled;
      audioTracks.forEach((t) => (t.enabled = nextEnabled));
      this.currentCallState.isMuted = !nextEnabled;
      console.log(`[WebRTC] Microphone ${nextEnabled ? 'unmuted' : 'muted'}`);
      this.notify();
    }
  }

  /**
   * Toggle Video Camera On/Off
   */
  public toggleCamera(): void {
    if (!this.localStream || !this.currentCallState) return;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const nextEnabled = !videoTracks[0].enabled;
      videoTracks.forEach((t) => (t.enabled = nextEnabled));
      this.currentCallState.isCameraOff = !nextEnabled;
      console.log(`[WebRTC] Camera ${nextEnabled ? 'enabled' : 'disabled'}`);
      this.notify();
    }
  }

  /**
   * Flip Camera between user and environment (mobile support)
   */
  public async flipCamera(): Promise<void> {
    if (!this.localStream || !this.currentCallState || this.currentCallState.callType !== 'video') {
      return;
    }

    try {
      const currentVideoTrack = this.localStream.getVideoTracks()[0];
      const currentFacing = currentVideoTrack?.getSettings()?.facingMode || 'user';
      const targetFacing = currentFacing === 'user' ? 'environment' : 'user';

      currentVideoTrack?.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      }

      this.localStream.removeTrack(currentVideoTrack);
      this.localStream.addTrack(newVideoTrack);
      this.currentCallState.localStream = this.localStream;
      console.log(`[WebRTC] Camera flipped to ${targetFacing}`);
      this.notify();
    } catch (e) {
      console.warn('[WebRTC] Failed to switch camera:', e);
    }
  }

  // --- Internal WebRTC Peer & Signaling ---

  private async createPeerConnection(
    callId: string,
    isInitiator: boolean
  ): Promise<RTCSessionDescriptionInit | null> {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    console.log(`[WebRTC] PEER CREATED callId=${callId} isInitiator=${isInitiator}`);
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.currentCallState) {
      this.currentCallState.remoteStream = this.remoteStream;
    }

    // Attach remote stream to internal audio element
    const audioEl = this.ensureRemoteAudioElement();
    audioEl.srcObject = this.remoteStream;

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle receiving remote tracks safely (handle both event.streams and event.track fallback)
    this.peerConnection.ontrack = (event) => {
      console.log(`[WebRTC] REMOTE TRACK RECEIVED kind=${event.track.kind} id=${event.track.id}`);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream?.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream?.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream?.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream?.addTrack(event.track);
        }
      }

      audioEl.play().catch((err) => {
        console.warn('[WebRTC] Remote audio autoplay blocked:', err);
      });

      if (this.currentCallState) {
        this.currentCallState.remoteStream = this.remoteStream;
        this.notify();
      }
    };

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE CANDIDATE GENERATED candidate=${event.candidate.candidate.slice(0, 30)}...`);
        this.sendCallSignal({
          type: 'ice-candidate',
          callId,
          senderId: this.currentUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const iceState = this.peerConnection.iceConnectionState;
      console.log(`[WebRTC] ICE STATE=${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        this.onCallConnected();
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection || !this.currentCallState) return;

      const state = this.peerConnection.connectionState;
      console.log(`[WebRTC] CONNECTION STATE=${state}`);

      if (state === 'connected') {
        this.onCallConnected();
      } else if (state === 'failed' || state === 'closed') {
        console.warn('[WebRTC] Peer connection failed/closed');
        this.endCallInternal('ended');
      }
    };

    // If initiator, generate SDP offer
    if (isInitiator) {
      try {
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.currentCallState?.callType === 'video',
        });
        await this.peerConnection.setLocalDescription(offer);
        console.log(`[WebRTC] OFFER CREATED & LOCAL DESCRIPTION SET`);

        this.sendCallSignal({
          type: 'call-offer',
          callId,
          senderId: this.currentUserId,
          sdp: offer,
        });
        return offer;
      } catch (err) {
        console.error('[WebRTC] Failed to create offer:', err);
        return null;
      }
    } else {
      this.processPendingCandidates();
      return null;
    }
  }

  private onCallConnected(): void {
    ringtonePlayer.stopAll();

    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }

    if (this.currentCallState && this.currentCallState.status !== 'connected') {
      console.log(`[WebRTC] CALL FULLY CONNECTED callId=${this.currentCallState.callId}`);
      ringtonePlayer.playConnectedChime();
      this.currentCallState.status = 'connected';
      this.startDurationTimer();
      this.notify();
    }
  }

  private setupCallSignaling(callId: string): void {
    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }

    this.isSignalingSubscribed = false;
    this.signalQueue = [];
    this.processedSignalIds.clear();

    const channelName = `call_signal:${callId}`;
    console.log(`[WebRTC] SUBSCRIBING to signaling channel ${channelName}`);

    // Create Supabase Channel with bidirectional broadcast enabled
    this.signalingChannel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true, ack: true },
        },
      })
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const signal = payload.payload;
        if (!signal || signal.callId !== callId) return;
        if (signal.senderId === this.currentUserId) return; // Ignore own echoes

        await this.handleIncomingSignal(signal);
      })
      // Dual-path Postgres listener on calls table (answers & acceptance)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const updatedCall = payload.new as any;
          if (!updatedCall) return;

          console.log(`[WebRTC] POSTGRES CALL UPDATE status=${updatedCall.status}`);
          if (updatedCall.status === 'accepted' || updatedCall.sdp_answer) {
            ringtonePlayer.stopAll();
            if (this.currentCallState?.isCaller && updatedCall.sdp_answer) {
              try {
                const answer = typeof updatedCall.sdp_answer === 'string'
                  ? JSON.parse(updatedCall.sdp_answer)
                  : updatedCall.sdp_answer;
                await this.handleIncomingSignal({
                  type: 'call-answer',
                  callId,
                  sdp: answer,
                });
              } catch (e) {
                console.error('[WebRTC] Parse answer error:', e);
              }
            }
          } else if (updatedCall.status === 'rejected') {
            ringtonePlayer.stopAll();
            this.endCallInternal('rejected');
          } else if (updatedCall.status === 'ended') {
            ringtonePlayer.stopAll();
            this.endCallInternal('ended');
          }
        }
      )
      // Dual-path Postgres listener on call_signaling table
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signaling',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row || row.sender_id === this.currentUserId) return;
          console.log(`[WebRTC] POSTGRES SIGNAL INSERT type=${row.signal_type}`);
          await this.handleIncomingSignal({
            ...row.payload,
            type: row.signal_type,
            callId,
          });
        }
      )
      .subscribe((status) => {
        console.log(`[WebRTC] Signaling channel status=${status} channel=${channelName}`);
        if (status === 'SUBSCRIBED') {
          this.isSignalingSubscribed = true;
          this.flushSignalQueue();
        }
      });
  }

  private flushSignalQueue(): void {
    if (!this.signalingChannel || !this.isSignalingSubscribed) return;
    while (this.signalQueue.length > 0) {
      const item = this.signalQueue.shift();
      if (item) {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload: item,
        }).catch((err: any) => {
          console.warn('[WebRTC] Queued signal send error:', err);
        });
      }
    }
  }

  private async handleIncomingSignal(signal: any): Promise<void> {
    const { type, sdp, candidate, callId } = signal;

    // Deduplication check for identical signal events
    const sigKey = `${type}_${candidate ? candidate.candidate : sdp ? sdp.type : ''}`;
    if (this.processedSignalIds.has(sigKey)) return;
    this.processedSignalIds.add(sigKey);

    console.log(`[WebRTC] SIGNAL RECEIVED type=${type} callId=${callId}`);

    // Offer handling
    if (type === 'call-offer' || type === 'offer') {
      this.initialOffer = sdp;
      // If receiver already accepted, apply offer and generate answer
      if (this.currentCallState && this.currentCallState.status === 'connecting') {
        await this.applyOfferAndAnswer(sdp, callId);
      }
    }
    // Callee accepted call notification
    else if (type === 'call-accepted' || type === 'accept') {
      console.log(`[WebRTC] Call accepted by peer. Stopping outgoing ringback.`);
      ringtonePlayer.stopAll();

      if (this.currentCallState) {
        this.currentCallState.status = 'connecting';
        this.notify();
      }

      // Re-send offer if peer connection already has local offer description
      if (this.peerConnection?.localDescription) {
        console.log(`[WebRTC] Re-sending offer to peer`);
        this.sendCallSignal({
          type: 'call-offer',
          callId,
          senderId: this.currentUserId,
          sdp: this.peerConnection.localDescription,
        });
      }
    }
    // Answer handling on caller
    else if (type === 'call-answer' || type === 'answer') {
      console.log(`[WebRTC] REMOTE ANSWER RECEIVED callId=${callId}`);
      ringtonePlayer.stopAll();

      if (this.currentCallState) {
        this.currentCallState.status = 'connecting';
        this.notify();
      }

      try {
        if (this.peerConnection && (this.peerConnection.signalingState === 'have-local-offer' || this.peerConnection.signalingState === 'stable')) {
          if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log(`[WebRTC] REMOTE DESCRIPTION SET (caller)`);
            this.processPendingCandidates();
          }
        }
      } catch (e) {
        console.error('[WebRTC] Error handling answer:', e);
      }
    }
    // ICE candidate exchange
    else if (type === 'ice-candidate' || type === 'candidate') {
      if (candidate) {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC] Error adding ICE candidate:', e);
          }
        } else {
          this.pendingCandidates.push(candidate);
        }
      }
    }
    // Call rejected
    else if (type === 'call-rejected' || type === 'reject') {
      console.log(`[WebRTC] CALL REJECTED by peer`);
      ringtonePlayer.stopAll();
      ringtonePlayer.playCallEndTone();
      this.endCallInternal('rejected');
    }
    // Call busy
    else if (type === 'call-busy' || type === 'busy') {
      console.log(`[WebRTC] PEER IS BUSY`);
      ringtonePlayer.stopAll();
      ringtonePlayer.playCallEndTone();
      if (this.currentCallState) {
        this.currentCallState.error = 'User is currently on another call.';
      }
      this.endCallInternal('busy');
    }
    // Call ended by peer
    else if (type === 'call-ended' || type === 'end') {
      console.log(`[WebRTC] CALL ENDED by remote peer`);
      ringtonePlayer.stopAll();
      ringtonePlayer.playCallEndTone();
      this.endCallInternal('ended');
    }
    // Call timeout
    else if (type === 'call-timeout' || type === 'timeout') {
      console.log(`[WebRTC] CALL TIMEOUT`);
      ringtonePlayer.stopAll();
      this.endCallInternal('missed');
    }
  }

  private async applyOfferAndAnswer(offerSdp: RTCSessionDescriptionInit, callId: string): Promise<void> {
    if (!this.peerConnection) {
      await this.createPeerConnection(callId, false);
    }
    try {
      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offerSdp));
      console.log(`[WebRTC] REMOTE DESCRIPTION SET (callee)`);
      this.processPendingCandidates();

      const answer = await this.peerConnection?.createAnswer();
      if (answer) {
        await this.peerConnection?.setLocalDescription(answer);
        console.log(`[WebRTC] ANSWER CREATED & LOCAL DESCRIPTION SET (callee)`);

        this.sendCallSignal({
          type: 'call-answer',
          callId,
          senderId: this.currentUserId,
          sdp: answer,
        });

        // Also persist in calls database record
        if (isSupabaseConfigured) {
          supabase
            .from('calls')
            .update({
              sdp_answer: JSON.stringify(answer),
              status: 'accepted',
            })
            .eq('id', callId)
            .then(() => {}, () => {});
        }
      }
    } catch (e) {
      console.error('[WebRTC] Error creating answer for offer:', e);
    }
  }

  private processPendingCandidates(): void {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    }
  }

  private sendCallSignal(signal: any): void {
    const payloadWithSender = {
      ...signal,
      senderId: this.currentUserId,
    };

    // 1. Post to local BroadcastChannel for multi-tab instantaneous delivery
    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.postMessage(payloadWithSender);
    }

    // 2. Send over Supabase Realtime broadcast channel
    if (this.signalingChannel && this.isSignalingSubscribed) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'signal',
        payload: payloadWithSender,
      }).catch((err: any) => {
        console.warn('[WebRTC] sendCallSignal error, queuing:', err);
        this.signalQueue.push(payloadWithSender);
      });
    } else {
      this.signalQueue.push(payloadWithSender);
    }

    // 3. Fallback persistence in call_signaling table for non-transient delivery
    if (isSupabaseConfigured && signal.callId && this.currentUserId && !this.currentUserId.startsWith('demo-')) {
      supabase
        .from('call_signaling')
        .insert({
          call_id: signal.callId,
          sender_id: this.currentUserId,
          signal_type: signal.type,
          payload: payloadWithSender,
        })
        .then(() => {}, () => {});
    }
  }

  private sendSignalDirect(targetUserId: string, payload: any): void {
    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.postMessage({
        ...payload,
        targetUserId,
        senderId: this.currentUserId,
      });
    }

    if (isSupabaseConfigured) {
      const ch = supabase.channel(`user_calls:${targetUserId}`, {
        config: { broadcast: { self: false } },
      });
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              ...payload,
              senderId: this.currentUserId,
            },
          });
          setTimeout(() => {
            supabase.removeChannel(ch);
          }, 3000);
        }
      });
    }
  }

  private startDurationTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (
        this.currentCallState &&
        (this.currentCallState.status === 'connected' || this.currentCallState.status === 'accepted')
      ) {
        this.currentCallState.callDuration += 1;
        this.notify();
      }
    }, 1000);
  }

  /**
   * One unified cleanup path that safely resets all media, peer connections,
   * timers, ringtones, and listeners. Safe to call multiple times.
   */
  private endCallInternal(finalStatus: CallStatus, shouldNotify: boolean = true): void {
    ringtonePlayer.stopAll();
    if (this.currentCallState) {
      callNotificationService.dismissIncomingCallNotification(this.currentCallState.callId);
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }

    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }

    this.isSignalingSubscribed = false;
    this.signalQueue = [];
    this.pendingCandidates = [];
    this.initialOffer = null;
    this.processedSignalIds.clear();

    if (this.currentCallState) {
      this.currentCallState.status = finalStatus;
      this.currentCallState.localStream = null;
      this.currentCallState.remoteStream = null;
      if (shouldNotify) {
        this.notify();
      }

      // Automatically dismiss call banner after 2.5s
      const dismissingCallId = this.currentCallState.callId;
      setTimeout(() => {
        if (this.currentCallState && this.currentCallState.callId === dismissingCallId) {
          this.currentCallState = null;
          this.notify();
        }
      }, 2500);
    }
  }
}

export const callManager = new WebRTCCallManager();
