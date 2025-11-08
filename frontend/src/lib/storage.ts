export interface Event {
  id: string;
  userId: string;
  kind: "luqo_log";
  createdAt: string; // ISO string representation
  body: {
    text: string;
  };
}

const LOCAL_EVENTS_KEY = "luqo_local_events_v1" as const;

export const loadLocalEvents = (): Event[] => {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Treat parsed data as Event[] without strict validation for MVP
    return parsed as Event[];
  } catch {
    return [];
  }
};

export const saveLocalEvent = (event: Event): void => {
  try {
    const current = loadLocalEvents();
    const next = [...current, event];
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore environments where localStorage is unavailable
  }
};

export const clearLocalEvents = (): void => {
  try {
    localStorage.removeItem(LOCAL_EVENTS_KEY);
  } catch {
    // noop when storage removal fails
  }
};

export const getLocalEventsCount = (): number => {
  return loadLocalEvents().length;
};
