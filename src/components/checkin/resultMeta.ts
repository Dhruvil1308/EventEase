import type { CheckInStatus } from "@/lib/services/checkin";

export const RESULT_META: Record<
  CheckInStatus,
  { label: string; short: string; color: string; text: string; bg: string; border: string; icon: string }
> = {
  SUCCESS: {
    label: "Entry granted",
    short: "Checked in",
    color: "#34d399",
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    icon: "M5 13l4 4L19 7",
  },
  DUPLICATE: {
    label: "Already checked in",
    short: "Duplicate rejected",
    color: "#fb7185",
    text: "text-danger",
    bg: "bg-danger/10",
    border: "border-danger/30",
    icon: "M6 6l12 12M18 6L6 18",
  },
  INVALID: {
    label: "Invalid code",
    short: "Invalid code",
    color: "#fbbf24",
    text: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/30",
    icon: "M12 8v5m0 3.5h.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  },
  WRONG_EVENT: {
    label: "Wrong event",
    short: "Wrong event",
    color: "#fb923c",
    text: "text-orange",
    bg: "bg-orange/10",
    border: "border-orange/30",
    icon: "M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18",
  },
};
