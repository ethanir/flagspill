# flagspill

> Anonymous social voting platform. Post a take. Vote red flag or green flag. Watch consensus emerge.

**Live demo: [flagspill.com](https://flagspill.com)**

---

## About

flagspill is an anonymous community board where users post short takes and the crowd votes them as red flags or green flags. Posts color-tint based on vote majority — red for red-majority takes, green for green-majority, amber for contested splits in the middle.

Built solo end-to-end: schema design, authentication, AI-moderated content pipeline, frontend, and deployment.

## Stack

| Layer    | Tech                                                |
|----------|-----------------------------------------------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS   |
| Backend  | Next.js API routes, Supabase (PostgreSQL + Auth)    |
| AI       | OpenAI GPT-4o-mini                                  |
| Deploy   | Vercel with custom domain                           |

## Features

- **Anonymous-first** — read, vote, and post without an account. Optional username+password sign-up adds attribution and karma tracking.
- **Five ranked feeds** — Hot, New, Top Today, Top Week, All Time
- **Optimistic UI** — votes appear instantly and reconcile with the database in the background
- **Vote-majority color tinting** — cards show consensus at a glance
- **Adaptive typography & layout** — 7-tier font sizing and content-aware grid widths so short takes punch and long takes still read cleanly
- **Karma system** — start at 100, earn +1 for votes/comments you give and receive (Yik Yak-inspired)
- **Profile modal** — view your own or any user's posts and karma via tappable @usernames
- **Light & dark mode**

## Content moderation

Every post and comment runs through a multi-stage pipeline before it touches the database:

1. **Regex hard rules** — blocks URLs, phone numbers, emails, social handles, excessive caps
2. **Heuristic checks** — minimum length, vowel ratio, character repetition, gibberish detection (looser thresholds on comments so casual slang like "fr" and "lol" survives)
3. **GPT-4o-mini classification** — semantic check for safety, coherence, and on-topic relevance
4. **IP-based rate limiting** — separate hourly buckets for posts and comments

Refined iteratively across four versions against a 128-case evaluation set. Cost: ~$0.0001 per check.

## Database design

- **PostgreSQL on Supabase** with foreign-key relations between `profiles`, `posts`, `comments`, and `votes`
- **Row-Level Security policies** for safe public reads and scoped authenticated writes
- **`SECURITY DEFINER` functions** for cross-user operations (karma updates need to credit other users' rows, which RLS blocks by default)
- **Username-only authentication** via Supabase Auth with internal email aliasing — no email or phone required from the user

## Local development

```bash
git clone https://github.com/ethanir/flagspill.git
cd flagspill
npm install
cp .env.example .env.local   # add Supabase + OpenAI keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture decisions

- **No accounts required for read/vote/comment** — friction kills engagement on anonymous platforms; accounts are opt-in for users who want karma and a profile
- **localStorage vote tracking + optimistic UI** — instant feedback, no spinners, reconciles with DB on success
- **Server-side AI moderation** — keeps the OpenAI key off the client; moderation runs in a Next.js API route before any insert
- **Cream/amber default palette** — warmer and less generic than the standard "white card on gray" SaaS look

## Author

**Ethan Irimiciuc** — Computer Science, University of Illinois Chicago

[GitHub](https://github.com/ethanir) · [LinkedIn](https://www.linkedin.com/in/ethanirimiciuc/) · [flagspill.com](https://flagspill.com)
