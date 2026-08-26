import { apiDelete, apiGet, apiPost, apiPut } from './api';
import type { StatsBundleSeason } from '../stats/statsBundle';
import type { TrackerMapStats } from '../stats/statsEngine';

/**
 * Events as the database holds them. An event is addressed by its slug — the
 * short name a visitor types on the public site — and carries just enough
 * about itself for the directory and the season filter to draw without
 * loading a single scoreboard.
 */
export interface CloudEvent {
  slug: string;
  name: string;
  /** Unpublished events are invisible to everyone but the owner. */
  published: boolean;
  seasons: StatsBundleSeason[];
  registryUnits: string[];
  mapStats: { overall?: TrackerMapStats; bySeason?: Record<string, TrackerMapStats> } | null;
  createdAt: string;
  updatedAt: string;
  scoreboardCount: number;
}

/** What the owner may set; everything else about an event is the server's. */
export interface CloudEventInput {
  slug: string;
  name?: string;
  published?: boolean;
  seasons?: StatsBundleSeason[];
  registryUnits?: string[];
  mapStats?: CloudEvent['mapStats'];
}

export const listEvents = async (): Promise<CloudEvent[]> =>
  (await apiGet<{ events: CloudEvent[] }>('/events')).events ?? [];

export const getEvent = async (slug: string): Promise<CloudEvent> =>
  (await apiGet<{ event: CloudEvent }>(`/events/${encodeURIComponent(slug)}`)).event;

export const saveEvent = async (input: CloudEventInput): Promise<CloudEvent> =>
  (await apiPost<{ event: CloudEvent }>('/events', input)).event;

export const deleteEvent = async (slug: string): Promise<void> => {
  await apiDelete(`/events/${encodeURIComponent(slug)}`);
};

/**
 * The tracker's own state for an event — weeks, rosters, settings, brackets.
 * Public to read once the event is published (the site shows the season, not
 * just the player stats) and owner-only to write.
 */
export const getTrackerState = async <T>(slug: string): Promise<T> =>
  (await apiGet<{ state: T }>(`/events/${encodeURIComponent(slug)}/tracker`)).state;

export const putTrackerState = async (slug: string, state: unknown): Promise<void> => {
  await apiPut(`/events/${encodeURIComponent(slug)}/tracker`, { state });
};
