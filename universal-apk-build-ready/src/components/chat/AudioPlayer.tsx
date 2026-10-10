import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { formatDuration } from '../../lib/utils';

interface AudioPlayerProps {
  src: string;
  duration?: number | null;
  isVoice?: boolean;
  isMine?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration: initialDuration,
  isVoice = true,
  isMine = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(initialDuration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 rounded-xl min-w-0 w-full max-w-sm ${
      isMine ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
    }`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs ${
          isMine
            ? 'bg-white text-orange-600 hover:bg-orange-50'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform / Progress bar */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div className="relative flex items-center h-3 w-full group">
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="Seek audio"
          />
          {/* Custom Track */}
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${
            isMine ? 'bg-orange-400/60' : 'bg-neutral-200'
          }`}>
            <div
              className={`h-full transition-all duration-75 ${
                isMine ? 'bg-white' : 'bg-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timers & Label */}
        <div className={`flex items-center justify-between text-[11px] font-mono leading-none ${
          isMine ? 'text-orange-100' : 'text-neutral-500'
        }`}>
          <span>{formatDuration(Math.round(currentTime))}</span>
          <span className="flex items-center gap-1">
            {isVoice && <Volume2 className="w-3 h-3 opacity-70" />}
            {formatDuration(Math.round(totalDuration || currentTime))}
          </span>
        </div>
      </div>
    </div>
  );
};
