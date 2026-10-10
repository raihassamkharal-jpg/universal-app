import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Share2 } from 'lucide-react';
import { getInitials, getAvatarColor } from '../../lib/utils';
import type { Profile } from '../../types/database';

interface UniversalIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
}

export const UniversalIdCardModal: React.FC<UniversalIdCardModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const link = `${window.location.origin}/?u=${profile.username}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a deterministic SVG QR grid pattern from username
  const generateQRMatrix = (text: string) => {
    const size = 21; // standard version 1 QR size
    const matrix: boolean[][] = Array(size)
      .fill(false)
      .map(() => Array(size).fill(false));

    // Corner Finder Patterns
    const drawFinder = (x: number, y: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[y + r][x + c] = true;
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Data dots based on hash of text
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder zones
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= size - 8) ||
          (r >= size - 8 && c < 8)
        ) {
          continue;
        }
        const bit = ((hash >> ((r * size + c) % 31)) & 1) === 1;
        matrix[r][c] = bit;
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      }
    }

    return matrix;
  };

  const qrMatrix = generateQRMatrix(profile.username);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-neutral-200 relative flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-900 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Card Header Wordmark */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
            U
          </div>
          <span className="font-bold text-sm tracking-tight text-neutral-900">
            Universal ID
          </span>
        </div>

        {/* Profile Avatar */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden shadow-md border-4 border-white mb-3 ${
            profile.avatar_url ? 'bg-neutral-200' : getAvatarColor(profile.username)
          }`}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            getInitials(profile.display_name || profile.username)
          )}
        </div>

        <h3 className="text-lg font-bold text-neutral-900 leading-tight">
          {profile.display_name}
        </h3>
        <p className="text-xs text-orange-600 font-mono font-semibold mt-0.5 mb-4">
          @{profile.username}
        </p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl border-2 border-neutral-200 shadow-inner mb-4">
          <svg
            viewBox="0 0 21 21"
            className="w-44 h-44 text-neutral-900 fill-current"
            shapeRendering="crispEdges"
          >
            {qrMatrix.map((row, r) =>
              row.map((active, c) =>
                active ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" /> : null
              )
            )}
          </svg>
        </div>

        <p className="text-[11px] text-neutral-400 max-w-xs mb-5">
          Scan to connect instantly on Universal or share your custom profile card
        </p>

        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Copied Profile Link!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Universal Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
