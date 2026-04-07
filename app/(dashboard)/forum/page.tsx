"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, Send, Car,
  Flame, Lightbulb, Eye, Tag, Clock, BarChart2,
  ArrowUp, ArrowDown, X, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { RichComposer, renderMarkdown } from "@/components/forum/rich-composer";

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  likes_count: number;
  downvotes_count: number;
  replies_count: number;
  created_at: string;
  car_id: string | null;
  user_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
  primary_car?: { make: string; model: string; year: number } | null;
  cars?: { make: string; model: string; year: number; cover_image_url: string | null } | null;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; display_name: string | null };
}

type SortMode = "new" | "hot" | "top";

const CATEGORIES = [
  { value: "all", label: "All", icon: <MessageSquare size={12} /> },
  { value: "build", label: "Build", icon: <Car size={12} /> },
  { value: "advice", label: "Advice", icon: <Lightbulb size={12} /> },
  { value: "showcase", label: "Showcase", icon: <Eye size={12} /> },
  { value: "general", label: "General", icon: <MessageSquare size={12} /> },
  { value: "for_sale", label: "For Sale", icon: <Tag size={12} /> },
];

const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: "hot", label: "Hot", icon: <Flame size={12} /> },
  { value: "new", label: "New", icon: <Clock size={12} /> },
  { value: "top", label: "Top", icon: <BarChart2 size={12} /> },
];

const FLAIR_STYLES: Record<string, { bg: string; color: string }> = {
  build: { bg: "rgba(59,130,246,0.12)", color: "#60A5FA" },
  advice: { bg: "rgba(255,159,10,0.12)", color: "#ff9f0a" },
  showcase: { bg: "rgba(48,209,88,0.12)", color: "#30d158" },
  general: { bg: "rgba(255,255,255,0.05)", color: "#8a8a8a" },
  for_sale: { bg: "rgba(168,85,247,0.12)", color: "#c084fc" },
};

const PAGE_SIZE = 15;

function scorePost(post: Post): number {
  return post.likes_count - (post.downvotes_count ?? 0);
}

function voteGlowClass(score: number): string {
  if (score >= 25) return "vote-glow-hot";
  if (score >= 8) return "vote-glow-mid";
  if (score >= 3) return "vote-glow-low";
  return "";
}

function AvatarInitial({ username }: { username: string }) {
  const initial = username[0]?.toUpperCase() ?? "?";
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">{initial}</span>
    </div>
  );
}

