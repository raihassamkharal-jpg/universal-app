import React, { useState } from 'react';
import { Smile, Sparkles, Film, Search, X } from 'lucide-react';

interface StickerGifPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string, stickerName: string) => void;
  onSelectGif: (gifUrl: string, title: string) => void;
  onClose: () => void;
}

// Curated high quality sticker representations (animated SVG & clean vector stickers)
const STICKER_PACKS: { [category: string]: { id: string; name: string; url: string; emoji: string }[] } = {
  Reactions: [
    {
      id: 's-thumbsup',
      name: 'Super Thumbs Up',
      emoji: '👍',
      url: 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-party',
      name: 'Confetti Party',
      emoji: '🎉',
      url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-love',
      name: 'Glowing Heart',
      emoji: '💖',
      url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-fire',
      name: 'Pure Fire',
      emoji: '🔥',
      url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-clap',
      name: 'Standing Ovation',
      emoji: '👏',
      url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-laugh',
      name: 'LOL Laughing',
      emoji: '😂',
      url: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=300&auto=format&fit=crop&q=80',
    },
  ],
  Vibes: [
    {
      id: 's-cool',
      name: 'Cool Sunglasses',
      emoji: '😎',
      url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-rocket',
      name: 'To the Moon',
      emoji: '🚀',
      url: 'https://images.unsplash.com/photo-1517976487507-580371424b58?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-coffee',
      name: 'Coffee Break',
      emoji: '☕',
      url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-peace',
      name: 'Peace & Love',
      emoji: '✌️',
      url: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-star',
      name: 'Superstar',
      emoji: '⭐',
      url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-mindblown',
      name: 'Mind Blown',
      emoji: '🤯',
      url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
    },
  ],
  Animals: [
    {
      id: 's-cat',
      name: 'Playful Cat',
      emoji: '🐱',
      url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-dog',
      name: 'Happy Puppy',
      emoji: '🐶',
      url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-panda',
      name: 'Chill Panda',
      emoji: '🐼',
      url: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 's-fox',
      name: 'Clever Fox',
      emoji: '🦊',
      url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=300&auto=format&fit=crop&q=80',
    },
  ],
};

// Curated GIF presets (reliable animated gifs with smooth loop)
const GIF_COLLECTIONS: { id: string; title: string; category: string; url: string; preview: string }[] = [
  {
    id: 'g-wave',
    title: 'Hello / Wave',
    category: 'Greetings',
    url: 'https://media.giphy.com/media/mGpcM5w9Xy05w7wK6d/giphy.gif',
    preview: 'https://media.giphy.com/media/mGpcM5w9Xy05w7wK6d/200w.gif',
  },
  {
    id: 'g-cheers',
    title: 'Cheers / Great Job',
    category: 'Celebrate',
    url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    preview: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif',
  },
  {
    id: 'g-dance',
    title: 'Happy Dance',
    category: 'Celebrate',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    preview: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
  },
  {
    id: 'g-yes',
    title: 'Yes! High Five',
    category: 'Reactions',
    url: 'https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/giphy.gif',
    preview: 'https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/200w.gif',
  },
  {
    id: 'g-mindblown',
    title: 'Mind Blown',
    category: 'Reactions',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
  },
  {
    id: 'g-cat-typing',
    title: 'Typing Fast',
    category: 'Fun',
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif',
  },
  {
    id: 'g-popcorn',
    title: 'Eating Popcorn',
    category: 'Fun',
    url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    preview: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif',
  },
  {
    id: 'g-applause',
    title: 'Applause / Bravo',
    category: 'Celebrate',
    url: 'https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif',
    preview: 'https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/200w.gif',
  },
  {
    id: 'g-thanks',
    title: 'Thank You so much',
    category: 'Greetings',
    url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif',
    preview: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/200w.gif',
  },
];

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  },
  {
    name: 'Gestures & People',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
  },
  {
    name: 'Hearts & Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🐕', '🔥', '✨', '⚡', '💯', '🎉', '🚀'],
  },
];

export const StickerGifPicker: React.FC<StickerGifPickerProps> = ({
  onSelectEmoji,
  onSelectSticker,
  onSelectGif,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'stickers' | 'gifs'>('emoji');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStickerPack, setSelectedStickerPack] = useState<string>('Reactions');

  const filteredGifs = GIF_COLLECTIONS.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
  });

  return (
    <div
      className="w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm h-96 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none text-neutral-900 dark:text-neutral-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header with Tabs */}
      <div className="px-3 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/60">
        <div className="flex bg-neutral-200/80 dark:bg-neutral-800/80 p-0.5 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'emoji' ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-amber-500" />
            <span>Emoji</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'stickers' ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Stickers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gifs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'gifs' ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-purple-500" />
            <span>GIFs</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          aria-label="Close picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Emoji Picker */}
      {activeTab === 'emoji' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5 px-1">
                {cat.name}
              </div>
              <div className="grid grid-cols-8 gap-1">
                {cat.emojis.map((emoji, idx) => (
                  <button
                    key={`${cat.name}-${idx}`}
                    type="button"
                    onClick={() => onSelectEmoji(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:scale-120 rounded-xl transition-all cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Stickers */}
      {activeTab === 'stickers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Categories bar */}
          <div className="flex gap-1 p-2 border-b border-neutral-100 dark:border-neutral-800 overflow-x-auto bg-neutral-50/50 dark:bg-neutral-950/60 text-xs">
            {Object.keys(STICKER_PACKS).map((packName) => (
              <button
                key={packName}
                type="button"
                onClick={() => setSelectedStickerPack(packName)}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedStickerPack === packName
                    ? 'bg-orange-500 text-white shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                }`}
              >
                {packName}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2.5">
            {STICKER_PACKS[selectedStickerPack]?.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSelectSticker(sticker.url, sticker.name)}
                className="group flex flex-col items-center p-2 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-orange-200 dark:hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-neutral-800 hover:shadow-xs transition-all cursor-pointer text-center"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[80px]">
                  <span>{sticker.emoji}</span>
                  <span className="truncate">{sticker.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: GIFs */}
      {activeTab === 'gifs' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GIFs (cheers, dance, wow)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 gap-2">
            {filteredGifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelectGif(gif.url, gif.title)}
                className="group relative h-28 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-orange-400 hover:shadow-sm transition-all cursor-pointer"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-1.5 text-left">
                  <span className="text-[10px] font-semibold text-white truncate block">
                    {gif.title}
                  </span>
                </div>
              </button>
            ))}

            {filteredGifs.length === 0 && (
              <div className="col-span-2 py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                No matching GIFs found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
