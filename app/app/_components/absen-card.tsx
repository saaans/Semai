"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { compressFile, compressPhoto } from "@/lib/attendance/compress";
import { distanceMeters } from "@/lib/attendance/geo";
import {
  enqueueAbsen,
  flushQueue,
  listQueue,
  sendAbsen,
  type AbsenPayload,
  type QueuedAbsen,
} from "@/lib/attendance/queue";
import type { AbsenLocation, AttendanceMode, TodayState } from "@/lib/attendance/today";
import { formatMinutes, formatTime } from "@/lib/format";

type Step = "idle" | "kamera" | "cek" | "kirim";
type Action = "masuk" | "pulang";
type Position = { lat: number; lng: number; accuracy: number };
type Photo = { blob: Blob; url: string; capturedAt: string };

const LABEL: Record<Action, string> = { masuk: "Absen masuk", pulang: "Absen pulang" };

/** Akurasi GPS di atas ini diberi peringatan (tetap boleh kirim; server yang memutuskan). */
const WEAK_GPS_M = 100;

export function AbsenCard({
  userId,
  companyId,
  timezone,
  mode,
  location,
  today,
  isWorkDay,
}: {
  userId: string;
  companyId: string;
  timezone: string;
  mode: AttendanceMode;
  location: AbsenLocation | null;
  today: TodayState;
  isWorkDay: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [action, setAction] = useState<Action>("masuk");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pending, setPending] = useState<QueuedAbsen[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchRef = useRef<number | null>(null);
  const requestIdRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // Antrean offline
  // ---------------------------------------------------------------------------

  const refreshQueue = useCallback(async () => {
    try {
      setPending(await listQueue(userId, companyId));
    } catch {
      setPending([]);
    }
  }, [userId, companyId]);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const result = await flushQueue(userId);
      await refreshQueue();
      if (result.rejected.length > 0) {
        setError(
          result.rejected
            .map((r) => `${LABEL[r.action]} yang tersimpan di HP ditolak: ${r.message}`)
            .join(" "),
        );
      }
      if (result.sent > 0) {
        setNotice("Absen yang tersimpan di HP sudah terkirim.");
        router.refresh();
      }
    } catch {
      // IndexedDB tidak tersedia (mode penyamaran): tidak ada antrean.
    }
  }, [userId, refreshQueue, router]);

  useEffect(() => {
    // Baca antrean setelah render pertama, lalu kirim kalau ada sinyal.
    const timer = setTimeout(() => void refreshQueue().then(flush), 0);
    window.addEventListener("online", flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", flush);
    };
  }, [refreshQueue, flush]);

  // ---------------------------------------------------------------------------
  // Kamera dan GPS
  // ---------------------------------------------------------------------------

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const stopGps = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  useEffect(() => () => {
    stopCamera();
    stopGps();
  }, [stopCamera, stopGps]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera langsung tidak didukung di browser ini. Pakai tombol di bawah.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      attachVideo(videoRef.current);
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setCameraError(
        denied
          ? "Izin kamera ditolak. Ketuk ikon gembok di samping alamat situs > Izin > Kamera > Izinkan, lalu coba lagi. Atau pakai tombol di bawah."
          : "Kamera tidak bisa dibuka. Pakai tombol di bawah untuk mengambil foto.",
      );
    }
  }

  function startGps() {
    setPosition(null);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Browser ini tidak bisa membaca lokasi. Buka Semai di Chrome.");
      return;
    }
    stopGps();
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Ketuk ikon gembok di samping alamat situs > Izin > Lokasi > Izinkan, lalu coba lagi."
            : "Lokasi belum terbaca. Pastikan GPS menyala, lalu tunggu sebentar.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  }

  function keepPhoto(blob: Blob) {
    clearPhoto();
    setPhoto({ blob, url: URL.createObjectURL(blob), capturedAt: new Date().toISOString() });
    stopCamera();
    setStep("cek");
  }

  // ---------------------------------------------------------------------------
  // Tiga ketukan: mulai → ambil foto → kirim
  // ---------------------------------------------------------------------------

  async function start(next: Action) {
    setError(null);
    setNotice(null);
    setAction(next);
    requestIdRef.current = crypto.randomUUID();
    setStep("kamera");
    startGps();
    await startCamera();
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    try {
      keepPhoto(await compressPhoto(video));
    } catch {
      setError("Foto gagal diproses. Coba ambil lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      keepPhoto(await compressFile(file));
    } catch {
      setError("Foto gagal diproses. Coba ambil lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function retake() {
    clearPhoto();
    setError(null);
    setStep("kamera");
    await startCamera();
  }

  function cancel() {
    stopCamera();
    stopGps();
    clearPhoto();
    setError(null);
    setStep("idle");
  }

  function finish(message: string) {
    stopGps();
    clearPhoto();
    setStep("idle");
    setNotice(message);
    void refreshQueue();
  }

  async function send() {
    if (!photo || !position) return;
    setStep("kirim");
    setError(null);

    const payload: AbsenPayload = {
      userId,
      requestId: requestIdRef.current,
      action,
      companyId,
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      photo: photo.blob,
      deviceCapturedAt: photo.capturedAt,
      offline: false,
    };

    const online = navigator.onLine;
    const res = online
      ? await sendAbsen(payload)
      : ({ ok: false, retry: true, message: "" } as const);

    if (res.ok) {
      const late = res.lateMinutes > 0 ? ` Telat ${formatMinutes(res.lateMinutes)}.` : "";
      finish(`${LABEL[res.action]} tercatat jam ${formatTime(res.at, timezone)}.${late}`);
      router.refresh();
      return;
    }

    if (res.retry) {
      try {
        await enqueueAbsen(payload);
      } catch {
        setError("Absen belum terkirim dan tidak bisa disimpan di HP. Coba kirim lagi saat ada sinyal.");
        setStep("cek");
        return;
      }
      finish(
        "sessionExpired" in res && res.sessionExpired
          ? "Sesi kamu habis. Absen disimpan di HP dan dikirim setelah kamu masuk lagi."
          : `${online ? "Sinyal lemah" : "Tidak ada sinyal"}. Absen disimpan di HP dan dikirim otomatis saat ada sinyal. Jam resmi mengikuti jam terkirim.`,
      );
      if ("sessionExpired" in res && res.sessionExpired) router.push("/app/masuk");
      return;
    }

    setError(res.message);
    setStep("cek");
  }

  // ---------------------------------------------------------------------------
  // Tampilan
  // ---------------------------------------------------------------------------

  const lastPending = pending.at(-1);
  const state: TodayState["kind"] = lastPending
    ? lastPending.action === "masuk" && mode === "masuk_pulang"
      ? "masuk"
      : "selesai"
    : today.kind;
  const nextAction: Action | null =
    state === "belum" ? "masuk" : state === "masuk" && mode === "masuk_pulang" ? "pulang" : null;
  const blocked =
    nextAction === null
      ? null
      : !location
        ? "Lokasi absenmu belum diatur. Minta pemilik usaha mengatur lokasi absen."
        : nextAction === "masuk" && !isWorkDay
          ? "Hari ini bukan hari kerjamu. Absen hanya bisa di hari kerja sesuai jadwal."
          : null;

  const distance =
    position && location
      ? distanceMeters(position.lat, position.lng, location.latitude, location.longitude)
      : null;

  return (
    <Card className="flex flex-col gap-4">
      <StatusLine today={today} pending={pending} timezone={timezone} mode={mode} />

      {notice && step === "idle" && (
        <p role="status" className="rounded-button border border-stone bg-canvas px-3.5 py-3 text-sm text-graphite">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-button border border-danger px-3.5 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {step === "idle" && nextAction && (
        <>
          <Button
            fullWidth
            className="min-h-16 text-base"
            disabled={Boolean(blocked)}
            onClick={() => void start(nextAction)}
          >
            {LABEL[nextAction]}
          </Button>
          {blocked && <p className="text-sm text-smoke">{blocked}</p>}
        </>
      )}

      {step === "kamera" && (
        <div className="flex flex-col gap-3">
          {!cameraError && (
            <video
              ref={attachVideo}
              playsInline
              muted
              autoPlay
              onPlaying={() => setCameraReady(true)}
              className="aspect-3/4 w-full -scale-x-100 rounded-card bg-ink object-cover"
            />
          )}
          {cameraError && <p className="text-sm text-danger">{cameraError}</p>}
          {cameraError ? (
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-button bg-ink px-4 text-sm font-medium text-canvas">
              Buka kamera HP
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={onFile}
              />
            </label>
          ) : (
            <Button
              fullWidth
              onClick={() => void capture()}
              disabled={busy || !cameraReady}
              aria-busy={busy || !cameraReady}
            >
              {busy ? "Memproses foto…" : cameraReady ? "Ambil foto" : "Menyiapkan kamera…"}
            </Button>
          )}
          <GpsLine position={position} gpsError={gpsError} distance={distance} location={location} />
          <Button variant="secondary" arrow={false} onClick={cancel}>
            Batal
          </Button>
        </div>
      )}

      {(step === "cek" || step === "kirim") && photo && (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL lokal */}
          <img
            src={photo.url}
            alt="Selfie untuk absen"
            className="aspect-3/4 w-full rounded-card bg-ink object-cover"
          />
          <GpsLine position={position} gpsError={gpsError} distance={distance} location={location} />
          <Button
            fullWidth
            className="min-h-14 text-base"
            onClick={() => void send()}
            disabled={!position || step === "kirim"}
            aria-busy={step === "kirim"}
          >
            {step === "kirim" ? "Mengirim…" : !position ? "Menunggu lokasi…" : `Kirim ${LABEL[action].toLowerCase()}`}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" arrow={false} onClick={() => void retake()} disabled={step === "kirim"}>
              Foto ulang
            </Button>
            <Button variant="secondary" arrow={false} onClick={cancel} disabled={step === "kirim"}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusLine({
  today,
  pending,
  timezone,
  mode,
}: {
  today: TodayState;
  pending: QueuedAbsen[];
  timezone: string;
  mode: AttendanceMode;
}) {
  const time = (value: string) => formatTime(value, timezone);

  return (
    <div className="flex flex-col gap-2">
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="ink">Menunggu sinyal</Tag>
          <span className="text-sm text-smoke">
            {pending
              .map((p) => `${LABEL[p.action]} (diambil ${time(p.deviceCapturedAt)})`)
              .join(", ")}
          </span>
        </div>
      )}
      {today.kind === "belum" && pending.length === 0 && <Tag className="self-start">Belum absen</Tag>}
      {today.kind === "tercatat" && (
        <Tag className="self-start">Hari ini tercatat {today.status}</Tag>
      )}
      {(today.kind === "masuk" || today.kind === "selesai") && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={today.kind === "selesai" ? "neutral" : "accent"}>
            {today.kind === "masuk" ? "Sedang bekerja" : "Absen hari ini selesai"}
          </Tag>
          <span className="text-sm text-graphite">
            Masuk {time(today.clockInAt)}
            {today.kind === "selesai" && today.clockOutAt && ` · Pulang ${time(today.clockOutAt)}`}
          </span>
        </div>
      )}
      {(today.kind === "masuk" || today.kind === "selesai") && (
        <p className="text-sm text-smoke">
          {today.lateMinutes > 0 ? `Telat ${formatMinutes(today.lateMinutes)}` : "Tepat waktu"}
          {today.kind === "selesai" && today.overtimeMinutes > 0 &&
            ` · Lembur ${formatMinutes(today.overtimeMinutes)} (${
              today.overtimeStatus === "disetujui"
                ? "disetujui"
                : today.overtimeStatus === "ditolak"
                  ? "tidak disetujui"
                  : "menunggu persetujuan owner"
            })`}
          {today.kind === "selesai" && mode === "masuk" && " · Usaha ini cukup absen masuk"}
        </p>
      )}
    </div>
  );
}

function GpsLine({
  position,
  gpsError,
  distance,
  location,
}: {
  position: Position | null;
  gpsError: string | null;
  distance: number | null;
  location: AbsenLocation | null;
}) {
  if (gpsError && !position) return <p className="text-sm text-danger">{gpsError}</p>;
  if (!position) return <p className="text-sm text-smoke">Mencari lokasi…</p>;

  const accuracy = Math.round(position.accuracy);
  const outside = location && distance !== null && distance > location.radiusM;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {location && distance !== null && (
        <p className={outside ? "text-danger" : "text-smoke"}>
          {outside
            ? `Kamu sekitar ${distance} m dari ${location.name}. Absen hanya bisa dalam radius ${location.radiusM} m. Dekati lokasi lalu tunggu lokasi diperbarui.`
            : `Sekitar ${distance} m dari ${location.name} (radius ${location.radiusM} m).`}
        </p>
      )}
      {accuracy > WEAK_GPS_M && (
        <p className="text-ash">
          Sinyal GPS kurang akurat (±{accuracy} m). Tunggu sebentar atau pindah dekat jendela.
        </p>
      )}
    </div>
  );
}
