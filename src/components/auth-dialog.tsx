"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import type { AuthUser } from "@/lib/types";

type AuthDialogProps = { open: boolean; user: AuthUser | null; onClose: () => void; onAuth: (user: AuthUser | null) => void };

export function AuthDialog({ open, user, onClose, onAuth }: AuthDialogProps) {
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = { email: String(formData.get("email")), password: String(formData.get("password")) };
    if (register) body.name = String(formData.get("name"));
    try {
      const response = await fetch(register ? "/api/auth/register" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Authentication failed.");
      onAuth(data.user); onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    onAuth(null); onClose();
  }

  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div role="dialog" aria-modal="true" aria-labelledby="auth-title" initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .18 }} className="w-full max-w-[390px] rounded-xl bg-paper p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-leaf">PPSU Campus 3D</p><h2 id="auth-title" className="mt-1 font-display text-2xl font-semibold">{user ? `Hello, ${user.name}` : register ? "Create your account" : "Welcome back"}</h2></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label="Close sign-in"><X size={16} /></button></div>
      {user ? <div className="mt-5"><p className="text-sm text-ink/60">Signed in as {user.email}</p><button onClick={() => void signOut()} className="mt-5 h-10 w-full rounded-lg border border-ink/15 text-sm font-semibold hover:bg-ink/5">Sign out</button></div> : <form className="mt-5 space-y-3" onSubmit={submit}>
        {register && <label className="block text-xs font-medium">Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" className="mt-1.5 h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-leaf" /></label>}
        <label className="block text-xs font-medium">Email<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-1.5 h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-leaf" /></label>
        <label className="block text-xs font-medium">Password<span className="relative mt-1.5 block"><input name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 pr-10 text-sm outline-none focus:border-leaf" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-2 grid h-6 w-6 place-items-center text-ink/45" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>
        {error && <p role="alert" className="rounded-md bg-coral/10 px-3 py-2 text-xs leading-5 text-[#9b4939]">{error}</p>}
        <button disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-sm font-semibold text-white hover:bg-[#24573f] disabled:opacity-60">{busy && <LoaderCircle size={15} className="animate-spin" />}{register ? "Create account" : "Sign in"}</button>
        <p className="text-center text-xs text-ink/55">{register ? "Already registered?" : "New to PPSU Campus 3D?"} <button type="button" onClick={() => { setRegister((value) => !value); setError(""); }} className="font-semibold text-leaf">{register ? "Sign in" : "Create account"}</button></p>
      </form>}
    </motion.div>
  </motion.div>}</AnimatePresence>;
}