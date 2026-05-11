import { supabase } from "./supabase";

const USERNAME_DOMAIN = "@flagspill.local";

export type Profile = {
  id: string;
  username: string;
  karma: number;
  created_at: string;
};

export async function signUp(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const cleaned = username.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
    return {
      ok: false,
      error: "Username must be 3-20 chars (letters, numbers, underscore).",
    };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  // Check if username already taken
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", cleaned)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Username taken." };
  }

  const email = cleaned + USERNAME_DOMAIN;
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Signup failed." };

  // Create profile row
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    username: cleaned,
  });

  if (profileError) {
    return { ok: false, error: "Couldn't create profile: " + profileError.message };
  }

  return { ok: true };
}

export async function signIn(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const cleaned = username.trim().toLowerCase();
  const email = cleaned + USERNAME_DOMAIN;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Wrong username or password." };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) || null;
}
