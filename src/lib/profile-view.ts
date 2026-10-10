/** What the profile page and the navbar need, safe to hand to the browser. */
export type ProfileView = {
  id: string;
  email: string;
  name: string;
  role: "ATTENDEE" | "HOST";
  phone: string | null;
  bio: string | null;
  skills: string[];
  hobbies: string[];
  college: string | null;
  city: string | null;
  organization: string | null;
  studentId: string | null;
  department: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  callLanguage: string;
  avatarUrl: string | null;
  createdAt: string;
};

/**
 * How complete a profile is, 0–1, and what's still missing. Hosts and
 * attendees are scored on the fields that matter for their role.
 */
export function profileCompleteness(p: ProfileView): { score: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["Profile photo", Boolean(p.avatarUrl)],
    ["Mobile number", Boolean(p.phone)],
    ["Short bio", Boolean(p.bio)],
    ["College", Boolean(p.college)],
    ["City", Boolean(p.city)],
    ...(p.role === "HOST"
      ? ([["Club or organization", Boolean(p.organization)]] as [string, boolean][])
      : ([
          ["Skills", p.skills.length > 0],
          ["Hobbies", p.hobbies.length > 0],
          ["Department", Boolean(p.department)],
        ] as [string, boolean][])),
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { score: done / checks.length, missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}
