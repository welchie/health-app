import AsyncStorage from '@react-native-async-storage/async-storage';
import { BloodPressureReading, WeightEntry } from './types';

// Production sync API endpoint, overridable via EXPO_PUBLIC_API_URL for local development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.weewelchie.org/api/v1';

const DEVICE_TOKEN_KEY = 'health-app/device-token/v1';

export type SyncPayload = {
  readings: BloodPressureReading[];
  weights: WeightEntry[];
  lastSyncTime: string | null;
};

export type SyncResponse = {
  readings: BloodPressureReading[];
  weights: WeightEntry[];
  syncTime: string;
};

/**
 * Returns the local device token from AsyncStorage.
 * If not present, requests a new one from Spring Boot and persists it.
 */
export async function getDeviceToken(): Promise<string | null> {
  try {
    let token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) return token;

    // Register device anonymously
    const res = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Device registration failed: ${res.status}`);
    }

    const data = await res.json();
    token = data.deviceToken;
    if (token) {
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
  } catch (err) {
    console.warn('Failed to retrieve or register device token:', err);
    return null;
  }
}

/**
 * Sends local modifications and receives updates since lastSyncTime.
 */
export async function syncWithBackend(
  deviceToken: string,
  payload: SyncPayload,
): Promise<SyncResponse> {
  const res = await fetch(`${API_BASE_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Token': deviceToken,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Sync request failed with status: ${res.status}`);
  }

  return (await res.json()) as SyncResponse;
}
