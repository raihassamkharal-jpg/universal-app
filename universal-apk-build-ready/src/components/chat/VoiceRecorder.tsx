import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import { formatDuration } from '../../lib/utils';
import { uploadFileToStorage } from '../../lib/supabase/client';

interface VoiceRecorderProps {
  onSendVoice: (fileUrl: string, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoice, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Start recording
  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Voice recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine best supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        '',
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (!mime || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime))) {
          selectedMime = mime;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = selectedMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(200); // 200ms slice
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not access microphone.'
      );
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  // Handle cancel & discard
  const handleDiscard = () => {
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onCancel();
  };

  // Preview toggle
  const togglePreview = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch(console.warn);
    }
  };

  // Send voice message
  const handleSend = async () => {
    if (isRecording) {
      stopRecording();
    }

    let blobToSend = audioBlob;
    if (!blobToSend && audioChunksRef.current.length > 0) {
      blobToSend = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    if (!blobToSend || blobToSend.size === 0) {
      setErrorMessage('Recording is empty. Please try again.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const ext = blobToSend.type.includes('mp4') ? 'm4a' : 'webm';
      const fileName = `voice-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
      const { publicUrl, error } = await uploadFileToStorage(blobToSend, 'chat-attachments', fileName);

      if (error || !publicUrl) {
        throw new Error(error || 'Failed to upload voice message');
      }

      const duration = Math.max(1, recordingDuration);
      await onSendVoice(publicUrl, duration);
    } catch (err: any) {
      console.error('Failed to send voice message:', err);
      setErrorMessage(err.message || 'Failed to send voice message');
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 bg-orange-50 dark:bg-neutral-800/90 border border-orange-200/90 dark:border-neutral-700 rounded-2xl p-2 sm:px-3 sm:py-2.5 animate-in fade-in duration-150 shadow-2xs">
      {audioUrl && (
        <audio
          ref={previewAudioRef}
          src={audioUrl}
          onEnded={() => setIsPreviewPlaying(false)}
          className="hidden"
        />
      )}

      {/* Main Controls Row */}
      <div className="flex items-center justify-between w-full min-w-0 gap-1.5 sm:gap-2">
        {/* Left: Discard / Cancel Button */}
        <button
          type="button"
          onClick={handleDiscard}
          disabled={uploading}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Discard recording"
          aria-label="Discard recording"
        >
          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Middle: Recording animation / preview */}
        <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-1">
          {isRecording ? (
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
                  {formatDuration(recordingDuration)}
                </span>
              </div>

              {/* Waveform indicator (hidden on small mobile to conserve space) */}
              <div className="hidden md:flex items-center gap-0.5 shrink-0">
                {[40, 70, 30, 90, 60, 80, 50, 95, 45, 65].map((height, i) => (
                  <span
                    key={i}
                    className="w-1 bg-orange-500 rounded-full animate-pulse"
                    style={{
                      height: `${height * 0.22}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>

              {/* Stop & Preview button */}
              <button
                type="button"
                onClick={stopRecording}
                className="px-2 sm:px-2.5 py-1 text-xs font-semibold bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                title="Stop and preview"
                aria-label="Stop recording"
              >
                <Square className="w-3 h-3 fill-current text-rose-500" />
                <span>Stop</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={togglePreview}
                className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:scale-95 transition-transform cursor-pointer shrink-0 shadow-xs"
                title={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
              >
                {isPreviewPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                Preview ({formatDuration(recordingDuration)})
              </span>
            </div>
          )}
        </div>

        {/* Right: Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={uploading}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white flex items-center justify-center transition-transform active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
          title="Send voice message"
          aria-label="Send voice message"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4 text-white -ml-0.5" />
          )}
        </button>
      </div>

      {/* Sub-row error message (if any) to prevent horizontal overflow */}
      {errorMessage && (
        <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium px-2 pt-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
