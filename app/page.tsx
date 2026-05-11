"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  content: string;
  red_votes: number;
  green_votes: number;
  created_at: string;
  comment_count?: number;
};

type Comment = {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
};

const TABS = ["Hot", "New", "Top Today", "Top Week", "All Time"];

const wrapStyle: React.CSSProperties = {
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

function isYellowFlag(red: number, green: number) {
  const total = red + green;
  if (total < 5) return false;
  const redPct = red / total;
  return redPct >= 0.4 && redPct <= 0.6;
}

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function YellowFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3 L5 22" stroke="#78350f" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4 L18 4 L15 8 L18 12 L5 12 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function RedFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3 L5 22" stroke="#7f1d1d" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4 L18 4 L15 8 L18 12 L5 12 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function GreenFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3 L5 22" stroke="#14532d" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4 L18 4 L15 8 L18 12 L5 12 Z" fill="#10b981" stroke="#065f46" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Hot");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "red" | "green" | null>>({});
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    fetchPosts();
    const stored = localStorage.getItem("flagspill_votes");
    if (stored) {
      try {
        setUserVotes(JSON.parse(stored));
      } catch {}
    }
  }, [activeTab]);

  useEffect(() => {
    if (openPost) {
      fetchComments(openPost);
    } else {
      setComments([]);
    }
  }, [openPost]);

  async function fetchPosts() {
    setLoading(true);
    let query = supabase.from("posts").select("*");

    if (activeTab === "New") {
      query = query.order("created_at", { ascending: false });
    } else if (activeTab === "Top Today") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", oneDayAgo).order("red_votes", { ascending: false });
    } else if (activeTab === "Top Week") {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", oneWeekAgo).order("red_votes", { ascending: false });
    } else if (activeTab === "All Time") {
      query = query.order("red_votes", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error("Error fetching posts:", error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const postIds = data.map((p) => p.id);
      const { data: commentData } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      const counts: Record<string, number> = {};
      commentData?.forEach((c) => {
        counts[c.post_id] = (counts[c.post_id] || 0) + 1;
      });

      const postsWithCounts = data.map((p) => ({
        ...p,
        comment_count: counts[p.id] || 0,
      }));

      setPosts(postsWithCounts);
    } else {
      setPosts([]);
    }

    setLoading(false);
  }

  async function fetchComments(postId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    setComments(data || []);
  }

  async function handleVote(e: React.MouseEvent, postId: string, voteType: "red" | "green") {
    e.stopPropagation();
    const currentVote = userVotes[postId];
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    let newRed = post.red_votes;
    let newGreen = post.green_votes;
    if (currentVote === "red") newRed -= 1;
    if (currentVote === "green") newGreen -= 1;
    if (currentVote !== voteType) {
      if (voteType === "red") newRed += 1;
      else newGreen += 1;
    }

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, red_votes: newRed, green_votes: newGreen } : p))
    );

    const newVotes = { ...userVotes, [postId]: currentVote === voteType ? null : voteType };
    setUserVotes(newVotes);
    localStorage.setItem("flagspill_votes", JSON.stringify(newVotes));

    const { error } = await supabase
      .from("posts")
      .update({ red_votes: newRed, green_votes: newGreen })
      .eq("id", postId);

    if (error) {
      console.error("Error updating vote:", error);
      fetchPosts();
    }
  }

  function handleYellowClick(e: React.MouseEvent, postId: string) {
    e.stopPropagation();
    setOpenPost(postId);
  }

  async function handleSubmit() {
    if (!newPost.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      // Run moderation check first
      const modResponse = await fetch("/api/moderate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPost.trim() }),
      });

      const modResult = await modResponse.json();

      if (!modResult.ok) {
        setSubmitError(modResult.reason || "Couldn't post that.");
        setSubmitting(false);
        return;
      }

      // Moderation passed - save to db
      const { data, error } = await supabase
        .from("posts")
        .insert([{ content: newPost.trim() }])
        .select()
        .single();

      if (error) {
        console.error("Error creating post:", error);
        setSubmitError("Couldn't save. Try again.");
        setSubmitting(false);
        return;
      }

      if (data) {
        setPosts([{ ...data, comment_count: 0 }, ...posts]);
      }

      setNewPost("");
      setShowModal(false);
    } catch (e) {
      console.error("Submit error:", e);
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentSubmit() {
    if (!newComment.trim() || !openPost) return;

    // Also moderate comments
    const modResponse = await fetch("/api/moderate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newComment.trim() }),
    });

    const modResult = await modResponse.json();
    if (!modResult.ok) {
      alert(modResult.reason || "Couldn't post that comment.");
      return;
    }

    const { data, error } = await supabase
      .from("comments")
      .insert([{ post_id: openPost, content: newComment.trim() }])
      .select()
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      return;
    }

    if (data) {
      setComments([data, ...comments]);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === openPost ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
        )
      );
    }

    setNewComment("");
  }

  const activePost = posts.find((p) => p.id === openPost);

  return (
    <main className="min-h-screen bg-[#E8D5B7]">
      <div className="sticky top-0 z-10 bg-[#E8D5B7]/95 backdrop-blur-md border-b border-amber-300/40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-3xl font-black text-stone-800 mb-3 tracking-tight flex items-center gap-2">
            <RedFlag size={28} /> flagspill
          </h1>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab ? "bg-stone-800 text-white shadow-md" : "bg-white/70 text-stone-600 hover:bg-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 pb-32">
        {loading ? (
          <div className="text-center text-stone-500 py-12">Loading flags...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-stone-500 py-12">
            <p className="text-lg mb-2">No flags yet</p>
            <p className="text-sm">Be the first to spill one</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
            {posts.map((post) => {
              const userVote = userVotes[post.id];
              const yellow = isYellowFlag(post.red_votes, post.green_votes);

              return (
                <div
                  key={post.id}
                  onClick={() => setOpenPost(post.id)}
                  style={{ overflow: "hidden", maxWidth: "100%" }}
                  className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] mb-4 break-inside-avoid block w-full"
                >
                  <div className="flex justify-between items-center mb-2 text-xs text-stone-400">
                    <span>anonymous · {timeAgo(post.created_at)}</span>
                    <span className="flex items-center gap-1">💬 {post.comment_count || 0}</span>
                  </div>

                  <p style={wrapStyle} className="text-stone-800 text-[15px] leading-snug mb-3 font-medium">
                    {post.content}
                  </p>

                  <div className="flex justify-between items-center relative">
                    <button
                      onClick={(e) => handleVote(e, post.id, "red")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-semibold text-xs transition-all ${
                        userVote === "red" ? "bg-red-500 text-white scale-105 shadow" : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      <RedFlag size={13} />
                      <span>{post.red_votes}</span>
                    </button>

                    {yellow && (
                      <button
                        onClick={(e) => handleYellowClick(e, post.id)}
                        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-yellow-300 shadow-md shadow-yellow-400/60 animate-pulse hover:animate-none hover:scale-110 transition-transform"
                        title="Contested"
                      >
                        <YellowFlag size={14} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleVote(e, post.id, "green")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-semibold text-xs transition-all ${
                        userVote === "green" ? "bg-emerald-500 text-white scale-105 shadow" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      <span>{post.green_votes}</span>
                      <GreenFlag size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setShowModal(true);
          setSubmitError("");
        }}
        className="fixed bottom-6 right-6 bg-stone-800 hover:bg-stone-900 text-white rounded-full px-5 py-3 font-bold shadow-2xl hover:scale-105 transition-all flex items-center gap-2 z-30"
      >
        <span className="text-lg">+</span>
        <span className="text-sm">Spill a Flag</span>
      </button>

      {activePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-end sm:items-center justify-center p-4" onClick={() => setOpenPost(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 text-xs text-stone-400">
              <span>anonymous · {timeAgo(activePost.created_at)}</span>
              <button onClick={() => setOpenPost(null)} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
            </div>
            <p style={wrapStyle} className="text-stone-800 text-lg leading-relaxed mb-4">{activePost.content}</p>
            <div className="flex gap-2 mb-6 text-sm flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 font-semibold">
                <RedFlag size={14} /> {activePost.red_votes}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-semibold">
                <GreenFlag size={14} /> {activePost.green_votes}
              </span>
              {isYellowFlag(activePost.red_votes, activePost.green_votes) && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                  <YellowFlag size={14} /> contested
                </span>
              )}
            </div>
            <div className="border-t border-stone-100 pt-4">
              <h3 className="font-bold text-stone-800 mb-3">Comments ({comments.length})</h3>
              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <div className="text-stone-400 text-sm text-center py-4">No comments yet. Be the first.</div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} style={wrapStyle} className="bg-stone-50 rounded-2xl p-3 text-sm">
                      <div className="text-xs text-stone-400 mb-1">anonymous · {timeAgo(c.created_at)}</div>
                      <div className="text-stone-700">{c.content}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300 text-sm"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 rounded-full bg-stone-800 text-white text-sm font-semibold hover:bg-stone-900 disabled:bg-stone-300"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-stone-800 mb-4">Spill the flag</h2>
            <textarea
              value={newPost}
              onChange={(e) => {
                setNewPost(e.target.value);
                setSubmitError("");
              }}
              placeholder="What's the flag?"
              className="w-full h-32 p-4 rounded-2xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none text-stone-800"
              maxLength={280}
              autoFocus
            />
            <div className="flex justify-between items-center mt-2 mb-2">
              <span className="text-xs text-stone-400">{newPost.length}/280 · posted anonymously</span>
            </div>
            {submitError && (
              <div className="mb-3 p-3 rounded-2xl bg-red-50 text-red-700 text-sm">{submitError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-full font-semibold text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!newPost.trim() || submitting}
                className="flex-1 py-3 rounded-full font-semibold bg-stone-800 text-white hover:bg-stone-900 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Checking..." : "Spill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}