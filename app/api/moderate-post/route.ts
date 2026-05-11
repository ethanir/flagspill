import { NextRequest, NextResponse } from "next/server";

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️  OPENAI_API_KEY not set. AI moderation WILL NOT RUN — posts will only be hard-rule filtered. " +
      "Get a key at https://platform.openai.com and add to .env.local."
  );
}

// ===== LAYER 1: Hard rule checks =====
function passesHardRules(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();

  if (trimmed.length < 3) {
    return { ok: false, reason: "Too short. Add a few more characters." };
  }
  if (trimmed.length > 280) {
    return { ok: false, reason: "Too long. Keep it under 280 chars." };
  }

  if (trimmed.length >= 10) {
    const charCounts: Record<string, number> = {};
    for (const c of trimmed.toLowerCase()) {
      if (c !== " ") charCounts[c] = (charCounts[c] || 0) + 1;
    }
    const maxCharCount = Math.max(...Object.values(charCounts));
    if (maxCharCount / trimmed.length > 0.4) {
      return { ok: false, reason: "Looks like spam." };
    }
  } else {
    const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, ""));
    if (uniqueChars.size === 1) {
      return { ok: false, reason: "Looks like spam." };
    }
  }

  if (trimmed.length >= 5 && !/[aeiouyAEIOUY]/.test(trimmed)) {
    return { ok: false, reason: "Doesn't look like real text." };
  }

  if (trimmed.length >= 12) {
    const lower = trimmed.toLowerCase().replace(/\s/g, "");
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i < lower.length - len * 3; i++) {
        const chunk = lower.slice(i, i + len);
        if (lower.slice(i, i + len * 3) === chunk.repeat(3)) {
          return { ok: false, reason: "Looks like keyboard mashing." };
        }
      }
    }
  }

  const urlOrDomainPattern =
    /\b(?:https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(?:com|org|net|io|co|app|gg|me|tv|us|biz|info|live|shop|store|xyz|club|online|site|tech|fans|link|ly|to|cc|sh|ai|dev)\b)/i;
  if (urlOrDomainPattern.test(trimmed)) {
    return { ok: false, reason: "No links allowed." };
  }

  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(trimmed)) {
    return { ok: false, reason: "No phone numbers." };
  }

  if (/\S+@\S+\.\S+/.test(trimmed)) {
    return { ok: false, reason: "No email addresses." };
  }

  const socialHandlePattern =
    /\b(my\s+(?:snap|snapchat|insta|instagram|ig|tiktok|tt|discord|tg|telegram|kik|cashapp|venmo|paypal|onlyfans|of|twitter|x)\s+(?:is|:)|(?:dm|hmu|hit me up|message me)\s+(?:on|at|@))\b/i;
  if (socialHandlePattern.test(trimmed)) {
    return { ok: false, reason: "Don't share contact info." };
  }

  if (trimmed.length > 20 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { ok: false, reason: "Don't yell." };
  }

  return { ok: true };
}

// ===== LAYER 2: GPT-4o-mini =====
async function checkAIModeration(text: string): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: true };

  const systemPrompt = `You moderate user submissions on Flagspill, an anonymous site where users post "red flags" (negative traits/behaviors) OR "green flags" (positive traits/behaviors) they noticed in OTHER PEOPLE — dates, friends, family, coworkers, classmates. Audience is teens and young adults.

Both POSITIVE and NEGATIVE observations are valid flags. A green flag like "great listener" is just as valid as a red flag like "won't commit."

Classify each submission as VALID or INVALID.

VALID examples (accept all of these):
- One-word traits (positive or negative): "tall", "short", "broke", "rich", "vapes", "snores", "balding", "packing", "clingy", "loyal", "patient"
- Short phrases (positive or negative): "always late", "won't commit", "loves his mom", "great listener", "bad tipper", "mama's boy", "daddy issues", "no friends", "loud chewer"
- Behavioral observations: "Brings his mom up in every conversation", "Doesn't tip waitstaff", "Calls his mom every Sunday", "Has a close relationship with his sister", "Cooks for his roommates"
- Slang/Gen Z language: "no rizz", "delulu", "gives me the ick", "pickme energy", "main character syndrome", "lowkey controlling", "fr fr lying", "ngl boring"
- Any context — work, family, friends, dating, classmates
- Casual, sarcastic, emoji-using tone is fine

INVALID — reject ONLY for these reasons:
- Gibberish/keyboard mash: "asdfghjkl", "qwertyuiop", "blarg flarp", made-up nonsense words
- Test placeholders: "test", "testing 123", "hello world", "this is a test"
- Meta about the site: "this app is cool", "how do I delete", "first post", "is this thing on"
- Off-topic (not about another person's behavior or trait): "I love pizza", "anyone watching the game", "what's the weather"
- Public figures named: any politician, celebrity, athlete, or billionaire mentioned by name ("Donald Trump...", "Taylor Swift...", "Elon Musk...")
- Doxxing private people: full names combined with addresses, employers, or schools
- Promotional/scams: "buy my course", "make money fast", "OnlyFans", "crypto giveaway"
- Hate speech: slurs, "all [group] are [negative]", dehumanizing language
- Self-harm or crisis content: "I want to kill myself", "should I end it"
- Threats of violence: "I'm going to hurt them"
- Sexual/explicit content: "Hot girls DM me", graphic anatomy

If unsure whether something is a valid flag, lean toward ACCEPTING it. Only reject if it clearly fits an invalid category above.

For self-harm content, set reason to "Please text 988 — help is available."
For all other rejections, give a brief user-facing explanation (under 8 words).

Respond with ONLY a JSON object, nothing else:
{"valid": true}
{"valid": false, "reason": "<your explanation>"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 60,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI chat completion error:", res.status, errText);
      return { ok: true };
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
    console.error("AI moderation failed:", e);
    return { ok: true };
  }
}

// ===== LAYER 3: Rate limiting =====
const ipPostCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { ok: boolean; reason?: string } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const entry = ipPostCounts.get(ip);

  if (!entry || entry.resetAt < now) {
    ipPostCounts.set(ip, { count: 1, resetAt: now + oneHour });
    return { ok: true };
  }
  if (entry.count >= 20) {
    return { ok: false, reason: "You're posting too fast. Slow down." };
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

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.ok) {
      return NextResponse.json({ ok: false, reason: rateCheck.reason });
    }

    const hardCheck = passesHardRules(text);
    if (!hardCheck.ok) {
      return NextResponse.json({ ok: false, reason: hardCheck.reason });
    }

    const aiCheck = await checkAIModeration(text);
    if (!aiCheck.ok) {
      return NextResponse.json({ ok: false, reason: aiCheck.reason });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Moderation route error:", e);
    return NextResponse.json({ ok: false, reason: "Something went wrong. Try again." }, { status: 500 });
  }
}