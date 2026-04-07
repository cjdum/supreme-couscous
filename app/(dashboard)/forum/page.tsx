"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, Send, Car,
  Flame, Lightbulb, Eye, Tag, TrendingUp, Clock, BarChart2,
  ArrowUp, ArrowDown, X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";

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

function scorePost(post: Post): number {
  return post.likes_count - (post.downvotes_count ?? 0);
}

function AvatarInitial({ username }: { username: string }) {
  const initial = username[0]?.toUpperCase() ?? "?";
  return (
    <div className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{initial}</span>
    </div>
  );
}

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [upvotedPosts, setUpvotedPosts] = useState<Set<string>>(new Set());
  const [downvotedPosts, setDownvotedPosts] = useState<Set<string>>(new Set());
  const [userCars, setUserCars] = useState<{ id: string; make: string; model: string; year: number }[]>([]);

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
      } catch {
        // forum_downvotes table may not exist yet
      }
    });
  }, []);

  useEffect(() => {
    fetchPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30", sort });
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/forum/posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingReplies(null);
      }
    }
  }

  async function submitReply(postId: string) {
    const content = replyText[postId]?.trim();
    if (!content || submittingReply) return;
    setSubmittingReply(postId);
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
          prev.map((p) => p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReply(null);
    }
  }

  async function submitPost() {
    if (!newPost.title.trim() || !newPost.content.trim() || submittingPost) return;
    if (!currentUserId) {
      setPostError("You must be signed in to post. Please sign in first.");
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
        setShowNewPost(false);
        setNewPost({ title: "", content: "", category: "general", car_id: "" });
        setPostError(null);
        fetchPosts();
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
    const supabase = createClient();
    const isUpvoted = upvotedPosts.has(postId);
    const isDownvoted = downvotedPosts.has(postId);

    if (isUpvoted) {
      await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      setUpvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      if (isDownvoted) {
        try { await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId); } catch { /* table may not exist */ }
        setDownvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p));
      }
      await supabase.from("forum_likes").insert({ post_id: postId, user_id: currentUserId });
      setUpvotedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
    }
  }

  async function handleDownvote(postId: string) {
    if (!currentUserId) return;
    const supabase = createClient();
    const isUpvoted = upvotedPosts.has(postId);
    const isDownvoted = downvotedPosts.has(postId);

    if (isDownvoted) {
      try { await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId); } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p));
    } else {
      if (isUpvoted) {
        await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
        setUpvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
      }
      try { await supabase.from("forum_downvotes").insert({ post_id: postId, user_id: currentUserId }); } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: (p.downvotes_count ?? 0) + 1 } : p));
    }
  }

  const flair = (cat: string) => FLAIR_STYLES[cat] ?? FLAIR_STYLES.general;

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forum</h1>
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

      {/* Sort + Category */}
      <div className="space-y-3 mb-6">
        {/* Sort tabs — pill style */}
        <div className="flex bg-[var(--color-bg-card)] rounded-2xl p-1.5 gap-1 border border-[var(--color-border)]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
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
          <div className="fixed inset-x-5 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">New Post</h2>
              <button onClick={() => { setShowNewPost(false); setPostError(null); }} className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors">
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
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Category</p>
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
                    <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Tag Your Car</p>
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
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Title</p>
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
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Details</p>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Describe your build, ask a question, share details..."
                  rows={4}
                  className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-4 py-3 outline-none focus:border-[var(--color-accent)] text-white placeholder-[var(--color-text-muted)] resize-none"
                  maxLength={5000}
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
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xs mx-auto">
            Be the legend who starts it.
          </p>
          <button
            onClick={() => setShowNewPost(true)}
            className="mt-6 h-10 px-6 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
          >
            Create post
          </button>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {posts.map((post) => {
            const isExpanded = expandedPost === post.id;
            const postReplies = replies[post.id] ?? [];
            const isUpvoted = upvotedPosts.has(post.id);
            const isDownvoted = downvotedPosts.has(post.id);
            const score = scorePost(post);
            const fl = flair(post.category);

            return (
              <div
                key={post.id}
                className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex gap-3.5">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                      <button
                        onClick={() => handleUpvote(post.id)}
                        className={`vote-btn up ${isUpvoted ? "active" : ""}`}
                        aria-label="Upvote"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <span
                        className={`text-xs font-bold tabular-nums min-w-[20px] text-center ${
                          isUpvoted ? "text-[#60A5FA]" :
                          isDownvoted ? "text-[var(--color-danger)]" :
                          "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {score}
                      </span>
                      <button
                        onClick={() => handleDownvote(post.id)}
                        className={`vote-btn down ${isDownvoted ? "active" : ""}`}
                        aria-label="Downvote"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-2.5 flex-wrap mb-2">
                        <AvatarInitial username={post.profiles.username} />
                        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                          @{post.profiles.username}
                        </span>
                        <span
                          className="flair"
                          style={{ background: fl.bg, color: fl.color }}
                        >
                          {post.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-[15px] font-bold leading-snug mb-1.5">{post.title}</h3>

                      {/* Content preview */}
                      <p className={`text-[13px] text-[var(--color-text-secondary)] leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>

                      {/* Car tag */}
                      {post.cars && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <Car size={10} className="text-[var(--color-text-muted)]" />
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                            {post.cars.year} {post.cars.make} {post.cars.model}
                          </span>
                        </div>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
                        <button
                          onClick={() => togglePost(post.id)}
                          className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer font-medium"
                        >
                          <MessageSquare size={13} />
                          {post.replies_count} {post.replies_count === 1 ? "reply" : "replies"}
                        </button>
                        <div className="ml-auto">
                          <button
                            onClick={() => togglePost(post.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer p-1"
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
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
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]"
                            style={{ animation: `typing-dot 1.2s ease ${i * 0.15}s infinite` }} />
                        ))}
                      </div>
                    ) : postReplies.length === 0 ? (
                      <p className="text-center text-xs text-[var(--color-text-muted)] py-3">No replies yet — be the first!</p>
                    ) : (
                      postReplies.map((r) => (
                        <div key={r.id} className="flex gap-3">
                          <AvatarInitial username={r.profiles.username} />
                          <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-2xl px-4 py-3 border border-[var(--color-border)]">
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">@{r.profiles.username}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">{formatRelativeDate(r.created_at)}</span>
                            </div>
                            <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{r.content}</p>
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
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
