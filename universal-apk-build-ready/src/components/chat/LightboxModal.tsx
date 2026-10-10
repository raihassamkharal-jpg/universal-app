import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface LightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  mediaType?: 'image' | 'video';
  fileName?: string | null;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaType = 'image',
  fileName,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mediaUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        className="absolute top-4 right-4 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 bg-neutral-900/70 hover:bg-neutral-900 text-white rounded-xl backdrop-blur-md transition-colors"
          title="Open original"
          aria-label="Open original"
        >
          <ExternalLink className="w-5 h-5" />
        </a>

        <a
          href={mediaUrl}
          download={fileName || 'download'}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 bg-neutral-900/70 hover:bg-neutral-900 text-white rounded-xl backdrop-blur-md transition-colors"
          title="Download media"
          aria-label="Download media"
        >
          <Download className="w-5 h-5" />
        </a>

        <button
          type="button"
          onClick={onClose}
          className="p-2.5 bg-neutral-900/70 hover:bg-neutral-900 text-white rounded-xl backdrop-blur-md transition-colors cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Media Content */}
      <div
        className="max-w-4xl max-h-[85vh] flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'video' ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <img
            src={mediaUrl}
            alt={fileName || 'Enlarged media'}
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl select-none"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
};
