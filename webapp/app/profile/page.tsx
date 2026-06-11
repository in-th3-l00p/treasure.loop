"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  UserRoundIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { isValidHandle, normalizeHandle } from "@/lib/handle"

interface ProfileShape {
  wallet: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
}

type LoadState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | { kind: "ready"; profile: ProfileShape | null }

export default function ProfileEditorPage() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" })

  // Form fields.
  const [handle, setHandle] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  const [savedHandle, setSavedHandle] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/play/profile", {
          headers: { accept: "application/json" },
        })
        if (!active) return
        if (res.status === 401) {
          setLoad({ kind: "signed-out" })
          return
        }
        if (!res.ok) {
          setLoad({ kind: "error", message: "Couldn't load your profile." })
          return
        }
        const data = (await res.json()) as { profile: ProfileShape | null }
        const p = data.profile
        if (p) {
          setHandle(p.handle ?? "")
          setDisplayName(p.displayName ?? "")
          setBio(p.bio ?? "")
          setAvatarUrl(p.avatarUrl ?? "")
          setSavedHandle(p.handle)
        }
        setLoad({ kind: "ready", profile: p })
      } catch {
        if (active) setLoad({ kind: "error", message: "Network error." })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleHint = handleValidity(handle)

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFeedback(null)
      if (handle.trim() !== "" && !isValidHandle(handle)) {
        setFeedback({
          kind: "error",
          message:
            "Handle must be 3–32 chars: lowercase letters, numbers, - or _.",
        })
        return
      }
      setSaving(true)
      try {
        const res = await fetch("/api/play/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            handle: handle.trim() === "" ? null : normalizeHandle(handle),
            displayName: displayName.trim() || null,
            bio: bio.trim() || null,
            avatarUrl: avatarUrl.trim() || null,
          }),
        })
        if (res.status === 401) {
          setLoad({ kind: "signed-out" })
          return
        }
        if (res.status === 409) {
          setFeedback({
            kind: "error",
            message: "That handle is already taken. Try another.",
          })
          return
        }
        if (res.status === 400) {
          setFeedback({
            kind: "error",
            message: "That handle isn't valid. Try another.",
          })
          return
        }
        if (!res.ok) {
          setFeedback({ kind: "error", message: "Couldn't save. Try again." })
          return
        }
        const data = (await res.json()) as { profile: ProfileShape }
        setSavedHandle(data.profile.handle)
        setHandle(data.profile.handle ?? "")
        setFeedback({ kind: "success", message: "Profile saved." })
      } catch {
        setFeedback({ kind: "error", message: "Network error. Try again." })
      } finally {
        setSaving(false)
      }
    },
    [handle, displayName, bio, avatarUrl]
  )

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 size-[44rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-5 pt-6 pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/explore"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="grid size-7 place-items-center rounded-md border border-border bg-card/60">
              <span className="block size-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(73%_0.17_296_/_0.7)]" />
            </span>
            TreasureLoop
          </Link>
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Your profile
          </span>
        </header>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 pt-32 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading your profile…
          </div>
        )}

        {load.kind === "signed-out" && <SignedOut />}

        {load.kind === "error" && (
          <div className="pt-32 text-center text-sm text-rose-300/90">
            {load.message}
          </div>
        )}

        {load.kind === "ready" && (
          <>
            <div className="grid gap-2 pt-12">
              <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
                Identity
              </p>
              <h1 className="font-heading text-[32px] leading-[1.05] font-medium tracking-tight sm:text-[40px]">
                Set up your profile
              </h1>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Your public identity across TreasureLoop. Claim a handle so
                people can find you at{" "}
                <span className="font-mono text-foreground/80">
                  /u/your-handle
                </span>
                .
              </p>
            </div>

            <form onSubmit={onSave} className="grid gap-6 pt-10">
              <div className="grid gap-2">
                <Label htmlFor="handle">Handle</Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="your-handle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={32}
                  />
                </div>
                <p
                  className={`text-xs ${
                    handleHint.tone === "error"
                      ? "text-rose-300/90"
                      : handleHint.tone === "ok"
                        ? "text-emerald-300/90"
                        : "text-muted-foreground"
                  }`}
                >
                  {handleHint.message}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={64}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A line or two about you."
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  maxLength={2048}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Button type="submit" disabled={saving} className="sm:w-auto">
                  {saving ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Save profile
                      <ArrowRightIcon className="size-4" />
                    </>
                  )}
                </Button>

                {savedHandle && (
                  <Link
                    href={`/u/${savedHandle}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
                  >
                    View public profile
                    <ExternalLinkIcon className="size-3.5" />
                  </Link>
                )}
              </div>

              {feedback && (
                <p
                  role={feedback.kind === "error" ? "alert" : "status"}
                  className={`flex items-center gap-1.5 text-sm ${
                    feedback.kind === "error"
                      ? "text-rose-300/90"
                      : "text-emerald-300/90"
                  }`}
                >
                  {feedback.kind === "success" && (
                    <CheckCircle2Icon className="size-4" />
                  )}
                  {feedback.message}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </main>
  )
}

function SignedOut() {
  return (
    <div className="flex flex-col items-center gap-5 pt-28 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-card/60 text-primary">
        <UserRoundIcon className="size-5" />
      </span>
      <div className="grid gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          Connect your wallet to set up your profile
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your profile is tied to your wallet. Sign in to claim a handle and
          show off your finisher badges.
        </p>
      </div>
      <Link
        href="/play"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_0_24px_oklch(73%_0.17_296_/_0.35)] transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        Connect wallet
        <ArrowRightIcon className="size-4" />
      </Link>
      <Link
        href="/explore"
        className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
      >
        Browse events instead
      </Link>
    </div>
  )
}

function handleValidity(raw: string): {
  tone: "muted" | "ok" | "error"
  message: string
} {
  const trimmed = raw.trim()
  if (trimmed === "") {
    return {
      tone: "muted",
      message: "3–32 chars: lowercase letters, numbers, - or _.",
    }
  }
  if (isValidHandle(trimmed)) {
    return { tone: "ok", message: `Looks good — /u/${normalizeHandle(trimmed)}` }
  }
  return {
    tone: "error",
    message: "Only lowercase letters, numbers, - and _ (3–32 chars).",
  }
}
