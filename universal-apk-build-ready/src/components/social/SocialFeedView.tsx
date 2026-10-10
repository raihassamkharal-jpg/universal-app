import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Send,
  Loader2,
  BarChart2,
  UserPlus,
  UserCheck,
  Trash2,
  Reply,
  X,
  Sparkles,
} from 'lucide-react';
import {
  fetchFeedPosts,
  createFeedPost,
  deleteFeedPost,
  togglePostLike,
  fetchPostComments,
  addPostComment,
  deletePostComment,
  voteOnPoll,
  toggleFollowUser,
  checkIsFollowing,
  uploadFileToStorage,
  supabase,
  isSupabaseConfigured,
} from '../../lib/supabase/client';
import { getInitials, getAvatarColor, formatMessageTime } from '../../lib/utils';
import type { Post, PostComment, Profile } from '../../types/database';

interface SocialFeedViewProps {
  currentUserId: string;
  onOpenProfile?: (user: Profile) => void;
}

export const SocialFeedView: React.FC<SocialFeedViewProps> = ({
  currentUserId,
  onOpenProfile,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // New Post Composer State
  const [composerText, setComposerText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [posting, setPosting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Comment Thread Expansion State
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, PostComment[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<PostComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Following map
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const feed = await fetchFeedPosts(currentUserId);
    setPosts(feed);
    setLoading(false);

    // Check follow statuses for unique authors
    const authorIds = Array.from(new Set(feed.map((p) => p.user_id).filter((id) => id !== currentUserId)));
    authorIds.forEach(async (authorId) => {
      const isFollowing = await checkIsFollowing(currentUserId, authorId);
      setFollowingMap((prev) => ({ ...prev, [authorId]: isFollowing }));
    });
  }, [currentUserId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Realtime subscription for Posts, Likes, and Comments
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('social_feed_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newPost = payload.new as any;
          if (!newPost) return;

          // Fetch full profile info for the author
          let authorProfile: Profile | null = null;
          const { data: pData } = await supabase.from('profiles').select('*').eq('id', newPost.user_id).single();
          if (pData) authorProfile = pData as Profile;

          const completePost: Post = {
            ...newPost,
            user: authorProfile,
            likes_count: newPost.likes_count || 0,
            comments_count: newPost.comments_count || 0,
            has_liked: false,
          };

          setPosts((prev) => {
            if (prev.some((p) => p.id === completePost.id)) return prev;
            return [completePost, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const updated = payload.new as any;
          if (!updated) return;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    likes_count: updated.likes_count ?? p.likes_count,
                    comments_count: updated.comments_count ?? p.comments_count,
                    poll_options: updated.poll_options ?? p.poll_options,
                    poll_voters: updated.poll_voters ?? p.poll_voters,
                  }
                : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        async (payload) => {
          const targetPostId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (targetPostId) {
            const comments = await fetchPostComments(targetPostId);
            setCommentsMap((prev) => ({ ...prev, [targetPostId]: comments }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() && !mediaFile && !showPollComposer) return;

    setPosting(true);

    let mediaUrls: string[] = [];
    let mediaType: 'text' | 'image' | 'poll' = 'text';

    if (mediaFile) {
      const uploadRes = await uploadFileToStorage(mediaFile, 'feed-media');
      if (uploadRes.publicUrl) {
        mediaUrls.push(uploadRes.publicUrl);
        mediaType = 'image';
      }
    }

    let formattedPollOptions: { id: string; text: string; votes: number }[] | undefined = undefined;
    if (showPollComposer) {
      const cleanOptions = pollOptions.filter((opt) => opt.trim().length > 0);
      if (cleanOptions.length >= 2) {
        mediaType = 'poll';
        formattedPollOptions = cleanOptions.map((opt, i) => ({
          id: `opt_${i}`,
          text: opt.trim(),
          votes: 0,
        }));
      }
    }

    const created = await createFeedPost(
      currentUserId,
      composerText,
      mediaUrls,
      mediaType,
      formattedPollOptions
    );

    setPosting(false);

    if (created) {
      setPosts((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [created, ...prev];
      });
      setComposerText('');
      setMediaFile(null);
      setMediaPreview(null);
      setShowPollComposer(false);
      setPollOptions(['', '']);
      setErrorNotice(null);
    } else {
      setErrorNotice('Could not publish post. Please try again.');
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    const ok = window.confirm('Delete this post?');
    if (!ok) return;

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await deleteFeedPost(postId, currentUserId);
  };

  // Toggle Like
  const handleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const willLike = !p.has_liked;
        return {
          ...p,
          has_liked: willLike,
          likes_count: willLike ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
        };
      })
    );
    await togglePostLike(postId, currentUserId);
  };

  // Toggle Follow
  const handleFollowToggle = async (targetAuthorId: string) => {
    const isNowFollowing = await toggleFollowUser(currentUserId, targetAuthorId);
    setFollowingMap((prev) => ({ ...prev, [targetAuthorId]: isNowFollowing }));
  };

  // Poll Vote
  const handleVote = async (postId: string, optionId: string) => {
    const updated = await voteOnPoll(postId, currentUserId, optionId);
    if (updated) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    }
  };

  // Comments
  const handleToggleComments = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      setReplyingToComment(null);
      return;
    }
    setActiveCommentsPostId(postId);
    setReplyingToComment(null);
    if (!commentsMap[postId]) {
      const c = await fetchPostComments(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: c }));
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentInput.trim()) return;
    setSubmittingComment(true);

    const parentId = replyingToComment ? replyingToComment.id : undefined;
    const newComment = await addPostComment(postId, currentUserId, commentInput, parentId);
    setSubmittingComment(false);

    if (newComment) {
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
      );
      setCommentInput('');
      setReplyingToComment(null);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
    );
    await deletePostComment(commentId, postId, currentUserId);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/70 dark:bg-neutral-950 overflow-hidden text-neutral-900 dark:text-neutral-100">
      {/* Top Header */}
      <div className="p-4 sm:p-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Universal Social Feed
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Real-time posts, community thoughts, polls, and media sharing
        </p>
      </div>

      {/* Feed Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5">
        {/* Post Creation Composer */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <form onSubmit={handleCreatePost} className="space-y-3">
            {errorNotice && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center justify-between animate-in fade-in">
                <span>{errorNotice}</span>
                <button type="button" onClick={() => setErrorNotice(null)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white font-bold">
                  ✕
                </button>
              </div>
            )}

            <textarea
              placeholder="What's happening in your universe?"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              rows={3}
              className="w-full text-xs sm:text-sm text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 bg-transparent resize-none focus:outline-hidden"
            />

            {/* Media Image Preview */}
            {mediaPreview && (
              <div className="relative rounded-2xl overflow-hidden max-h-60 bg-neutral-100 dark:bg-neutral-800">
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Poll Creation Inputs */}
            {showPollComposer && (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Poll Options</span>
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white"
                  />
                ))}
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-xs text-orange-600 dark:text-orange-400 font-semibold hover:underline"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            )}

            {/* Composer Action Toolbar */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setMediaFile(f);
                      setMediaPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setShowPollComposer(!showPollComposer)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    showPollComposer
                      ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  title="Create Poll"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={posting || (!composerText.trim() && !mediaFile && !showPollComposer)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                {posting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Post</span>
              </button>
            </div>
          </form>
        </div>

        {/* Feed Posts List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
            <span className="text-xs">Loading social feed...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8">
            <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-neutral-700 dark:text-neutral-300">No posts in feed yet</h3>
            <p className="text-xs text-neutral-400 mt-1">Be the first to share your thoughts with Universal!</p>
          </div>
        ) : (
          posts.map((post) => {
            const author = post.user;
            const isMine = post.user_id === currentUserId;
            const isFollowing = followingMap[post.user_id];
            const comments = commentsMap[post.id] || [];

            return (
              <div
                key={post.id}
                className="bg-white dark:bg-neutral-900 rounded-3xl p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3.5"
              >
                {/* Author Info */}
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => author && onOpenProfile?.(author)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ${
                        author?.avatar_url
                          ? 'bg-neutral-200 dark:bg-neutral-800'
                          : getAvatarColor(author?.username || 'user')
                      }`}
                    >
                      {author?.avatar_url ? (
                        <img
                          src={author.avatar_url}
                          alt={author.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(author?.display_name || author?.username || 'User')
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-tight">
                        {author?.display_name || 'Universal Member'}
                      </h4>
                      <p className="text-[11px] text-neutral-400 font-mono">
                        @{author?.username || 'member'} · {formatMessageTime(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isMine && (
                      <button
                        onClick={() => handleFollowToggle(post.user_id)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isFollowing
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}

                    {isMine && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Delete Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Text */}
                {post.content && (
                  <p className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>
                )}

                {/* Media Image */}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="rounded-2xl overflow-hidden max-h-96 bg-neutral-100 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800">
                    <img
                      src={post.media_urls[0]}
                      alt="Post media"
                      className="w-full h-full object-cover max-h-96"
                    />
                  </div>
                )}

                {/* Poll Options */}
                {post.poll_options && (
                  <div className="space-y-2 pt-1">
                    {post.poll_options.map((opt) => {
                      const totalVotes = post.poll_options!.reduce((sum, o) => sum + (o.votes || 0), 0);
                      const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                      const hasVotedThis = post.poll_voters?.[currentUserId] === opt.id;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleVote(post.id, opt.id)}
                          className={`w-full relative overflow-hidden rounded-xl border p-2.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                            hasVotedThis
                              ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                          }`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-orange-100/60 dark:bg-orange-900/30 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between text-neutral-900 dark:text-neutral-100">
                            <span>{opt.text}</span>
                            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                              {opt.votes || 0} ({pct}%)
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
                  <div className="flex items-center gap-4">
                    {/* Like button */}
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                        post.has_liked
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'hover:text-rose-600 dark:hover:text-rose-400'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.has_liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{post.likes_count || 0}</span>
                    </button>

                    {/* Comments toggle */}
                    <button
                      onClick={() => handleToggleComments(post.id)}
                      className="flex items-center gap-1.5 font-semibold hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments_count || 0}</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-neutral-400 font-mono">
                    Universal Community
                  </span>
                </div>

                {/* Expandable Comment Section */}
                {activeCommentsPostId === post.id && (
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3 animate-in fade-in">
                    {/* Reply banner if replying to a specific comment */}
                    {replyingToComment && (
                      <div className="p-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-xl text-xs flex items-center justify-between text-orange-700 dark:text-orange-300">
                        <span className="truncate">
                          Replying to @{replyingToComment.user?.username}: "{replyingToComment.content.slice(0, 40)}"
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyingToComment(null)}
                          className="p-1 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Comment Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={replyingToComment ? 'Write a reply...' : 'Add a comment...'}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(post.id);
                          }
                        }}
                        className="flex-1 py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={submittingComment || !commentInput.trim()}
                        className="p-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-2 pt-1 max-h-60 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-[11px] text-neutral-400 py-2 text-center">No comments yet. Start the conversation!</p>
                      ) : (
                        comments.map((comment) => {
                          const isCommentOwner = comment.user_id === currentUserId;
                          return (
                            <div
                              key={comment.id}
                              className={`p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 ${
                                comment.parent_comment_id
                                  ? 'ml-6 bg-neutral-50/60 dark:bg-neutral-800/40'
                                  : 'bg-neutral-50 dark:bg-neutral-800/60'
                              } space-y-1`}
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                                  {comment.user?.display_name || 'Member'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-neutral-400">
                                    {formatMessageTime(comment.created_at)}
                                  </span>
                                  <button
                                    onClick={() => setReplyingToComment(comment)}
                                    className="text-neutral-400 hover:text-orange-600 flex items-center gap-0.5 cursor-pointer"
                                    title="Reply to comment"
                                  >
                                    <Reply className="w-3 h-3" />
                                  </button>
                                  {isCommentOwner && (
                                    <button
                                      onClick={() => handleDeleteComment(post.id, comment.id)}
                                      className="text-neutral-400 hover:text-rose-600 cursor-pointer"
                                      title="Delete Comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300">{comment.content}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