function CarBadge({ car }: { car: { make: string; model: string; year: number } }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] font-semibold text-[var(--color-text-secondary)]">
      <Car size={9} className="text-[var(--color-accent-bright)]" />
      {car.year} {car.make} {car.model}
    </span>
  );
}

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortMode>("hot");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general", car_id: "" });
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [upvotedPosts, setUpvotedPosts] = useState<Set<string>>(new Set());
  const [downvotedPosts, setDownvotedPosts] = useState<Set<string>>(new Set());
  const [userCars, setUserCars] = useState<{ id: string; make: string; model: string; year: number }[]>([]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial user data
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: cars } = await supabase
        .from("cars")
        .select("id, make, model, year")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setUserCars((cars ?? []) as typeof userCars);

      const { data: upvotes } = await supabase
        .from("forum_likes")
        .select("post_id")
        .eq("user_id", user.id);
      setUpvotedPosts(new Set((upvotes ?? []).map((u) => u.post_id)));

      try {
        const { data: downvotes } = await supabase
          .from("forum_downvotes")
          .select("post_id")
          .eq("user_id", user.id);
        setDownvotedPosts(new Set((downvotes ?? []).map((d) => d.post_id)));
      } catch { /* table may not exist */ }
    });
  }, []);

  // Fetch hot posts (always — used for top section)
  useEffect(() => {
    fetch("/api/forum/posts?sort=top&limit=3")
      .then((r) => r.json())
      .then((j) => setHotPosts((j.posts ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  // Fetch initial posts when category/sort changes
  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    fetchPosts(0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  const fetchPosts = useCallback(
    async (startOffset: number, replace = false) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(startOffset),
          sort,
        });
        if (category !== "all") params.set("category", category);
        const res = await fetch(`/api/forum/posts?${params}`);
        if (!res.ok) throw new Error("Couldn't load posts. Please try again.");
        const json = await res.json();
        const newPosts: Post[] = json.posts ?? [];
        if (replace) setPosts(newPosts);
        else setPosts((prev) => [...prev, ...newPosts]);
        if (newPosts.length < PAGE_SIZE) setHasMore(false);
        setOffset(startOffset + newPosts.length);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, sort]
  );

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          fetchPosts(offset);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchPosts, offset, hasMore, loading, loadingMore]);

  async function togglePost(postId: string) {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(postId);
    if (!replies[postId]) {
      setLoadingReplies(postId);
      try {
        const res = await fetch(`/api/forum/posts/${postId}/replies`);
        const json = await res.json();
        setReplies((prev) => ({ ...prev, [postId]: json.replies ?? [] }));
      } catch {
        // Silently fall back to empty replies — the inline list will show
        // a friendly empty state next to the post.
        setReplies((prev) => ({ ...prev, [postId]: [] }));
      } finally {
        setLoadingReplies(null);
      }
    }
  }

  async function submitReply(postId: string) {
    const content = replyText[postId]?.trim();
    if (!content || submittingReply) return;
    setSubmittingReply(postId);
    haptic("light");
    try {
      const res = await fetch(`/api/forum/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (res.ok) {
        setReplies((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), json.reply] }));
        setReplyText((prev) => ({ ...prev, [postId]: "" }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p))
        );
      }
    } catch {
      setPostError("Couldn't post your reply. Please try again.");
    } finally {
      setSubmittingReply(null);
    }
  }

  async function submitPost() {
    if (!newPost.title.trim() || !newPost.content.trim() || submittingPost) return;
    if (!currentUserId) {
      setPostError("You must be signed in to post.");
      return;
    }
    setSubmittingPost(true);
    setPostError(null);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPost.title,
          content: newPost.content,
          category: newPost.category,
          car_id: newPost.car_id || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        haptic("success");
        setShowNewPost(false);
        setNewPost({ title: "", content: "", category: "general", car_id: "" });
        setPostError(null);
        fetchPosts(0, true);
      } else {
        const msg = typeof json.error === "string" ? json.error : "Failed to post";
        setPostError(msg === "Unauthorized" ? "You must be signed in to post." : msg);
      }
    } catch {
      setPostError("Something went wrong. Please try again.");
    } finally {
      setSubmittingPost(false);
    }
  }

  async function handleUpvote(postId: string) {
    if (!currentUserId) return;
    haptic("light");
    const supabase = createClient();
    const isUpvoted = upvotedPosts.has(postId);
    const isDownvoted = downvotedPosts.has(postId);

    if (isUpvoted) {
      await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      setUpvotedPosts((prev) => {
        const s = new Set(prev);
        s.delete(postId);
        return s;
      });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p)));
    } else {
      if (isDownvoted) {
        try {
          await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId);
        } catch { /* table may not exist */ }
        setDownvotedPosts((prev) => {
          const s = new Set(prev);
          s.delete(postId);
          return s;
        });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p
          )
        );
      }
      await supabase.from("forum_likes").insert({ post_id: postId, user_id: currentUserId });
      setUpvotedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)));
    }
  }

  async function handleDownvote(postId: string) {
    if (!currentUserId) return;
    haptic("light");
    const supabase = createClient();
    const isUpvoted = upvotedPosts.has(postId);
    const isDownvoted = downvotedPosts.has(postId);

    if (isDownvoted) {
      try {
        await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => {
        const s = new Set(prev);
        s.delete(postId);
        return s;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p
        )
      );
    } else {
      if (isUpvoted) {
        await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
        setUpvotedPosts((prev) => {
          const s = new Set(prev);
          s.delete(postId);
          return s;
        });
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p)));
      }
      try {
        await supabase.from("forum_downvotes").insert({ post_id: postId, user_id: currentUserId });
      } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, downvotes_count: (p.downvotes_count ?? 0) + 1 } : p))
      );
    }
  }

  const flair = (cat: string) => FLAIR_STYLES[cat] ?? FLAIR_STYLES.general;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Forum</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Community discussion</p>
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all active:scale-95 cursor-pointer shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
        >
          <Plus size={14} />
          Create Post
        </button>
      </div>

      {/* Hot right now section */}
      {hotPosts.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} className="text-[#ff9f0a]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Hot Right Now</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {hotPosts.map((post) => {
              const fl = flair(post.category);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setExpandedPost(post.id);
                    if (!replies[post.id]) togglePost(post.id);
                  }}
                  className="text-left rounded-2xl bg-[var(--color-bg-card)] border border-[rgba(255,159,10,0.2)] p-4 hover:border-[rgba(255,159,10,0.4)] transition-all card-hover relative overflow-hidden sweep"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flame size={10} className="text-[#ff9f0a]" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#ff9f0a]">Trending</span>
                  </div>
                  <p className="text-sm font-bold leading-snug line-clamp-2 mb-2">{post.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    <span style={{ background: fl.bg, color: fl.color }} className="flair">{post.category.replace("_", " ")}</span>
                    <span>·</span>
                    <span className="font-semibold">{scorePost(post)} pts</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Sort + Category */}
      <div className="space-y-3 mb-5">
        <div className="flex bg-[var(--color-bg-card)] rounded-2xl p-1.5 gap-1 border border-[var(--color-border)]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sort === opt.value
                  ? "bg-[var(--color-bg-elevated)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <span className={sort === opt.value ? "text-[var(--color-accent)]" : ""}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                category === cat.value
                  ? "bg-[var(--color-accent)] text-white shadow-[0_2px_12px_rgba(59,130,246,0.25)]"
                  : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-bright)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md" onClick={() => { setShowNewPost(false); setPostError(null); }} />
          <div className="fixed inset-x-5 top-1/2 -translate-y-1/2 z-50 max-w-xl mx-auto rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">New Post</h2>
              <button
                onClick={() => { setShowNewPost(false); setPostError(null); }}
                className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <X size={14} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="space-y-4">
              {postError && (
                <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]">
                  {postError}
                  {postError.includes("signed in") && (
                    <a href="/login" className="ml-1.5 underline font-semibold">Sign in</a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Category</p>
                  <select
                    value={newPost.category}
                    onChange={(e) => setNewPost((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-3 py-2.5 outline-none focus:border-[var(--color-accent)] text-white"
                  >
                    {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {userCars.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Tag Your Car</p>
                    <select
                      value={newPost.car_id}
                      onChange={(e) => setNewPost((p) => ({ ...p, car_id: e.target.value }))}
                      className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-3 py-2.5 outline-none focus:border-[var(--color-accent)] text-white"
                    >
                      <option value="">None</option>
                      {userCars.map((c) => (
                        <option key={c.id} value={c.id}>{c.year} {c.make} {c.model}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Title</p>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                  placeholder="What's on your mind?"
                  className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-4 py-3 outline-none focus:border-[var(--color-accent)] text-white placeholder-[var(--color-text-muted)]"
                  maxLength={200}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Body</p>
                <RichComposer
                  value={newPost.content}
                  onChange={(v) => setNewPost((p) => ({ ...p, content: v }))}
                  placeholder="Describe your build, ask a question, share details... use **bold**, *italic*, lists, and images."
                  rows={6}
                />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPost}
                  disabled={submittingPost || !newPost.title.trim() || !newPost.content.trim()}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {submittingPost ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Inline error state */}
      {fetchError && !loading && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 mb-4 flex items-center justify-between gap-3"
        >
          <p className="text-xs text-[var(--color-danger)] font-bold">{fetchError}</p>
          <button
            type="button"
            onClick={() => fetchPosts(0, true)}
            className="text-[11px] font-bold text-white px-4 py-2 rounded-lg bg-[var(--color-danger)] hover:brightness-110 transition-all cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-5">
            <MessageSquare size={24} className="text-[var(--color-text-disabled)]" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-secondary)]">No posts yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xs mx-auto">Be the legend who starts it.</p>
          <button
            onClick={() => setShowNewPost(true)}
            className="mt-6 h-10 px-6 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
          >
            Create post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isExpanded = expandedPost === post.id;
            const postReplies = replies[post.id] ?? [];
            const isUpvoted = upvotedPosts.has(post.id);
            const isDownvoted = downvotedPosts.has(post.id);
            const score = scorePost(post);
            const fl = flair(post.category);
            const glow = voteGlowClass(score);

            return (
              <div
                id={`post-${post.id}`}
                key={post.id}
                className={`rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden transition-all ${glow}`}
              >
                <div className="p-5">
                  <div className="flex gap-4">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                      <button
                        onClick={() => handleUpvote(post.id)}
                        className={`vote-btn up ${isUpvoted ? "active" : ""}`}
                        aria-label="Upvote"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <span
                        className={`text-sm font-black tabular min-w-[24px] text-center ${
                          isUpvoted
                            ? "text-[#60A5FA]"
                            : isDownvoted
                            ? "text-[var(--color-danger)]"
                            : score >= 8
                            ? "text-[#ff9f0a]"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {score}
                      </span>
                      <button
                        onClick={() => handleDownvote(post.id)}
                        className={`vote-btn down ${isDownvoted ? "active" : ""}`}
                        aria-label="Downvote"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                        <AvatarInitial username={post.profiles.username} />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[12px] font-bold text-white">
                            @{post.profiles.username}
                          </span>
                          {post.primary_car && (
                            <CarBadge car={post.primary_car} />
                          )}
                        </div>
                        <span className="flair" style={{ background: fl.bg, color: fl.color }}>
                          {post.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold leading-snug mb-2 text-white">{post.title}</h3>

                      {/* Content preview / full */}
                      {isExpanded ? (
                        <div className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed prose-sm">
                          {renderMarkdown(post.content)}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                          {post.content.replace(/[*_`#![\]()]/g, "")}
                        </p>
                      )}

                      {post.cars && (
                        <div className="flex items-center gap-2 mt-3">
                          <Car size={11} className="text-[var(--color-accent-bright)]" />
                          <span className="text-[11px] text-[var(--color-text-secondary)] font-semibold">
                            {post.cars.year} {post.cars.make} {post.cars.model}
                          </span>
                        </div>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
                        <button
                          onClick={() => togglePost(post.id)}
                          className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer font-semibold"
                        >
                          <MessageSquare size={13} />
                          {post.replies_count} {post.replies_count === 1 ? "reply" : "replies"}
                        </button>
                        <button
                          onClick={() => togglePost(post.id)}
                          className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer p-1"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies drawer */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.01)] px-5 py-4 space-y-3 animate-in-fast">
                    {loadingReplies === post.id ? (
                      <div className="py-4 flex justify-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]"
                            style={{ animation: `typing-dot 1.2s ease ${i * 0.15}s infinite` }}
                          />
                        ))}
                      </div>
                    ) : postReplies.length === 0 ? (
                      <p className="text-center text-xs text-[var(--color-text-muted)] py-3">
                        No replies yet — be the first!
                      </p>
                    ) : (
                      postReplies.map((r) => (
                        <div key={r.id} className="flex gap-3">
                          <AvatarInitial username={r.profiles.username} />
                          <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-2xl px-4 py-3 border border-[var(--color-border)]">
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <span className="text-[11px] font-bold text-white">@{r.profiles.username}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">
                                {formatRelativeDate(r.created_at)}
                              </span>
                            </div>
                            <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                              {r.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Reply input */}
                    <div className="flex gap-2.5 pt-1">
                      <input
                        type="text"
                        value={replyText[post.id] ?? ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && submitReply(post.id)}
                        placeholder="Write a reply..."
                        className="flex-1 h-10 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[13px] px-4 outline-none focus:border-[var(--color-accent)] placeholder-[var(--color-text-muted)] text-white"
                      />
                      <button
                        onClick={() => submitReply(post.id)}
                        disabled={!replyText[post.id]?.trim() || submittingReply === post.id}
                        className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center disabled:opacity-35 hover:brightness-110 transition-all cursor-pointer"
                        aria-label="Send reply"
                      >
                        {submittingReply === post.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={14} className="text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="py-8 flex items-center justify-center">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Loader2 size={14} className="animate-spin" />
                  Loading more...
                </div>
              ) : (
                <div className="h-1" />
              )}
            </div>
          )}
          {!hasMore && posts.length > PAGE_SIZE && (
            <p className="py-8 text-center text-xs text-[var(--color-text-muted)]">You&apos;re all caught up.</p>
          )}
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
