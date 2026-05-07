/**
 * 🎙 useCoachVoice
 * =================
 *
 * In-run TTS companion. Watches `distanceKm` from the active tracker and
 * speaks the matching pre-generated script line at the right moment.
 *
 * Trigger map (matches backend coach.generate_run_script output):
 * - "start"     → played once when tracking begins
 * - "km"        → played once on first crossing of each integer km
 * - "halfway"   → played once on crossing 50% of the target distance
 * - "km_to_go"  → played once when within the line's `remaining_km` window
 * - "finish"    → played once on tracker stop (caller invokes speakFinish())
 *
 * Behaviour:
 * - Loads the script once (or accepts an inline `script` prop for tests).
 * - Loads the user's coach settings once and refuses to speak when
 *   `coach_voice_during_runs === 'off'`.
 * - Refuses to speak with no scriptId (we never improvise mid-run).
 * - Stops any in-flight utterance on unmount.
 *
 * The hook is intentionally idempotent: each line is keyed by an index so
 * a flapping `distanceKm` (GPS jitter near a km boundary) cannot replay
 * the same line.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

import {
  coachApi,
  CoachRunScript,
  CoachRunScriptLine,
  CoachSettings,
} from './api';

interface Args {
  /** ID of the pre-generated script. When null, the hook is inert. */
  scriptId: number | null;
  /** Live distance from the active tracker (km). */
  distanceKm: number;
  /** Whether the tracker is currently moving. We don't speak while paused/idle. */
  isTracking: boolean;
  /** Whether the tracker is currently paused. We don't speak while paused. */
  isPaused: boolean;
  /** Optional override for tests. When set, the hook skips the network fetch. */
  script?: CoachRunScript | null;
}

export interface CoachVoiceState {
  ready: boolean;
  enabled: boolean;
  script: CoachRunScript | null;
  /** Imperative call invoked from the active screen when finishing a run. */
  speakFinish: () => void;
  /** Imperative call to silence anything queued (e.g. on discard). */
  stop: () => void;
}

const SPEECH_OPTIONS: Speech.SpeechOptions = {
  rate: 0.95,
  pitch: 1.0,
};

export function useCoachVoice({
  scriptId,
  distanceKm,
  isTracking,
  isPaused,
  script: scriptOverride,
}: Args): CoachVoiceState {
  const [script, setScript] = useState<CoachRunScript | null>(scriptOverride ?? null);
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [ready, setReady] = useState(scriptOverride != null);
  const playedKeysRef = useRef<Set<string>>(new Set());

  // Load script & settings on mount (unless an override was provided).
  useEffect(() => {
    let cancelled = false;
    if (scriptOverride) {
      setScript(scriptOverride);
      setReady(true);
      return;
    }
    if (scriptId == null) {
      setScript(null);
      setReady(false);
      return;
    }
    (async () => {
      try {
        const [s, st] = await Promise.all([
          coachApi.getRunScript(scriptId),
          coachApi.getSettings().catch(() => null),
        ]);
        if (cancelled) return;
        setScript(s);
        setSettings(st);
        setReady(true);
      } catch {
        if (!cancelled) {
          setScript(null);
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptId, scriptOverride]);

  // Voice is enabled when the user wants it AND we have a script. The
  // 'journeys_only' option is conservative: only speaks when the script's
  // activity is `journey`. Other modes:
  //   off          → never speak
  //   coach_runs   → speak whenever a script is loaded (the current case)
  //   all          → speak whenever a script is loaded (same behaviour today;
  //                  ad-hoc runs without a script are not voiced yet)
  const enabled = useMemo(() => {
    if (!ready || !script) return false;
    const mode = settings?.coach_voice_during_runs ?? 'coach_runs';
    if (mode === 'off') return false;
    if (mode === 'journeys_only' && script.activity !== 'journey') return false;
    return true;
  }, [ready, script, settings]);

  // Imperative speak helper. Always idempotent on a `key` (prevents
  // re-speaking the same line on GPS jitter or React re-renders).
  const speak = (line: CoachRunScriptLine, key: string) => {
    if (!enabled) return;
    if (playedKeysRef.current.has(key)) return;
    playedKeysRef.current.add(key);
    try {
      Speech.speak(line.text, SPEECH_OPTIONS);
    } catch {
      // Speech failures are non-fatal — the run continues silently.
    }
  };

  // Drive the line playback off (distanceKm, isTracking, isPaused).
  useEffect(() => {
    if (!enabled || !script) return;
    if (!isTracking || isPaused) return;

    const lines = script.lines;

    // Start line
    const startLine = lines.find((l) => l.trigger === 'start');
    if (startLine) speak(startLine, 'start');

    // Halfway
    const halfway = lines.find((l) => l.trigger === 'halfway');
    if (halfway && distanceKm >= script.target_distance_km / 2) {
      speak(halfway, 'halfway');
    }

    // Per-km lines (one per crossed integer km)
    const intKm = Math.floor(distanceKm);
    for (const line of lines) {
      if (line.trigger !== 'km' || line.km == null) continue;
      if (distanceKm >= line.km && intKm >= line.km) {
        speak(line, `km:${line.km}`);
      }
    }

    // km_to_go lines (e.g. "1 km to go")
    const remaining = script.target_distance_km - distanceKm;
    for (const line of lines) {
      if (line.trigger !== 'km_to_go' || line.remaining_km == null) continue;
      if (remaining <= line.remaining_km) {
        speak(line, `togo:${line.remaining_km}`);
      }
    }
  }, [distanceKm, isTracking, isPaused, enabled, script]);

  // Stop any in-flight utterance on unmount.
  useEffect(() => {
    return () => {
      try {
        Speech.stop();
      } catch {}
    };
  }, []);

  return {
    ready,
    enabled,
    script,
    speakFinish: () => {
      if (!enabled || !script) return;
      const finish = script.lines.find((l) => l.trigger === 'finish');
      if (finish) speak(finish, 'finish');
    },
    stop: () => {
      try {
        Speech.stop();
      } catch {}
    },
  };
}
