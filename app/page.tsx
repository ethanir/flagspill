"use client";

import { useState } from "react";

const MOCK_POSTS = [
  { id: "1", content: "He texts back instantly but never plans actual dates", red_votes: 247, green_votes: 12, created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), comment_count: 34 },
  { id: "2", content: "She still has photos with her ex on Instagram from 3 years ago", red_votes: 89, green_votes: 96, created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), comment_count: 21 },
  { id: "3", content: "Brings their mom up in conversation every 5 minutes", red_votes: 412, green_votes: 88, created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), comment_count: 67 },
  { id: "4", content: "Asks for the wifi password before saying hello", red_votes: 178, green_votes: 45, created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), comment_count: 12 },
  { id: "5", content: "Splits the bill down to the penny on a first date with a calculator and a spreadsheet to track who owes what", red_votes: 523, green_votes: 401, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), comment_count: 89 },
  { id: "6", content: "Has a 'guys trip' to Vegas every 3 months", red_votes: 78, green_votes: 82, created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), comment_count: 45 },
  { id: "7", content: "Won't post you on social media", red_votes: 334, green_votes: 67, created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), comment_count: 102 },
  { id: "8", content: "Owns 14 cats", red_votes: 12, green_votes: 11, created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), comment_count: 8 },
  { id: "9", content: "Calls their ex 'crazy' within the first hour of meeting and goes on a 20 minute rant about her", red_votes: 891, green_votes: 23, created_at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(), comment_count: 156 },
  { id: "10", content: "Doesn't tip", red_votes: 445, green_votes: 78, created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), comment_count: 32 },
  { id: "11", content: "Still lives with mom at 35", red_votes: 234, green_votes: 245, created_at: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(), comment_count: 87 },
  { id: "12", content: "Always pays in cash and refuses to use Venmo or any digital payment app because they don't trust technology", red_votes: 167, green_votes: 198, created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), comment_count: 41 },
  { id: "13", content: "Vapes indoors", red_votes: 312, green_votes: 89, created_at: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(), comment_count: 22 },
  { id: "14", content: "Has a framed photo of themselves above their bed", red_votes: 567, green_votes: 34, created_at: new Date(Date.now() - 1000 * 60 * 60 * 110).toISOString(), comment_count: 78 },
  { id: "15", content: "Talks to their pet in a baby voice 24/7 even in public around other adults", red_votes: 123, green_votes: 287, created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), comment_count: 19 },
  { id: "16", content: "Snores like a freight train", red_votes: 88, green_votes: 92, created_at: new Date(Date.now() - 1000 * 60 * 60 * 130).toISOString(), comment_count: 15 },
  { id: "17", content: "Refuses to try any new food ever", red_votes: 256, green_votes: 78, created_at: new Date(Date.now() - 1000 * 60 * 60 * 140).toISOString(), comment_count: 38 },
  { id: "18", content: "Posts gym selfies daily", red_votes: 178, green_votes: 165, created_at: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(), comment_count: 54 },
];

const TABS = ["Hot", "New", "Top Today", "Top Week", "All Time"];

function isYellowFlag(red: number, green: number) {
  const total = red + green;
  if (total < 5) return false;
  const redPct = red / total;
  return redPct >= 0.4 && redPct <= 0.6;
}

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
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
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "red" | "green" | null>>({});
  const [openPost, setOpenPost] = useState<string | null>(null);

  const handleVote = (e: React.MouseEvent, postId: string, voteType: "red" | "green") => {
    e.stopPropagation();
    const currentVote = userVotes[postId];
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const updated = { ...post };
        if (currentVote === "red") updated.red_votes -= 1;
        if (currentVote === "green") updated.green_votes -= 1;
        if (currentVote !== voteType) {
          if (voteType === "red") updated.red_votes += 1;
          else updated.green_votes += 1;
        }
        return updated;
      })
    );
    setUserVotes((prev) => ({ ...prev, [postId]: currentVote === voteType ? null : voteType }));
  };

  const handleYellowClick = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setOpenPost(postId);
  };

  const handleSubmit = () => {
    if (!newPost.trim()) return;
    const post = {
      id: crypto.randomUUID(),
      content: newPost.trim(),
      red_votes: 0,
      green_votes: 0,
      created_at: new Date().toISOString(),
      comment_count: 0,
    };
    setPosts([post, ...posts]);
    setNewPost("");
    setShowModal(false);
  };

  const activePost = posts.find((p) => p.id === openPost);

  return (
    <main className="min-h-screen bg-[#E8D5B7]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#E8D5B7]/95 backdrop-blur-md border-b border-amber-300/40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-3xl font-black text-stone-800 mb-3 tracking-tight flex items-center gap-2">
            <RedFlag size={28} /> redflagged
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

      {/* Masonry feed - CSS columns so boxes hug their content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6 pb-32">
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
          {posts.map((post) => {
            const userVote = userVotes[post.id];
            const yellow = isYellowFlag(post.red_votes, post.green_votes);

            return (
              <div
                key={post.id}
                onClick={() => setOpenPost(post.id)}
                className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] mb-4 break-inside-avoid inline-block w-full"
              >
                <div className="flex justify-between items-center mb-2 text-xs text-stone-400">
                  <span>anonymous · {timeAgo(post.created_at)}</span>
                  <span className="flex items-center gap-1">💬 {post.comment_count}</span>
                </div>

                <p className="text-stone-800 text-[15px] leading-snug mb-3 font-medium">
                  {post.content}
                </p>

                <div className="flex items-center gap-1.5">
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
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-300 shadow-md shadow-yellow-400/60 animate-pulse hover:animate-none hover:scale-110 transition-transform"
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
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 bg-stone-800 hover:bg-stone-900 text-white rounded-full px-5 py-3 font-bold shadow-2xl hover:scale-105 transition-all flex items-center gap-2 z-30"
      >
        <span className="text-lg">+</span>
        <span className="text-sm">Add Flag</span>
      </button>

      {/* Comments modal */}
      {activePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-end sm:items-center justify-center p-4" onClick={() => setOpenPost(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 text-xs text-stone-400">
              <span>anonymous · {timeAgo(activePost.created_at)}</span>
              <button onClick={() => setOpenPost(null)} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
            </div>
            <p className="text-stone-800 text-lg leading-relaxed mb-4">{activePost.content}</p>
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
              <h3 className="font-bold text-stone-800 mb-3">Comments ({activePost.comment_count})</h3>
              <div className="space-y-3 mb-4">
                <div className="bg-stone-50 rounded-2xl p-3 text-sm">
                  <div className="text-xs text-stone-400 mb-1">anonymous · 1h</div>
                  <div className="text-stone-700">comments will go here once wired up to db</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Add a comment..." className="flex-1 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300 text-sm" />
                <button className="px-4 py-2 rounded-full bg-stone-800 text-white text-sm font-semibold hover:bg-stone-900">Post</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New post modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-stone-800 mb-4">What's the red flag?</h2>
            <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Spill it..." className="w-full h-32 p-4 rounded-2xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none text-stone-800" maxLength={280} autoFocus />
            <div className="flex justify-between items-center mt-2 mb-4">
              <span className="text-xs text-stone-400">{newPost.length}/280 · posted anonymously</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-full font-semibold text-stone-600 hover:bg-stone-100 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={!newPost.trim()} className="flex-1 py-3 rounded-full font-semibold bg-stone-800 text-white hover:bg-stone-900 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors">Post</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
