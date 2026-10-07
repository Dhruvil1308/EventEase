"use client";

import { useCallback, useRef } from "react";
import type { CheckInStatus } from "@/lib/services/checkin";

/**
 * Audible + haptic feedback for the gate, synthesised with WebAudio so there
 * are no sound files to load. A rising chime means "in", a low buzz means "no".
 */
export function useGateFeedback(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);

  return useCallback(
    (status: CheckInStatus) => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(status === "SUCCESS" ? 60 : [90, 60, 90]);
      }
      if (!enabled) return;
      try {
        ctx.current ??= new AudioContext();
        const ac = ctx.current;
        if (ac.state === "suspended") void ac.resume();
        const now = ac.currentTime;
        const notes =
          status === "SUCCESS"
            ? [
                { f: 880, t: 0, d: 0.12, type: "sine" as OscillatorType },
                { f: 1318.5, t: 0.1, d: 0.22, type: "sine" as OscillatorType },
              ]
            : [
                { f: 160, t: 0, d: 0.16, type: "square" as OscillatorType },
                { f: 130, t: 0.2, d: 0.22, type: "square" as OscillatorType },
              ];
        for (const n of notes) {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = n.type;
          osc.frequency.value = n.f;
          gain.gain.setValueAtTime(0.0001, now + n.t);
          gain.gain.exponentialRampToValueAtTime(status === "SUCCESS" ? 0.25 : 0.12, now + n.t + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
          osc.connect(gain).connect(ac.destination);
          osc.start(now + n.t);
          osc.stop(now + n.t + n.d + 0.02);
        }
      } catch {
        // Audio is a nicety; ignore failures (e.g. autoplay policies).
      }
    },
    [enabled],
  );
}
