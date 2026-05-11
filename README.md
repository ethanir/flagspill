# flagspill

Anonymous voting board where users post behaviors and the community votes them red flag, green flag, or contested.

**Live:** [flagspill.com](https://flagspill.com)

## Overview

flagspill is a community-driven anonymous content rating platform. Users submit short observations about behaviors (typically dating-related, but open-ended), and others vote them as red flags (concerning) or green flags (admirable). When a post sits between 40–60% red votes, it's marked yellow — a contested take worth discussing.

There are no accounts, logins, or profiles. Everything is anonymous. Vote state lives in `localStorage`; rate limiting and content moderation happen server-side.

## Stack

- **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Supabase (Postgres)
- **AI:** OpenAI GPT-4o-mini for content moderation
- **Hosting:** Vercel with custom domain (SSL auto-provisioned)
- **State:** React hooks + `localStorage` for client persistence

## Features

### Visual encoding of consensus
Cards are tinted by vote majority — pink for red-flag majority, mint for green, amber for contested. Tinting activates at the first vote, so a card starts to lean visually as soon as anyone reacts.

### Adaptive typography
Post text is sized across 7 tiers based on content length. A two-word post renders huge and bold; a long paragraph renders in compact body text. This creates visual variety in the grid and makes the wall scannable.

### Content-aware grid layout
Cards use CSS flex-grow with content-derived base widths. Short cards stay narrow, long cards spread wider, and each row's right edge fills cleanly — without a JavaScript masonry library.

### Animated yellow flag
Contested posts display a small SVG flag waving between the vote buttons. The sway is a 3-second CSS keyframe rotation pinned to the flagpole's base, made non-interactive (`pointer-events: none`) so it reads as decoration rather than a button.

### Light / dark mode
Toggle in the header, persisted to `localStorage`. Cards stay light in both modes — pastels glow against the dark stone background like sticky notes pinned to a board.

### Optimistic UI
Vote counts update instantly on click, before the Supabase write resolves. If the write fails, the UI re-fetches and self-corrects. Without this, every vote would have a 200ms+ delay and feel sluggish.

## Content moderation system

The most engineering-dense part of the project. New posts and comments pass through three layers before being saved.

### Layer 1 — Hard rules (no AI)
Fast deterministic checks reject obvious junk before any API call:
- URLs and bare domains (regex against common TLDs)
- Phone numbers, email addresses, social handles
- All-caps spam (>60% uppercase letters)
- Character repetition (`aaaaaaaaa`)
- Gibberish (no vowels, all-consonant strings)
- Length bounds (3–280 chars)

This catches roughly 20% of bad inputs at near-zero cost.

### Layer 2 — GPT-4o-mini classification
Surviving posts go to OpenAI with a strict system prompt covering two concerns:
- **Safety:** hate speech, sexual content, self-harm, threats
- **Coherence:** gibberish, off-topic, public-figure mentions, doxxing, promotional content, meta/test strings

The model returns structured JSON: `{ok: boolean, reason?: string}`. Failures surface a short user-facing message ("That looks like spam — try rewording it"). The endpoint fails open if the API key is missing, with an 8-second timeout to bound latency.

Cost: roughly $0.0001 per submission — about $1 per 10,000 posts.

### Layer 3 — Rate limiting
20 posts per IP per hour, tracked in an in-memory `Map`. Resets on server restart, acceptable for v1. Production scale would move this to Redis.

### Test suite + iteration
I built a 128-case test harness covering 23 categories: valid short posts, dating reds, dating greens, Gen Z slang, gibberish, spam patterns, URL injection, contact-info leakage, all-caps, doxxing attempts, hate speech, sexual content, self-harm, threats, and more. The harness spoofs `x-forwarded-for` to bypass rate limits during testing.

Four architectures were tested to reach 100% pass rate:

| Version | Architecture | Pass rate |
|---------|--------------|-----------|
| v1 | Hard rules + OpenAI Moderation + Groq Llama 3.1 8B | 72.7% |
| v2 | Stricter Groq prompt | 72.7% |
| v3 | Single GPT-4o-mini call | 96.9% |
| v4 | Fixed placeholder bug, expanded green-flag + slang examples | **100%** |

The Groq layer was dropped entirely once GPT-4o-mini proved capable enough alone — a useful reminder that one good model beats two mediocre ones in a stacked pipeline. The 4o-mini prompt also pulls double duty as both a safety classifier and a coherence/relevance filter, which removed the need for a separate "is this even a real post" step.

The test file is in `test-moderation.mjs` and gitignored from the public repo (it contains prompt-injection strings that shouldn't be indexed).

## Architecture decisions

**Why no accounts.** Account systems are friction. The target audience (young people, TikTok-driven) bounces hard from signup walls. Anonymity also fits the format. Trade-off: harder to prevent vote manipulation and harassment, which is why moderation matters more.

**Why `localStorage` for votes.** Server-side vote tracking without accounts requires either IP-based identity (fragile, breaks on shared networks) or browser fingerprinting (creepy). `localStorage` trusts the user, which is good enough for a casual social product. Worst case: a determined user clears storage and double-votes. Acceptable for v1.

**Why optimistic UI.** Without it, every vote round-trips ~200ms to Supabase. With it, votes feel instant. The reconciliation logic on write-failure is small and worth the perceived performance.

**Why Next.js App Router.** Lets me colocate the moderation API route with the page, and the React server-component model keeps the client bundle smaller. For a project this size, the modern routing API is fine.

**Why amber/cream defaults.** Most anonymous social apps default to white or black. Cream is distinctive, warm, and pairs visually with the red/green/yellow voting system. The dark mode uses `stone-900` (a warm dark) rather than pure black to preserve the same family.

## Local development

```bash
git clone https://github.com/ethanir/flagspill.git
cd flagspill
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
```

Run:

```bash
npm run dev
```

The Supabase schema requires two tables: `posts` (id, content, red_votes, green_votes, created_at) and `comments` (id, post_id, content, created_at), both with permissive RLS policies for the anon role.

## Roadmap

- True "Hot" ranking weighted by vote velocity (currently `Hot` and `New` use the same query)
- Share-as-image button — render a card as a PNG for TikTok / Instagram virality
- Categories (dating, work, family, friends) so subcommunities can find their content
- Soft-delete / shadow-ban via an `approved` boolean for moderation appeals
- Migrate in-memory rate limiter to Redis for multi-instance deployments

## Author

Built by [Ethan Irimia](https://github.com/ethanir) — CS, University of Illinois at Chicago.
