/** Shapes returned by the EventEase API (mirrors the website's services). */

export type Role = "ATTENDEE" | "HOST";

export type Profile = {
  id: string;
  email: string;
  name: string;
  role: Role;
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
};

export type Prize = { title: string; reward: string };

export type EventStats = {
  capacity: number;
  registered: number;
  checkedIn: number;
  remaining: number;
  fillRate: number;
  attendanceRate: number;
};

export type EventSummary = {
  id: string;
  name: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  type: string;
  entryFee: number;
  prizes: Prize[];
  coverUrl: string | null;
  theme: string;
  hostId: string;
  hostName: string;
  stats: EventStats;
};

export type MyTicket = {
  code: string;
  checkedInAt: string | null;
  event: {
    id: string;
    name: string;
    venue: string;
    startsAt: string;
    endsAt: string | null;
    theme: string;
    hostName: string;
    coverUrl: string | null;
  };
};

export type HostStats = {
  events: number;
  totalCapacity: number;
  registrations: number;
  checkIns: number;
  duplicatesBlocked: number;
  reminderCalls: number;
};

export type Participant = {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  department: string | null;
  phone: string | null;
  code: string;
  checkedInAt: string | null;
  createdAt: string;
};

export type CheckInStatus = "SUCCESS" | "DUPLICATE" | "INVALID" | "WRONG_EVENT";

export type CheckInResult = {
  status: CheckInStatus;
  message: string;
  code: string;
  checkedInAt?: string;
  participant?: { name: string; email: string; code: string; studentId: string | null; department: string | null };
  event?: { id: string; name: string; venue: string; theme: string };
  stats?: EventStats;
};

export type ActivityItem = {
  id: string;
  result: CheckInStatus;
  code: string;
  name: string | null;
  eventName: string | null;
  createdAt: string;
};

export type EventLive = {
  stats: EventStats;
  gate: Record<CheckInStatus, number>;
  participants: Participant[];
  activity: ActivityItem[];
};

export type CallStatus =
  | "QUEUED"
  | "DIALING"
  | "RINGING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "CANCELED";
export type ReplyIntent = "CONFIRMED" | "DECLINED" | "UNSURE" | "NO_RESPONSE";

export type CallRow = {
  registrationId: string;
  name: string;
  email: string;
  phone: string | null;
  language: string;
  avatarUrl: string | null;
  checkedIn: boolean;
  attempts: number;
  lastCall: {
    id: string;
    status: CallStatus;
    intent: ReplyIntent | null;
    transcript: string | null;
    durationSec: number | null;
    language: string;
    trigger: string;
    error: string | null;
    at: string;
  } | null;
};

export type CallConsole = {
  event: {
    id: string;
    name: string;
    startsAt: string;
    theme: string;
    reminderEnabled: boolean;
    reminderLeadMinutes: number;
    reminderLanguage: string;
    reminderArriveEarly: number;
    reminderQueuedAt: string | null;
    callAt: string;
  };
  rows: CallRow[];
  stats: {
    registrants: number;
    withPhone: number;
    queued: number;
    live: number;
    reached: number;
    unreachable: number;
    confirmed: number;
    declined: number;
  };
  setup: { canPreview: boolean; canCall: boolean; items: { key: string; label: string; ok: boolean; hint: string; required: boolean }[] };
  now: string;
};

export type VoicePrompt = { id: string; script: string; audioUrl: string; durationMs: number; replySeconds: number };
