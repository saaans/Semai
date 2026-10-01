import type { AbsenResponse } from "./schemas";

/**
 * Antrean absen di HP (IndexedDB). Absen yang gagal terkirim karena sinyal
 * disimpan di sini lalu dikirim saat online. Jam resmi tetap jam terkirim;
 * jam HP hanya ikut sebagai info.
 */
export type AbsenPayload = {
  /** Pemilik antrean. HP yang dipakai bergantian tidak mengirim absen orang lain. */
  userId: string;
  requestId: string;
  action: "masuk" | "pulang";
  companyId: string;
  lat: number;
  lng: number;
  accuracy: number;
  photo: Blob;
  deviceCapturedAt: string;
  offline: boolean;
};

export type QueuedAbsen = AbsenPayload & { queuedAt: number };

const DB_NAME = "semai-absen";
const STORE = "antrean";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "requestId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function enqueueAbsen(payload: AbsenPayload): Promise<void> {
  const item: QueuedAbsen = { ...payload, offline: true, queuedAt: Date.now() };
  await withStore("readwrite", (store) => store.put(item));
}

export async function listQueue(userId: string, companyId?: string): Promise<QueuedAbsen[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await withStore<QueuedAbsen[]>("readonly", (store) => store.getAll());
  return all
    .filter((item) => item.userId === userId && (!companyId || item.companyId === companyId))
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

async function removeFromQueue(requestId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(requestId));
}

/** Kirim satu absen. Gagal jaringan = retry: true. */
export async function sendAbsen(payload: AbsenPayload): Promise<AbsenResponse> {
  const body = new FormData();
  body.set("action", payload.action);
  body.set("companyId", payload.companyId);
  body.set("requestId", payload.requestId);
  body.set("lat", String(payload.lat));
  body.set("lng", String(payload.lng));
  body.set("accuracy", String(Math.round(payload.accuracy)));
  body.set("offline", String(payload.offline));
  body.set("deviceCapturedAt", payload.deviceCapturedAt);
  body.set("photo", payload.photo, "absen.jpg");

  try {
    const res = await fetch("/api/absen", { method: "POST", body, credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as AbsenResponse | null;
    if (json) return json;
    return { ok: false, retry: true, message: "Server tidak menjawab. Absen dikirim lagi nanti." };
  } catch {
    return { ok: false, retry: true, message: "Tidak ada sinyal. Absen dikirim lagi nanti." };
  }
}

export type FlushResult = {
  sent: number;
  /** Absen yang ditolak server (misal di luar radius); sudah dibuang dari antrean. */
  rejected: { action: "masuk" | "pulang"; message: string }[];
};

let flushing: Promise<FlushResult> | null = null;

/**
 * Kirim semua antrean milik user ini berurutan (masuk sebelum pulang).
 * Berhenti saat sinyal hilang lagi.
 */
export function flushQueue(userId: string): Promise<FlushResult> {
  flushing ??= (async () => {
    const result: FlushResult = { sent: 0, rejected: [] };
    try {
      for (const item of await listQueue(userId)) {
        const res = await sendAbsen(item);
        if (res.ok) {
          result.sent += 1;
          await removeFromQueue(item.requestId);
        } else if (res.retry) {
          break;
        } else {
          result.rejected.push({ action: item.action, message: res.message });
          await removeFromQueue(item.requestId);
        }
      }
    } finally {
      flushing = null;
    }
    return result;
  })();
  return flushing;
}
