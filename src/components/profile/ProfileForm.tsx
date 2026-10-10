"use client";

import { animate, stagger } from "animejs";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InputField, TextareaField } from "@/components/ui/Field";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TagInput } from "@/components/ui/TagInput";
import { CALL_LANGUAGES, CALL_LANGUAGE_IDS, type CallLanguage } from "@/lib/call-languages";
import { formatPhone } from "@/lib/phone";
import { profileCompleteness, type ProfileView } from "@/lib/profile-view";
import { fieldErrors, profileSchema, type FieldErrors } from "@/lib/validation";

const SKILL_SUGGESTIONS = [
  "Python",
  "JavaScript",
  "React",
  "UI/UX",
  "Machine Learning",
  "Public speaking",
  "Video editing",
  "Robotics",
  "Photography",
  "Marketing",
];
const HOBBY_SUGGESTIONS = [
  "Music",
  "Cricket",
  "Reading",
  "Gaming",
  "Dance",
  "Travel",
  "Chess",
  "Painting",
  "Fitness",
  "Cooking",
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";

type Form = {
  name: string;
  phone: string;
  bio: string;
  skills: string[];
  hobbies: string[];
  college: string;
  city: string;
  organization: string;
  studentId: string;
  department: string;
  linkedinUrl: string;
  githubUrl: string;
  callLanguage: CallLanguage;
};

function toForm(p: ProfileView): Form {
  return {
    name: p.name,
    phone: formatPhone(p.phone),
    bio: p.bio ?? "",
    skills: p.skills,
    hobbies: p.hobbies,
    college: p.college ?? "",
    city: p.city ?? "",
    organization: p.organization ?? "",
    studentId: p.studentId ?? "",
    department: p.department ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    githubUrl: p.githubUrl ?? "",
    callLanguage: (CALL_LANGUAGE_IDS as readonly string[]).includes(p.callLanguage)
      ? (p.callLanguage as CallLanguage)
      : "hi",
  };
}

export function ProfileForm({ profile: initial }: { profile: ProfileView }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [profile, setProfile] = useState(initial);
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const isHost = profile.role === "HOST";

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setStatus(null);
  };

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-field]"), {
      opacity: [0, 1],
      y: [24, 0],
      delay: stagger(60, { start: 120 }),
      duration: 800,
      ease: "out(4)",
    });
  });

  // The live preview and completeness reflect what's typed, before saving.
  const draft: ProfileView = {
    ...profile,
    name: form.name || profile.name,
    phone: form.phone || null,
    bio: form.bio || null,
    skills: form.skills,
    hobbies: form.hobbies,
    college: form.college || null,
    city: form.city || null,
    organization: form.organization || null,
    department: form.department || null,
  };
  const completeness = profileCompleteness(draft);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() => {
        const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (invalid) {
          animate(invalid, { x: [0, -10, 9, -6, 4, 0], duration: 500, ease: "inOut(2)" });
          invalid.focus();
        }
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.error?.fields ?? {});
        setStatus({ tone: "danger", text: data.error?.message ?? "Couldn't save your profile." });
        return;
      }
      setProfile(data.profile);
      setForm(toForm(data.profile));
      setStatus({ tone: "success", text: "Profile saved ✓" });
      router.refresh();
    } catch {
      setStatus({ tone: "danger", text: "Network error — check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={root} className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
        <section data-field data-intro className="rounded-3xl p-6 glass sm:p-8">
          <ImageUpload
            label="Profile photo"
            shape="avatar"
            value={profile.avatarUrl}
            endpoint="/api/profile/avatar"
            initials={initialsOf(form.name)}
            hint="A clear face photo helps hosts recognise you at the gate."
            onChange={(avatarUrl) => {
              setProfile((p) => ({ ...p, avatarUrl }));
              router.refresh();
            }}
          />
        </section>

        <section data-field data-intro className="space-y-6 rounded-3xl p-6 glass sm:p-8">
          <h2 className="font-display text-xl font-semibold text-white">About you</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <InputField
              id="name"
              label="Full name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name?.[0]}
              maxLength={80}
            />
            <InputField
              id="phone"
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              error={errors.phone?.[0]}
              hint="Aanaya uses this for event reminder calls."
            />
          </div>
          <TextareaField
            id="bio"
            label="Short description"
            optional
            placeholder={
              isHost
                ? "What your club does and the events you run…"
                : "Second-year CE student who loves robotics and hackathons…"
            }
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            error={errors.bio?.[0]}
            maxLength={280}
            hint={`${form.bio.length}/280`}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {isHost ? (
              <InputField
                id="organization"
                label="Club or organization"
                optional
                placeholder="Computer Society"
                value={form.organization}
                onChange={(e) => set("organization", e.target.value)}
                error={errors.organization?.[0]}
              />
            ) : (
              <InputField
                id="department"
                label="Department"
                optional
                placeholder="Computer Engineering"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                error={errors.department?.[0]}
              />
            )}
            <InputField
              id="college"
              label="College"
              optional
              placeholder="Atmiya University"
              value={form.college}
              onChange={(e) => set("college", e.target.value)}
              error={errors.college?.[0]}
            />
            {!isHost && (
              <InputField
                id="studentId"
                label="Student ID"
                optional
                placeholder="21CE045"
                value={form.studentId}
                onChange={(e) => set("studentId", e.target.value)}
                error={errors.studentId?.[0]}
              />
            )}
            <InputField
              id="city"
              label="City"
              optional
              placeholder="Rajkot"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              error={errors.city?.[0]}
            />
          </div>
        </section>

        <section data-field data-intro className="space-y-6 rounded-3xl p-6 glass sm:p-8">
          <h2 className="font-display text-xl font-semibold text-white">Skills & hobbies</h2>
          <TagInput
            id="skills"
            label="Skills"
            value={form.skills}
            onChange={(v) => set("skills", v)}
            suggestions={SKILL_SUGGESTIONS}
            placeholder="Type a skill and press Enter"
            error={errors.skills?.[0]}
            tone="cyan"
          />
          <TagInput
            id="hobbies"
            label="Hobbies"
            value={form.hobbies}
            onChange={(v) => set("hobbies", v)}
            suggestions={HOBBY_SUGGESTIONS}
            placeholder="Type a hobby and press Enter"
            error={errors.hobbies?.[0]}
            tone="pink"
          />
        </section>

        <section data-field data-intro className="space-y-6 rounded-3xl p-6 glass sm:p-8">
          <h2 className="font-display text-xl font-semibold text-white">Links & preferences</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <InputField
              id="linkedinUrl"
              label="LinkedIn"
              optional
              placeholder="linkedin.com/in/your-name"
              value={form.linkedinUrl}
              onChange={(e) => set("linkedinUrl", e.target.value)}
              error={errors.linkedinUrl?.[0]}
            />
            <InputField
              id="githubUrl"
              label="GitHub"
              optional
              placeholder="your-username"
              value={form.githubUrl}
              onChange={(e) => set("githubUrl", e.target.value)}
              error={errors.githubUrl?.[0]}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-200">Reminder call language</legend>
            <p className="text-xs text-zinc-500">When a host sends reminders, Aanaya calls you in this language.</p>
            <div className="flex flex-wrap gap-2 pt-1" role="radiogroup">
              {CALL_LANGUAGE_IDS.map((id) => {
                const active = form.callLanguage === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("callLanguage", id)}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      active
                        ? "border-cyan/60 bg-cyan/15 text-white"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
                    }`}
                  >
                    <span className="font-semibold">{CALL_LANGUAGES[id].native}</span>
                    {id !== "en" && <span className="ml-1.5 text-xs text-zinc-500">{CALL_LANGUAGES[id].label}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <div
          data-field
          data-intro
          className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 glass-strong"
        >
          <p
            role="status"
            className={`text-sm ${status?.tone === "success" ? "text-success" : status?.tone === "danger" ? "text-danger" : "text-zinc-500"}`}
          >
            {status?.text ?? "Changes are saved to your account."}
          </p>
          <Button type="submit" loading={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>

      {/* Live card + completeness */}
      <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start" aria-label="Profile preview">
        <div
          data-field
          data-intro
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 p-7"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-28 bg-aurora [mask-image:linear-gradient(#000,transparent)] opacity-60"
          />
          <div className="relative">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-ink-900 shadow-xl">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ≤300 KB storage image
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-aurora font-display text-2xl font-bold text-ink-950">
                  {initialsOf(form.name)}
                </span>
              )}
            </div>
            <p className="mt-4 font-display text-2xl font-bold text-white">{form.name || "Your name"}</p>
            <p className="text-sm text-zinc-400">
              {[isHost ? form.organization : form.department, form.college, form.city].filter(Boolean).join(" · ") ||
                (isHost ? "Host" : "Attendee")}
            </p>
            {form.bio && <p className="mt-4 text-sm leading-relaxed text-zinc-300">{form.bio}</p>}
            {(form.skills.length > 0 || form.hobbies.length > 0) && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {form.skills.map((s) => (
                  <Badge key={`s-${s}`} tone="info">
                    {s}
                  </Badge>
                ))}
                {form.hobbies.map((h) => (
                  <Badge key={`h-${h}`} tone="violet">
                    ♥ {h}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div data-field data-intro className="flex items-center gap-5 rounded-3xl p-6 glass">
          <ProgressRing
            value={completeness.score}
            size={96}
            stroke={9}
            label={`Profile ${Math.round(completeness.score * 100)}% complete`}
          >
            <span className="font-display text-xl font-bold text-white">{Math.round(completeness.score * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="font-semibold text-white">
              {completeness.missing.length ? "Profile strength" : "All-star profile ✨"}
            </p>
            {completeness.missing.length > 0 && (
              <p className="mt-1 text-sm text-zinc-400">Add: {completeness.missing.slice(0, 4).join(", ")}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
