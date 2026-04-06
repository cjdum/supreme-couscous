"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Plus, Heart, ChevronDown, ChevronUp, Send, Car, Flame, Lightbulb, Eye, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  car_id: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
  cars?: { make: string; model: string; year: number; cover_image_url: string | null } | null;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; display_name: string | null };
}

const CATEGORIES = [
  { value: "all", label: "All", icon: <MessageSquare size={13} /> },
  { value: "build", label: "Build", icon: <Car size={13} /> },
  { value: "advice", label: "Advice", icon: <Lightbulb size={13} /> },
  { value: "showcase", label: "Showcase", icon: <Eye size={13} /> },
  { value: "general", label: "General", icon: <MessageSquare size={13} /> },
  { value: "for_sale", label: "For Sale", icon: <Tag size={13} /> },
];

const CATEGORY_COLORS: Record<string, string> = {
  build: "rgba(10,132,255,0.15)",
  advice: "rgba(255,214,10,0.15)",
  showcase: "rgba(48,209,88,0.15)",
  general: "rgba(235,235,245,0.08)",
  for_sale: "rgba(191,90,242,0.15)",
};
const CATEGORY_TEXT: Record<string, string> = {
  build: "var(--color-accent-bright)",
  advice: "var(--color-warning)",
  showcase: "var(--color-success)",
  general: "var(--color-text-secondary)",
  for_sale: "#bf5af2",
};

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" });
  const [submittingPost, setSubmittingPost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    fetchPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/forum/posts?${params}`);
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
          prev.map((p) =>
            p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p
          )
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
        body: JSON.stringify(newPost),
      });
      const json = await res.json();
      if (res.ok) {
        setShowNewPost(false);
        setNewPost({ title: "", content: "", category: "general" });
        fetchPosts();
      } else {
        alert(json.error ?? "Failed to post");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPost(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!currentUserId) return;
    const supabase = createClient();
    if (likedPosts.has(postId)) {
      await supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      setLikedPosts((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      await supabase.from("forum_likes").insert({ post_id: postId, user_id: currentUserId });
      setLikedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
    }
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-[var(--color-accent)]" />
          <div>
            <h1 className="text-xl font-bold">Forum</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Community discussion</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[var(--color-accent)] text-white text-xs font-semibold hover:bg-[var(--color-accent-hover)] transition-colors active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          New Post
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
              category === cat.value
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)]"
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* New post modal */}
      {showNewPost && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowNewPost(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-[22px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 shadow-2xl animate-scale-in">
            <h2 className="text-base font-bold mb-4">New Post</h2>
            <div className="space-y-3">
              <select
                value={newPost.category}
                onChange={(e) => setNewPost((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-3 py-2.5 outline-none focus:border-[var(--color-accent)]"
              >
                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                placeholder="Post title…"
                className="w-full rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-3 py-2.5 outline-none focus:border-[var(--color-accent)]"
              />
              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                placeholder="Share your thoughts, questions, or build details…"
                rows={5}
                className="w-full rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm px-3 py-2.5 outline-none focus:border-[var(--color-accent)] resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 h-10 rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPost}
                  disabled={submittingPost || !newPost.title.trim() || !newPost.content.trim()}
                  className="flex-1 h-10 rounded-[10px] bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 cursor-pointer"
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-[16px]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={32} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" />
          <p className="text-sm text-[var(--color-text-secondary)]">No posts yet in this category</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isExpanded = expandedPost === post.id;
            const postReplies = replies[post.id] ?? [];
            const isLiked = likedPosts.has(post.id);

            return (
              <div
                key={post.id}
                className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden animate-in"
              >
                {/* Post header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                      <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                        {post.profiles.username[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          @{post.profiles.username}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: CATEGORY_COLORS[post.category] ?? "rgba(235,235,245,0.08)",
                            color: CATEGORY_TEXT[post.category] ?? "var(--color-text-secondary)",
                          }}
                        >
                          {post.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mt-1 leading-snug">{post.title}</h3>
                      <p className={`text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>

                      {/* Car tag */}
                      {post.cars && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Car size={10} className="text-[var(--color-text-muted)]" />
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {post.cars.year} {post.cars.make} {post.cars.model}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                        isLiked ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <Heart size={13} fill={isLiked ? "currentColor" : "none"} />
                      {post.likes_count}
                    </button>
                    <button
                      onClick={() => togglePost(post.id)}
                      className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                    >
                      <MessageSquare size={13} />
                      {post.replies_count} {post.replies_count === 1 ? "reply" : "replies"}
                    </button>
                    <div className="ml-auto">
                      <button
                        onClick={() => togglePost(post.id)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 space-y-3 animate-in-fast">
                    {loadingReplies === post.id ? (
                      <div className="py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" style={{ animation: `typing-dot 1.2s ease ${i * 0.15}s infinite` }} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      postReplies.map((r) => (
                        <div key={r.id} className="flex gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                            <span className="text-[9px] font-bold text-[var(--color-text-secondary)]">
                              {r.profiles.username[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-[12px] px-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold">@{r.profiles.username}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">{formatRelativeDate(r.created_at)}</span>
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{r.content}</p>
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
                        className="flex-1 h-9 rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs px-3 outline-none focus:border-[var(--color-accent)] placeholder-[var(--color-text-muted)]"
                      />
                      <button
                        onClick={() => submitReply(post.id)}
                        disabled={!replyText[post.id]?.trim() || submittingReply === post.id}
                        className="w-9 h-9 rounded-[10px] bg-[var(--color-accent)] flex items-center justify-center disabled:opacity-40 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                        aria-label="Send reply"
                      >
                        <Send size={13} className="text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
