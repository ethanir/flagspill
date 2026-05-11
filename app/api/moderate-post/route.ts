import { NextRequest, NextResponse } from "next/server";

// ===== LAYER 1: Hard rule checks (no API needed) =====
function passesHardRules(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();

  if (trimmed.length < 8) {
    return { ok: false, reason: "Too short. Be more specific." };
  }

  if (trimmed.length > 280) {
    return { ok: false, reason: "Too long. Keep it under 280 chars." };
  }

  // Check for repeated character spam (e.g. "aaaaaaaaaa")
  const charCounts: Record<string, number> = {};
  for (const c of trimmed.toLowerCase()) {
    if (c !== " ") charCounts[c] = (charCounts[c] || 0) + 1;
  }
  const maxCharCount = Math.max(...Object.values(charCounts));
  if (maxCharCount / trimmed.length > 0.4) {
    return { ok: false, reason: "Looks like spam. Try writing a real observation." };
  }

  // No vowels = gibberish
  if (!/[aeiouAEIOU]/.test(trimmed)) {
    return { ok: false, reason: "Doesn't look like real text." };
  }

  // Repeated 3-char patterns ("hahaha", "fewfwef")
  const lower = trimmed.toLowerCase().replace(/\s/g, "");
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i < lower.length - len * 3; i++) {
      const chunk = lower.slice(i, i + len);
      if (lower.slice(i, i + len * 3) === chunk.repeat(3)) {
        return { ok: false, reason: "Looks like keyboard mashing." };
      }
    }
  }

  // URLs
  if (/(https?:\/\/|www\.)/i.test(trimmed)) {
    return { ok: false, reason: "No links allowed." };
  }

  // Phone numbers (basic)
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(trimmed)) {
    return { ok: false, reason: "No phone numbers." };
  }

  // Emails
  if (/\S+@\S+\.\S+/.test(trimmed)) {
    return { ok: false, reason: "No email addresses." };
  }

  // ALL CAPS spam
  if (trimmed.length > 20 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { ok: false, reason: "Don't yell. Use normal capitalization." };
  }

  return { ok: true };
}

// ===== LAYER 2: OpenAI Moderation API =====
async function checkOpenAIModeration(text: string): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fail open if not configured - don't block posts
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI moderation API error:", await res.text());
      return { ok: true }; // fail open
    }

    const data = await res.json();
    const result = data.results?.[0];

    if (result?.flagged) {
      // Find what category triggered it
      const categories = result.categories || {};
      const triggered = Object.keys(categories).filter((k) => categories[k]);
      return {
        ok: false,
        reason: triggered.includes("sexual/minors")
          ? "Content not allowed."
          : triggered.includes("hate") || triggered.includes("hate/threatening")
          ? "Hate speech not allowed."
          : triggered.includes("violence") || triggered.includes("violence/graphic")
          ? "Violent content not allowed."
          : triggered.includes("self-harm") || triggered.includes("self-harm/intent")
          ? "Please reach out to a friend or a hotline if you need help."
          : triggered.includes("sexual")
          ? "Sexual content not allowed."
          : "This violates our content rules.",
      };
    }

    return { ok: true };
  } catch (e) {
    console.error("OpenAI moderation failed:", e);
    return { ok: true }; // fail open
  }
}

// ===== LAYER 3: Groq + Llama 3.1 8B for context/coherence check =====
async function checkGroqCoherence(text: string): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: true }; // fail open
  }

  const systemPrompt = `You are a content moderator for a website called Flagspill where users post "red flags" (negative behaviors) or "green flags" (positive behaviors) they've noticed in other people. The audience is teens and young adults discussing dating, friendships, family, school, and work.

Your job: decide if a submission is a VALID flag post.

VALID examples:
- "He texts back instantly but never plans actual dates"
- "Brings their mom up in conversation every 5 minutes"
- "Always remembers small details I mentioned weeks ago"
- "Doesn't tip"
- "Owns 14 cats and names them all after his exes"

INVALID examples (and why):
- "I love pizza" → not about a behavior in another person
- "Buy my course at example.com" → promotional/spam
- "John Smith at 123 Main Street is a creep" → contains personal identifying info
- "Help, I am being stalked" → cry for help, not a flag post
- "asdfghjkl" → gibberish
- "this app is so cool" → meta-commentary, not a flag

Respond ONLY with strict JSON in this exact format:
{"valid": true} or {"valid": false, "reason": "short user-facing explanation under 8 words"}

No preamble, no markdown, just the JSON.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 60,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Groq API error:", await res.text());
      return { ok: true }; // fail open
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: true };

    const parsed = JSON.parse(content);
    if (parsed.valid === false) {
      return { ok: false, reason: parsed.reason || "Doesn't look like a valid flag post." };
    }

    return { ok: true };
  } catch (e) {
    console.error("Groq moderation failed:", e);
    return { ok: true }; // fail open
  }
}

// ===== LAYER 4: Rate limiting (in-memory, resets on server restart) =====
const ipPostCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { ok: boolean; reason?: string } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const entry = ipPostCounts.get(ip);

  if (!entry || entry.resetAt < now) {
    ipPostCounts.set(ip, { count: 1, resetAt: now + oneHour });
    return { ok: true };
  }

  if (entry.count >= 3) {
    return { ok: false, reason: "You're posting too fast. Try again in an hour." };
  }

  entry.count += 1;
  return { ok: true };
}

// ===== MAIN HANDLER =====
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ ok: false, reason: "No text provided." }, { status: 400 });
    }

    // Get IP for rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Layer 4: Rate limit first (fastest, no cost)
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.ok) {
      return NextResponse.json({ ok: false, reason: rateCheck.reason });
    }

    // Layer 1: Hard rules (instant)
    const hardCheck = passesHardRules(text);
    if (!hardCheck.ok) {
      return NextResponse.json({ ok: false, reason: hardCheck.reason });
    }

    // Layers 2 + 3: Run AI checks in parallel for speed
    const [openaiResult, groqResult] = await Promise.all([
      checkOpenAIModeration(text),
      checkGroqCoherence(text),
    ]);

    if (!openaiResult.ok) {
      return NextResponse.json({ ok: false, reason: openaiResult.reason });
    }

    if (!groqResult.ok) {
      return NextResponse.json({ ok: false, reason: groqResult.reason });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Moderation route error:", e);
    return NextResponse.json({ ok: false, reason: "Something went wrong. Try again." }, { status: 500 });
  }
}