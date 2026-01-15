import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RANDOM_COOLDOWN_MS = 2100;
const STORAGE_KEY = "vh_random_cooldown_until";
const EVENT_NAME = "vh:random-cooldown";

type RandomCooldownEvent = CustomEvent<{ disabledUntil: number }>;

function readDisabledUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function writeDisabledUntil(disabledUntil: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(disabledUntil));
  } catch {
    // ignore
  }
}

function emitCooldown(disabledUntil: number) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { disabledUntil } }));
  } catch {
    // ignore
  }
}

export function useRandomCooldown() {
  const [disabledUntil, setDisabledUntil] = useState<number>(() => readDisabledUntil());
  const timeoutRef = useRef<number | null>(null);

  const isLocked = useMemo(() => {
    if (typeof window === "undefined") return false;
    return disabledUntil > Date.now();
  }, [disabledUntil]);

  const syncFromStorage = useCallback(() => {
    setDisabledUntil(readDisabledUntil());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onCooldown = (event: Event) => {
      const e = event as RandomCooldownEvent;
      const next = typeof e?.detail?.disabledUntil === "number" ? e.detail.disabledUntil : 0;
      setDisabledUntil(Math.max(0, next));
    };

    window.addEventListener(EVENT_NAME, onCooldown as EventListener);
    return () => window.removeEventListener(EVENT_NAME, onCooldown as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const remaining = disabledUntil - Date.now();
    if (remaining <= 0) return;

    timeoutRef.current = window.setTimeout(() => {
      syncFromStorage();
    }, remaining + 5);

    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [disabledUntil, syncFromStorage]);

  const tryStartCooldown = useCallback(() => {
    if (typeof window === "undefined") return true;

    const now = Date.now();
    const currentUntil = readDisabledUntil();
    if (now < currentUntil) {
      return false;
    }

    const nextUntil = now + RANDOM_COOLDOWN_MS;
    writeDisabledUntil(nextUntil);
    setDisabledUntil(nextUntil);
    emitCooldown(nextUntil);
    return true;
  }, []);

  return {
    isLocked,
    disabledUntil,
    tryStartCooldown,
  };
}
