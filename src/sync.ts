import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceToken, syncWithBackend, SyncPayload } from './api';
import {
  loadRawReadings,
  saveRawReadings,
  loadRawWeights,
  saveRawWeights,
} from './storage';
import { BloodPressureReading, WeightEntry } from './types';

const LAST_SYNC_KEY = 'health-app/last-sync-time/v1';

const getUpdatedAtTime = (item: { updatedAt?: string; takenAt: string }) =>
  new Date(item.updatedAt || item.takenAt).getTime();

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

let currentSyncState: SyncState = 'idle';
let lastSyncTimestamp: string | null = null;
const listeners = new Set<(state: SyncState, lastTime: string | null) => void>();

export function subscribeToSync(cb: (state: SyncState, lastTime: string | null) => void) {
  listeners.add(cb);
  cb(currentSyncState, lastSyncTimestamp);
  return () => {
    listeners.delete(cb);
  };
}

function updateSyncState(state: SyncState, lastTime: string | null = lastSyncTimestamp) {
  currentSyncState = state;
  lastSyncTimestamp = lastTime;
  listeners.forEach((l) => l(state, lastTime));
}

export async function initSyncState() {
  try {
    const lastTime = await AsyncStorage.getItem(LAST_SYNC_KEY);
    lastSyncTimestamp = lastTime;
    updateSyncState('idle', lastTime);
  } catch (err) {
    console.warn('Failed to load last sync time:', err);
  }
}

/**
 * Triggers background data synchronization.
 * Returns true if the sync completed successfully.
 */
export async function syncData(): Promise<boolean> {
  if (currentSyncState === 'syncing') return false;

  updateSyncState('syncing');

  try {
    const token = await getDeviceToken();
    if (!token) {
      updateSyncState('error');
      return false;
    }

    const lastSyncTime = await AsyncStorage.getItem(LAST_SYNC_KEY);

    // 1. Gather unsynced modifications
    const rawReadings = await loadRawReadings();
    const rawWeights = await loadRawWeights();

    const localModifiedReadings = rawReadings
      .filter((r) => !r.synced)
      .map((r) => ({
        ...r,
        updatedAt: r.updatedAt || r.takenAt || new Date().toISOString(),
        deleted: r.deleted ?? false,
      }));
    const localModifiedWeights = rawWeights
      .filter((w) => !w.synced)
      .map((w) => ({
        ...w,
        updatedAt: w.updatedAt || w.takenAt || new Date().toISOString(),
        deleted: w.deleted ?? false,
      }));

    const payload: SyncPayload = {
      readings: localModifiedReadings,
      weights: localModifiedWeights,
      lastSyncTime,
    };

    // 2. Call backend sync REST endpoint
    const response = await syncWithBackend(token, payload);

    // 3. Process & merge BloodPressureReadings (Last Write Wins)
    let nextReadings = rawReadings.map((r) => {
      const wasUploaded = localModifiedReadings.some((m) => m.id === r.id);
      if (wasUploaded) {
        return {
          ...r,
          updatedAt: r.updatedAt || r.takenAt || new Date().toISOString(),
          synced: true,
          deleted: r.deleted ?? false,
        };
      }
      return r;
    });

    // Remove tombstones that we successfully deleted on the server
    nextReadings = nextReadings.filter((r) => !(r.deleted && r.synced));

    response.readings.forEach((remote) => {
      const idx = nextReadings.findIndex((r) => r.id === remote.id);
      const normalizedRemote: BloodPressureReading = {
        ...remote,
        updatedAt: remote.updatedAt || remote.takenAt,
        deleted: remote.deleted ?? false,
        synced: true,
      };
      if (idx >= 0) {
        const local = nextReadings[idx];
        if (getUpdatedAtTime(normalizedRemote) >= getUpdatedAtTime(local)) {
          nextReadings[idx] = normalizedRemote;
        }
      } else {
        if (!normalizedRemote.deleted) {
          nextReadings.push(normalizedRemote);
        }
      }
    });

    // 4. Process & merge WeightEntries (Last Write Wins)
    let nextWeights = rawWeights.map((w) => {
      const wasUploaded = localModifiedWeights.some((m) => m.id === w.id);
      if (wasUploaded) {
        return {
          ...w,
          updatedAt: w.updatedAt || w.takenAt || new Date().toISOString(),
          synced: true,
          deleted: w.deleted ?? false,
        };
      }
      return w;
    });

    // Remove tombstones that we successfully deleted on the server
    nextWeights = nextWeights.filter((w) => !(w.deleted && w.synced));

    response.weights.forEach((remote) => {
      const idx = nextWeights.findIndex((w) => w.id === remote.id);
      const normalizedRemote: WeightEntry = {
        ...remote,
        updatedAt: remote.updatedAt || remote.takenAt,
        deleted: remote.deleted ?? false,
        synced: true,
      };
      if (idx >= 0) {
        const local = nextWeights[idx];
        if (getUpdatedAtTime(normalizedRemote) >= getUpdatedAtTime(local)) {
          nextWeights[idx] = normalizedRemote;
        }
      } else {
        if (!normalizedRemote.deleted) {
          nextWeights.push(normalizedRemote);
        }
      }
    });

    // 5. Persist merged data and update sync time
    await saveRawReadings(nextReadings);
    await saveRawWeights(nextWeights);
    await AsyncStorage.setItem(LAST_SYNC_KEY, response.syncTime);

    updateSyncState('synced', response.syncTime);
    return true;
  } catch (err) {
    console.warn('Sync failed:', err);
    updateSyncState('error');
    return false;
  }
}
