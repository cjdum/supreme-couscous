"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Globe, Flame, MessageSquare, GalleryHorizontal,
  Heart, ArrowUp, Trophy, Send, Plus, ChevronDown, Loader2,
} from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { TradingCard } from "@/components/garage/trading-card";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";

type Tab = "builds" | "cards" | "discussion";

/* ─── Builds types ─────────────────────────────────────────── */
interface Build {
  id: string; make: string; model: string; year: number;
  trim: string | null; nickname: string | null;
  cover_image_url: string | null; created_at: string;
  profiles: { username: string };
  mods: { count: number }[];
  likes: { count: number }[];
}

/* ─── Card-feed types ──────────────────────────────────────── */
interface FeedCard {
  id: string; pixel_card_url: string; card_title: string | null;
  nickname: string; era: string | null; hp: number | null;
  mod_count: number | null; flavor_text: string | null;
  occasion: string | null; minted_at: string;
  car_snapshot: {
    year: number; make: string; model: string;
    build_score: number | null; vin_verified: boolean;
    mods: string[]; torque: number | null; zero_to_sixty: number | null;
    total_invested: number | null;
    mods_detail?: { name: string; cost: number | null; category: string }[];
  };
  card_number: number | null; username: string | null;
}

/* ─── Forum types ──────────────────────────────────────────── */
interface Post {
  id: string; title: string; content: string; category: string;
  likes_count: number; replies_count: number; created_at: string;
  profiles: { username: string };
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "builds",     label: "Builds",     icon: Globe },
  { id: "cards",      label: "Cards",      icon: GalleryHorizontal },
  { id: "discussion", label: "Discussion", icon: MessageSquare },
];

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>("builds");

  /* ─── Builds state ─────────── */
  const [builds,       setBuilds]       = useState<Build[]>([]);
  const [buildsLoading,setBuildsLoading] = useState(false);
  const [buildSort,    setBuildSort]    = useState<"recent" | "top">("recent");

  /* ─── Card-feed state ──────── */
  const [feedCards,    setFeedCards]    = useState<FeedCard[]>([]);
  const [feedLoading,  setFeedLoading]  = useState(false);

  /* ─── Forum state ──────────── */
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [newPost,      setNewPost]      = useState(false);
  const [postTitle,    setPostTitle]    = useState("");
  const [postBody,     setPostBody]     = useState("");
  const [posting,      setPosting]      = useState(false);

  /* ─── Load builds ──────────── */
  const loadBuilds = useCallback(async (sort: "recent" | "top") => {
    setBuildsLoading(true);
    const supabase = createClient();
    const q = supabase
      .from("cars")
      .select(`id, make, model, year, trim, nickname, cover_image_url, created_at,
               profiles!inner(username), mods(count), likes(count)`)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(40);
    const { data } = await q;
    let list = ((data ?? []) as unknown as Build[]);
    if (sort === "top") {
      list = [...list]
        .sort((a, b) =>
          ((b.likes?.[0]?.count ?? 0) - (a.likes?.[0]?.count ?? 0)) ||
          ((b.mods?.[0]?.count ?? 0) - (a.mods?.[0]?.count ?? 0))
        )
        .slice(0, 20);
    }
    setBuilds(list);
    setBuildsLoading(false);
  }, []);

  /* ─── Load card feed ───────── */
  const loadFeed = useCallback(async () => {
    if (feedCards.length) return; // already loaded
    setFeedLoading(true);
    try {
      const r = await fetch("/api/feed?tab=new");
      const j = await r.json();
      setFeedCards(j.cards ?? []);
    } finally {
      setFeedLoading(false);
    }
  }, [feedCards.length]);

  /* ─── Load posts ───────────── */
  const loadPosts = useCallback(async () => {
    if (posts.length) return;
    setPostsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("forum_posts")
      .select("id, title, content, category, likes_count, replies_count, created_at, profiles(username)")
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts(((data ?? []) as unknown as Post[]));
    setPostsLoading(false);
  }, [posts.length]);

  /* ─── Trigger loads on tab change ── */
  useEffect(() => {
    if (tab === "builds")     loadBuilds(buildSort);
    if (tab === "cards")      loadFeed();
    if (tab === "discussion") loadPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "builds") loadBuilds(buildSort);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildSort]);

  /* ─── Submit post ──────────── */
  async function handlePost() {
    if (!postTitle.trim()) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    await supabase.from("forum_posts").insert({
      title: postTitle.trim(),
      content: postBody.trim(),
      category: "general",
      user_id: user.id,
    });
    setNewPost(false);
    setPostTitle(""); setPostBody("");
    setPosts([]); // force reload
    loadPosts();
    setPosting(false);
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="4xl" className="pt-8 pb-20">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-7">
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={20} style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Community</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Builds, cards, and conversation</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-7 p-1 rounded-2xl w-fit"
          style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={{
                background: tab === id ? "var(--color-accent)" : "transparent",
                color: tab === id ? "#fff" : "var(--color-text-muted)",
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ═══ BUILDS tab ═══════════════════════════════════════════════ */}
        {tab === "builds" && (
          <>
            {/* Sort pills */}
            <div className="flex gap-2 mb-5">
              {(["recent", "top"] as const).map((s) => (
                <button key={s} onClick={() => setBuildSort(s)}
                  className="h-8 px-3 rounded-xl text-[11px] font-bold transition-all cursor-pointer capitalize"
                  style={{
                    background: buildSort === s ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    border: `1px solid ${buildSort === s ? "transparent" : "var(--color-border)"}`,
                    color: buildSort === s ? "#fff" : "var(--color-text-muted)",
                  }}>
                  {s === "recent" ? <><Globe size={10} style={{ display: "inline", marginRight: 4 }} />Recent</> : <><Trophy size={10} style={{ display: "inline", marginRight: 4 }} />Top</>}
                </button>
              ))}
            </div>

            {buildsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ height: 220, borderRadius: 18, background: "var(--color-bg-card)", border: "1px solid var(--color-border)", opacity: 0.5 }} />
                ))}
              </div>
            ) : builds.length === 0 ? (
              <div className="text-center py-16">
                <Globe size={30} style={{ margin: "0 auto 12px", color: "var(--color-text-muted)", opacity: 0.3 }} />
                <p className="text-sm text-[var(--color-text-muted)]">No public builds yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {builds.map((build) => {
                  const likeCount = build.likes?.[0]?.count ?? 0;
                  const modCount  = build.mods?.[0]?.count ?? 0;
                  return (
                    <Link key={build.id} href={`/community/${build.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        borderRadius: 18, overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-bg-card)",
                      }}>
                        <div style={{ aspectRatio: "16/9", position: "relative" }}>
                          {build.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={build.cover_image_url}
                              alt={`${build.year} ${build.make} ${build.model}`}
                              loading="lazy"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{
                              width: "100%", height: "100%",
                              background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, #09090b 100%)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <svg viewBox="0 0 120 54" width="80" height="36" fill="none" aria-hidden="true" style={{ opacity: 0.1 }}>
                                <path d="M12 42l9-24h78l9 24H12z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                                <ellipse cx="30" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
                                <ellipse cx="90" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
                              </svg>
                            </div>
                          )}
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
                          {likeCount > 0 && (
                            <div style={{
                              position: "absolute", top: 8, right: 8,
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "4px 8px", borderRadius: 20,
                              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                            }}>
                              <Heart size={10} style={{ color: "#ef4444" }} fill="#ef4444" />
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{likeCount}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "12px 14px" }}>
                          {build.nickname && (
                            <p style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
                              {build.nickname}
                            </p>
                          )}
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
                            {build.year} {build.make} {build.model}
                            {build.trim && <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}> {build.trim}</span>}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
                            <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                              by <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>@{build.profiles.username}</span>
                            </p>
                            <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--color-text-muted)" }}>
                              <span>{modCount} mods</span>
                              <span>·</span>
                              <span>{formatRelativeDate(build.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ CARDS tab ════════════════════════════════════════════════ */}
        {tab === "cards" && (
          <>
            {feedLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
                <Loader2 size={24} style={{ color: "var(--color-text-muted)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : feedCards.length === 0 ? (
              <div className="text-center py-16">
                <GalleryHorizontal size={30} style={{ margin: "0 auto 12px", color: "var(--color-text-muted)", opacity: 0.3 }} />
                <p className="text-sm text-[var(--color-text-muted)]">No cards minted yet</p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 28,
                justifyItems: "center",
              }}>
                {feedCards.map((card) => (
                  <div key={card.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Link href={`/c/${card.id}`} style={{ textDecoration: "none" }}>
                      <TradingCard
                        cardUrl={card.pixel_card_url}
                        nickname={card.nickname}
                        generatedAt={card.minted_at}
                        hp={card.hp}
                        modCount={card.mod_count}
                        buildScore={card.car_snapshot.build_score}
                        vinVerified={card.car_snapshot.vin_verified}
                        cardNumber={card.card_number}
                        era={card.era}
                        flavorText={card.flavor_text}
                        occasion={card.occasion}
                        mods={card.car_snapshot.mods ?? []}
                        modsDetail={card.car_snapshot.mods_detail}
                        torque={card.car_snapshot.torque ?? null}
                        zeroToSixty={card.car_snapshot.zero_to_sixty ?? null}
                        totalInvested={card.car_snapshot.total_invested ?? null}
                        carLabel={`${card.car_snapshot.year} ${card.car_snapshot.make} ${card.car_snapshot.model}`}
                        scale={0.85}
                        idle
                        interactive
                      />
                    </Link>
                    <p style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: "0.04em", textAlign: "center" }}>
                      @{card.username ?? "—"} · {card.car_snapshot.year} {card.car_snapshot.make} {card.car_snapshot.model}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ DISCUSSION tab ═══════════════════════════════════════════ */}
        {tab === "discussion" && (
          <>
            {/* New post CTA */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setNewPost(!newPost)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: newPost ? "var(--color-bg-elevated)" : "var(--color-accent)",
                  border: `1px solid ${newPost ? "var(--color-border)" : "transparent"}`,
                  color: newPost ? "var(--color-text-muted)" : "#fff",
                }}
              >
                {newPost ? <><ChevronDown size={13} />Cancel</> : <><Plus size={13} />New Post</>}
              </button>
            </div>

            {/* New post form */}
            {newPost && (
              <div style={{
                marginBottom: 20, padding: "16px 18px", borderRadius: 16,
                background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
              }}>
                <input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Post title…"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)", fontSize: 13, fontWeight: 600,
                    marginBottom: 10, outline: "none",
                  }}
                />
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="What's on your mind? (optional)"
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)", fontSize: 12, resize: "none",
                    marginBottom: 12, outline: "none",
                  }}
                />
                <button
                  onClick={handlePost}
                  disabled={posting || !postTitle.trim()}
                  className="flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 transition-all"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Post
                </button>
              </div>
            )}

            {postsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
                <Loader2 size={24} style={{ color: "var(--color-text-muted)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare size={30} style={{ margin: "0 auto 12px", color: "var(--color-text-muted)", opacity: 0.3 }} />
                <p className="text-sm text-[var(--color-text-muted)]">No posts yet — start the conversation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Link key={post.id} href={`/forum/${post.id}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        padding: "14px 16px", borderRadius: 14,
                        background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
                        cursor: "pointer", transition: "border-color 150ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-border-bright)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
                            {post.title}
                          </p>
                          {post.content && (
                            <p style={{
                              fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5,
                              overflow: "hidden", display: "-webkit-box",
                              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                            }}>
                              {post.content}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                            textTransform: "uppercase", padding: "3px 8px", borderRadius: 6,
                            background: "var(--color-bg-elevated)", color: "var(--color-text-muted)",
                          }}>
                            {post.category}
                          </span>
                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--color-text-muted)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <ArrowUp size={10} /> {post.likes_count}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <MessageSquare size={10} /> {post.replies_count}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                          @{post.profiles.username}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>·</span>
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </PageContainer>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
