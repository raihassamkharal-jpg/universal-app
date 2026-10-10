import React from 'react';
import { Plus } from 'lucide-react';
import { getInitials, getAvatarColor } from '../../lib/utils';
import type { UserStatus, Profile } from '../../types/database';

interface StatusTrayProps {
  currentUser: Profile | null;
  statuses: UserStatus[];
  onOpenCreate: () => void;
  onOpenViewer: (userStatuses: UserStatus[], startIndex?: number) => void;
}

export const StatusTray: React.FC<StatusTrayProps> = ({
  currentUser,
  statuses,
  onOpenCreate,
  onOpenViewer,
}) => {
  // Filter my statuses vs others' statuses
  const myStatuses = currentUser
    ? statuses.filter((s) => s.user_id === currentUser.id)
    : [];

  // Group other users' statuses by user_id
  const otherUsersMap = new Map<string, { user: Profile; statuses: UserStatus[]; hasUnread: boolean }>();

  statuses.forEach((s) => {
    if (currentUser && s.user_id === currentUser.id) return;
    if (!s.user) return;

    if (!otherUsersMap.has(s.user_id)) {
      otherUsersMap.set(s.user_id, {
        user: s.user,
        statuses: [],
        hasUnread: false,
      });
    }

    const entry = otherUsersMap.get(s.user_id)!;
    entry.statuses.push(s);
    if (!s.has_viewed) {
      entry.hasUnread = true;
    }
  });

  const otherStatusGroups = Array.from(otherUsersMap.values());

  const handleMyStatusClick = () => {
    if (myStatuses.length > 0) {
      onOpenViewer(myStatuses, 0);
    } else {
      onOpenCreate();
    }
  };

  return (
    <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 flex items-center gap-3 overflow-x-auto select-none no-scrollbar">
      {/* My Status Bubble */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={handleMyStatusClick}
            className={`w-12 h-12 rounded-full p-0.5 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${
              myStatuses.length > 0
                ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-neutral-900 bg-gradient-to-tr from-orange-500 to-amber-400'
                : 'border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-orange-400'
            }`}
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ${
                currentUser?.avatar_url
                  ? 'bg-neutral-200 dark:bg-neutral-800'
                  : getAvatarColor(currentUser?.username || 'me')
              }`}
            >
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.display_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                getInitials(currentUser?.display_name || currentUser?.username || 'Me')
              )}
            </div>
          </button>

          {/* Plus action icon to add story */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCreate();
            }}
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-neutral-900 hover:bg-orange-600 transition-colors shadow-2xs cursor-pointer"
            title="Add status update"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
          </button>
        </div>
        <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[58px]">
          My Status
        </span>
      </div>

      {/* Others' Status Bubbles */}
      {otherStatusGroups.map((group) => (
        <div
          key={group.user.id}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
          onClick={() => onOpenViewer(group.statuses, 0)}
        >
          <div
            className={`w-12 h-12 rounded-full p-0.5 flex items-center justify-center transition-transform hover:scale-105 ${
              group.hasUnread
                ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-neutral-900 bg-gradient-to-tr from-orange-500 to-amber-500'
                : 'ring-1.5 ring-neutral-300 dark:ring-neutral-700 ring-offset-1 dark:ring-offset-neutral-900 bg-neutral-200 dark:bg-neutral-800'
            }`}
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ${
                group.user.avatar_url
                  ? 'bg-neutral-200 dark:bg-neutral-800'
                  : getAvatarColor(group.user.username)
              }`}
            >
              {group.user.avatar_url ? (
                <img
                  src={group.user.avatar_url}
                  alt={group.user.display_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                getInitials(group.user.display_name || group.user.username)
              )}
            </div>
          </div>
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[58px]">
            {group.user.display_name.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
};
