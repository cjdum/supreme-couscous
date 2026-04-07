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
  build: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
  advice: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24" },
  showcase: { bg: "rgba(34,197,94,0.15)", color: "#4ade80" },
  general: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" },
  for_sale: { bg: "rgba(168,85,247,0.15)", color: "#c084fc" },
};

function scorePost(post: Post): number {
  return post.likes_count - (post.downvotes_count ?? 0);
}

function AvatarInitial({ username }: { username: string }) {
  const initial = username[0]?.toUpperCase() ?? "?";
  return (
    <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-[rgba(255,255,255,0.45)]">{initial}</span>
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

      // Load existing votes
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
    setSubmittingPost(true);
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
        fetchPosts();
      } else {
        alert(typeof json.error === "string" ? json.error : "Failed to post");
      }
    } catch (err) {
      console.error(err);
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
      // Remove upvote
      await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      setUpvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      // If downvoted, remove downvote first
      if (isDownvoted) {
        try { await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId); } catch { /* table may not exist */ }
        setDownvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p));
      }
      // Add upvote
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
      // Remove downvote
      try { await supabase.from("forum_downvotes").delete().eq("post_id", postId).eq("user_id", currentUserId); } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: Math.max(0, (p.downvotes_count ?? 0) - 1) } : p));
    } else {
      // If upvoted, remove upvote first
      if (isUpvoted) {
        await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
        setUpvotedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
      }
      // Add downvote
      try { await supabase.from("forum_downvotes").insert({ post_id: postId, user_id: currentUserId }); } catch { /* table may not exist */ }
      setDownvotedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, downvotes_count: (p.downvotes_count ?? 0) + 1 } : p));
    }
  }

  const flair = (cat: string) => FLAIR_STYLES[cat] ?? FLAIR_STYLES.general;

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Forum</h1>
          <p className="text-xs text-[rgba(255,255,255,0.28)] mt-0.5">Community discussion</p>
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#3B82F6] text-white text-xs font-semibold hover:bg-[#60A5FA] transition-colors active:scale-95 cursor-pointer"
        >
          <Plus size={13} />
          Post
        </button>
      </div>

      {/* Sort + Category */}
      <div className="space-y-2 mb-5">
        {/* Sort tabs */}
        <div className="flex bg-[#1a1a1a] rounded-[12px] p-1 gap-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[9px] text-xs font-semibold transition-all cursor-pointer ${
                sort === opt.value
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)]"
              }`}
            >
              <span className={sort === opt.value ? "text-[#3B82F6]" : ""}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                category === cat.value
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.45)] hover:border-[rgba(255,255,255,0.15)]"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowNewPost(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-[22px] bg-[#111111] border border-[rgba(255,255,255,0.08)] p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">New Post</h2>
              <button onClick={() => setShowNewPost(false)} className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center cursor-pointer hover:bg-[#222222]">
                <X size={13} className="text-[rgba(255,255,255,0.45)]" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1.5">Category</p>
                  <select
                    value={newPost.category}
                    onChange={(e) => setNewPost((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-sm px-3 py-2.5 outline-none focus:border-[#3B82F6] text-white"
                  >
                    {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {userCars.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1.5">Tag Your Car</p>
                    <select
                      value={newPost.car_id}
                      onChange={(e) => setNewPost((p) => ({ ...p, car_id: e.target.value }))}
                      className="w-full rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-sm px-3 py-2.5 outline-none focus:border-[#3B82F6] text-white"
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
                <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1.5">Title</p>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                  placeholder="What's on your mind?"
                  className="w-full rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-sm px-3 py-2.5 outline-none focus:border-[#3B82F6] text-white placeholder-[rgba(255,255,255,0.25)]"
                  maxLength={200}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1.5">Details</p>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Describe your build, ask a question, share details…"
                  rows={4}
                  className="w-full rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-sm px-3 py-2.5 outline-none focus:border-[#3B82F6] text-white placeholder-[rgba(255,255,255,0.25)] resize-none"
                  maxLength={5000}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 h-10 rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-sm font-medium text-[rgba(255,255,255,0.55)] hover:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPost}
                  disabled={submittingPost || !newPost.title.trim() || !newPost.content.trim()}
                  className="flex-1 h-10 rounded-[10px] bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#60A5FA] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {submittingPost ? "Posting…" : "Post"}
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
            <div key={i} className="skeleton h-28 rounded-[18px]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={22} className="text-[rgba(255,255,255,0.2)]" />
          </div>
          <p className="text-sm font-semibold text-[rgba(255,255,255,0.55)]">No posts yet</p>
          <p className="text-xs text-[rgba(255,255,255,0.28)] mt-1">Be the first to start a discussion</p>
          <button
            onClick={() => setShowNewPost(true)}
            className="mt-4 h-9 px-5 rounded-full bg-[#3B82F6] text-white text-xs font-semibold hover:bg-[#60A5FA] transition-colors cursor-pointer"
          >
            Create post
          </button>
        </div>
      ) : (
        <div className="space-y-2">
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
                className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden"
              >
                {/* Post body */}
                <div className="p-4">
                  <div className="flex gap-3">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                      <button
                        onClick={() => handleUpvote(post.id)}
                        className={`vote-btn up ${isUpvoted ? "active" : ""}`}
                        aria-label="Upvote"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <span
                        className={`text-xs font-bold tabular-nums min-w-[20px] text-center ${
                          isUpvoted ? "text-[#60A5FA]" :
                          isDownvoted ? "text-[#f87171]" :
                          "text-[rgba(255,255,255,0.45)]"
                        }`}
                      >
                        {score}
                      </span>
                      <button
                        onClick={() => handleDownvote(post.id)}
                        className={`vote-btn down ${isDownvoted ? "active" : ""}`}
                        aria-label="Downvote"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <AvatarInitial username={post.profiles.username} />
                        <span className="text-[11px] font-semibold text-[rgba(255,255,255,0.7)]">
                          @{post.profiles.username}
                        </span>
                        <span
                          className="flair"
                          style={{ background: fl.bg, color: fl.color }}
                        >
                          {post.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-[rgba(255,255,255,0.28)] ml-auto">
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold leading-snug mb-1">{post.title}</h3>

                      {/* Content preview */}
                      <p className={`text-[12px] text-[rgba(255,255,255,0.5)] leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>

                      {/* Car tag */}
                      {post.cars && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Car size={9} className="text-[rgba(255,255,255,0.28)]" />
                          <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
                            {post.cars.year} {post.cars.make} {post.cars.model}
                          </span>
                        </div>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                        <button
                          onClick={() => togglePost(post.id)}
                          className="flex items-center gap-1.5 text-[11px] text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)] transition-colors cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          {post.replies_count} {post.replies_count === 1 ? "reply" : "replies"}
                        </button>
                        <div className="ml-auto">
                          <button
                            onClick={() => togglePost(post.id)}
                            className="text-[rgba(255,255,255,0.28)] hover:text-[rgba(255,255,255,0.55)] transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies drawer */}
                {isExpanded && (
                  <div className="border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-4 py-3 space-y-3 animate-in-fast">
                    {loadingReplies === post.id ? (
                      <div className="py-3 flex justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.2)]"
                            style={{ animation: `typing-dot 1.2s ease ${i * 0.15}s infinite` }} />
                        ))}
                      </div>
                    ) : postReplies.length === 0 ? (
                      <p className="text-center text-xs text-[rgba(255,255,255,0.25)] py-2">No replies yet — be the first!</p>
                    ) : (
                      postReplies.map((r) => (
                        <div key={r.id} className="flex gap-2.5">
                          <AvatarInitial username={r.profiles.username} />
                          <div className="flex-1 bg-[#1a1a1a] rounded-[12px] px-3 py-2 border border-[rgba(255,255,255,0.05)]">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-[rgba(255,255,255,0.7)]">@{r.profiles.username}</span>
                              <span className="text-[10px] text-[rgba(255,255,255,0.28)]">{formatRelativeDate(r.created_at)}</span>
                            </div>
                            <p className="text-[12px] text-[rgba(255,255,255,0.55)] leading-relaxed">{r.content}</p>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Reply input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={replyText[post.id] ?? ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && submitReply(post.id)}
                        placeholder="Write a reply…"
                        className="flex-1 h-9 rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-[12px] px-3 outline-none focus:border-[#3B82F6] placeholder-[rgba(255,255,255,0.25)] text-white"
                      />
                      <button
                        onClick={() => submitReply(post.id)}
                        disabled={!replyText[post.id]?.trim() || submittingReply === post.id}
                        className="w-9 h-9 rounded-[10px] bg-[#3B82F6] flex items-center justify-center disabled:opacity-35 hover:bg-[#60A5FA] transition-colors cursor-pointer"
                        aria-label="Send reply"
                      >
                        {submittingReply === post.id ? (
                          <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={13} className="text-white" />
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
