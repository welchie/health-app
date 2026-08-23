import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncData, initSyncState, SyncState } from '../sync';
import {
  saveRawReadings,
  loadReadings,
  loadRawReadings,
  saveRawWeights,
  loadWeights,
  loadRawWeights,
} from '../storage';
import { BloodPressureReading, WeightEntry } from '../types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFetch.mockReset();
});

describe('syncData engine', () => {
  it('registers device token on first sync and uploads modifications', async () => {
    // 1. Mock device registration response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deviceToken: 'mock-device-uuid' }),
    });

    // 2. Mock sync response (empty updates from server)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readings: [],
        weights: [],
        syncTime: '2026-08-23T20:00:00.000Z',
      }),
    });

    // Save one unsynced reading locally
    const unsyncedReading: BloodPressureReading = {
      id: 'local-1',
      takenAt: '2026-08-23T19:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      heartRate: 72,
      updatedAt: '2026-08-23T19:00:00.000Z',
      synced: false,
    };
    await saveRawReadings([unsyncedReading]);

    const result = await syncData();
    expect(result).toBe(true);

    // Verify token was stored
    const storedToken = await AsyncStorage.getItem('health-app/device-token/v1');
    expect(storedToken).toBe('mock-device-uuid');

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledTimes(2);
    
    // Check register device fetch call
    expect(mockFetch.mock.calls[0][0]).toContain('/devices');
    
    // Check sync fetch call contains unsynced reading in payload
    const syncCallUrl = mockFetch.mock.calls[1][0];
    const syncCallOpts = mockFetch.mock.calls[1][1];
    expect(syncCallUrl).toContain('/sync');
    expect(syncCallOpts.headers['X-Device-Token']).toBe('mock-device-uuid');
    
    const payload = JSON.parse(syncCallOpts.body);
    expect(payload.readings).toHaveLength(1);
    expect(payload.readings[0].id).toBe('local-1');

    // Verify reading has been marked as synced
    const rawReadings = await loadRawReadings();
    expect(rawReadings[0].synced).toBe(true);
  });

  it('merges remote modifications using Last Write Wins', async () => {
    // Already registered device
    await AsyncStorage.setItem('health-app/device-token/v1', 'existing-token');

    // Setup local:
    // - "local-older" has been updated locally AFTER last sync (local updatedAt is newer)
    // - "remote-newer" has been updated remotely (remote updatedAt is newer)
    const localOlder: BloodPressureReading = {
      id: 'r1',
      takenAt: '2026-08-23T10:00:00.000Z',
      systolic: 130,
      diastolic: 85,
      heartRate: 70,
      updatedAt: '2026-08-23T18:00:00.000Z', // Local edit is newer
      synced: false,
    };
    const localNewer: BloodPressureReading = {
      id: 'r2',
      takenAt: '2026-08-23T11:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      heartRate: 70,
      updatedAt: '2026-08-23T12:00:00.000Z', // Local edit is older
      synced: false,
    };
    await saveRawReadings([localOlder, localNewer]);

    // Mock response with remote changes
    const remoteOlder = {
      id: 'r1',
      takenAt: '2026-08-23T10:00:00.000Z',
      systolic: 110, // Server thinks it was 110
      diastolic: 70,
      heartRate: 60,
      updatedAt: '2026-08-23T15:00:00.000Z', // Server is older than local (15:00 vs 18:00)
    };
    const remoteNewer = {
      id: 'r2',
      takenAt: '2026-08-23T11:00:00.000Z',
      systolic: 140, // Server was updated to 140
      diastolic: 90,
      heartRate: 80,
      updatedAt: '2026-08-23T17:00:00.000Z', // Server is newer than local (17:00 vs 12:00)
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readings: [remoteOlder, remoteNewer],
        weights: [],
        syncTime: '2026-08-23T19:00:00.000Z',
      }),
    });

    const result = await syncData();
    expect(result).toBe(true);

    const merged = await loadReadings();
    expect(merged).toHaveLength(2);

    // Verify localOlder won (retained local values of 130/85, unsynced is kept false so it re-uploads next time)
    const mergedOlder = merged.find((r) => r.id === 'r1')!;
    expect(mergedOlder.systolic).toBe(130);
    expect(mergedOlder.diastolic).toBe(85);

    // Verify remoteNewer won (overwrote with remote values of 140/90)
    const mergedNewer = merged.find((r) => r.id === 'r2')!;
    expect(mergedNewer.systolic).toBe(140);
    expect(mergedNewer.diastolic).toBe(90);
  });

  it('purges tombstones that are successfully synced to the server', async () => {
    await AsyncStorage.setItem('health-app/device-token/v1', 'existing-token');

    // Local state: one active reading, one tombstone deleted reading (unsynced)
    const active: BloodPressureReading = {
      id: 'active-1',
      takenAt: '2026-08-23T10:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      heartRate: 70,
      updatedAt: '2026-08-23T10:00:00.000Z',
      synced: true,
    };
    const tombstone: BloodPressureReading = {
      id: 'deleted-1',
      takenAt: '2026-08-23T11:00:00.000Z',
      systolic: 130,
      diastolic: 85,
      heartRate: 72,
      updatedAt: '2026-08-23T12:00:00.000Z',
      synced: false,
      deleted: true,
    };
    await saveRawReadings([active, tombstone]);

    // Mock successful sync response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readings: [],
        weights: [],
        syncTime: '2026-08-23T13:00:00.000Z',
      }),
    });

    const result = await syncData();
    expect(result).toBe(true);

    // Verify active reading is still there, but tombstone reading is completely purged
    const raw = await loadRawReadings();
    expect(raw).toHaveLength(1);
    expect(raw[0].id).toBe('active-1');
  });
});
