import api from '../services/api';

let serverTimeOffset = 0;
let hasSynced = false;

/**
 * Synchronize local time with server time
 */
export async function syncServerTime() {
    try {
        const start = Date.now();
        const res = await api.getServerTime();
        const end = Date.now();

        // Estimate network latency (half of round-trip time)
        const latency = (end - start) / 2;
        const serverTime = new Date(res.serverTime).getTime();

        // Offset = (Server time adjusted for latency) - Client local time
        serverTimeOffset = (serverTime + latency) - end;
        hasSynced = true;
        console.log(`⏱️ Server Time Synced. Latency: ${latency.toFixed(1)}ms. Offset: ${serverTimeOffset}ms`);
    } catch (err) {
        console.error('⚠️ Failed to sync server time, falling back to local time.', err);
    }
}

/**
 * Returns a synced Date object utilizing the server offset
 */
export function getSyncedDate() {
    return new Date(Date.now() + serverTimeOffset);
}

/**
 * Check if the time has been successfully synchronized with the backend
 */
export function isTimeSynced() {
    return hasSynced;
}
