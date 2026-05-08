/**
 * RegistrationButton.tsx
 *
 * Component nút đăng ký workshop, xử lý đầy đủ:
 *   1. Sinh UUID v4 idempotency key, lưu sessionStorage trước khi gọi API.
 *   2. UI loading state khi đang gọi API.
 *   3. Rate limit 429 — countdown timer đọc từ header Retry-After (default 10s).
 *   4. Circuit Breaker 503 — banner cảnh báo, không disable nút vĩnh viễn.
 *   5. Payment timeout 504 — thông báo và cho phép retry.
 *   6. Idempotent replay (header X-Idempotent-Replayed) — xử lý trong suốt.
 *
 * Tham chiếu blueprint:
 *   - payment.md §2  — POST /api/registrations, response codes
 *   - payment.md §4  — Rate limit 429 + Retry-After header
 *   - payment.md §5  — Circuit Breaker 503
 *   - payment.md §6  — Idempotency Key: crypto.randomUUID(), sessionStorage[workshopId]
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/api';
import type { AxiosError } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationStatus =
  | 'CONFIRMED'
  | 'WAITLISTED'
  | 'PENDING'
  | 'CANCELLED';

interface RegistrationSuccessData {
  registrationId: string;
  workshopId: string;
  workshopTitle?: string;
  status: RegistrationStatus;
  qrCode: string | null;
  paymentStatus?: string;
  amount?: number;
  confirmedAt?: string;
  message?: string;
}

interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
}

// ─── Error state union ────────────────────────────────────────────────────────

type ErrorState =
  | { type: 'rate_limit'; retryAfter: number }   // 429 — countdown
  | { type: 'circuit_breaker'; message: string }  // 503 — CB open
  | { type: 'payment_timeout'; message: string }  // 504 — gateway timeout
  | { type: 'already_registered'; message: string } // 409
  | { type: 'generic'; message: string };          // catch-all

// ─── sessionStorage key helper ────────────────────────────────────────────────
const idemKey = (workshopId: string) => `idem_key_${workshopId}`;

/**
 * Lấy idempotency key đã lưu hoặc sinh mới.
 * Key phải tồn tại TRƯỚC khi gọi API để retry gửi đúng cùng key.
 * (payment.md §6: "sinh trước khi gọi API, lưu vào sessionStorage[workshopId]")
 */
function getOrCreateIdempotencyKey(workshopId: string): string {
  const storageKey = idemKey(workshopId);
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const newKey = crypto.randomUUID();
  sessionStorage.setItem(storageKey, newKey);
  return newKey;
}

/** Xóa key sau khi đăng ký thành công (tránh reuse cho lần đăng ký khác). */
function clearIdempotencyKey(workshopId: string): void {
  sessionStorage.removeItem(idemKey(workshopId));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RegistrationButtonProps {
  workshopId: string;
  workshopPrice: number;             // 0 = free, >0 = paid
  remainingSeats: number;
  alreadyRegistered?: boolean;
  onSuccess?: (data: RegistrationSuccessData) => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegistrationButton({
  workshopId,
  workshopPrice,
  remainingSeats,
  alreadyRegistered = false,
  onSuccess,
  className = '',
}: RegistrationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [countdown, setCountdown] = useState(0);   // seconds remaining for rate-limit
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup interval on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Start 429 countdown ────────────────────────────────────────────────────
  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setError(null);  // auto-clear rate limit error when timer hits 0
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
  }, []);

  // ── Main submit handler ────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (isLoading || countdown > 0) return;

    setIsLoading(true);
    setError(null);

    // Step 1: get-or-create idempotency key BEFORE the API call
    const idempotencyKey = getOrCreateIdempotencyKey(workshopId);

    try {
      const response = await api.post<{ status: number; data: RegistrationSuccessData }>(
        '/api/registrations',
        { workshopId },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );

      const data = response.data.data;

      // Idempotent replay (X-Idempotent-Replayed: true) — handled transparently;
      // the response shape is the same, so we treat it identically.

      // Step 2: clear the key only on definitive success/waitlist
      if (data.status === 'CONFIRMED' || data.status === 'WAITLISTED') {
        clearIdempotencyKey(workshopId);
      }

      onSuccess?.(data);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorBody>;
      const status = axiosError.response?.status;
      const code   = axiosError.response?.data?.code ?? '';
      const msg    = axiosError.response?.data?.message ?? 'Đã có lỗi xảy ra.';

      if (status === 429) {
        // Read Retry-After header from the server (payment.md §4: "Retry-After: 10")
        const retryAfterRaw = axiosError.response?.headers?.['retry-after'];
        const retryAfter = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 10;
        setError({ type: 'rate_limit', retryAfter });
        startCountdown(retryAfter);
        // Keep the idempotency key — user will retry with the same key
      } else if (status === 503 && code === 'PAYMENT_UNAVAILABLE') {
        setError({ type: 'circuit_breaker', message: msg });
        // Key stays — user may retry once CB recovers
      } else if (status === 504 && code === 'PAYMENT_TIMEOUT') {
        setError({ type: 'payment_timeout', message: msg });
        // Seat has been returned (server handles it); key stays for retry
      } else if (status === 409 && code === 'ALREADY_REGISTERED') {
        setError({ type: 'already_registered', message: msg });
        clearIdempotencyKey(workshopId);
      } else {
        setError({ type: 'generic', message: msg });
      }
    } finally {
      setIsLoading(false);
    }
  }, [workshopId, isLoading, countdown, startCountdown, onSuccess]);

  // ─── Derived display state ─────────────────────────────────────────────────

  const isFull      = remainingSeats <= 0;
  const isRateLimited = error?.type === 'rate_limit' && countdown > 0;
  const isDisabled  =
    isLoading ||
    alreadyRegistered ||
    isRateLimited;

  const isFree = workshopPrice === 0;

  function getButtonLabel(): string {
    if (alreadyRegistered) return 'Đã đăng ký';
    if (isLoading)         return 'Đang xử lý…';
    if (isRateLimited)     return `Thử lại sau ${countdown}s`;
    if (isFull)            return 'Vào danh sách chờ';
    if (isFree)            return 'Đăng ký miễn phí';
    return `Đăng ký — ${workshopPrice.toLocaleString('vi-VN')}đ`;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* ── Main button ── */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleRegister}
        aria-busy={isLoading}
        aria-label={getButtonLabel()}
        className={[
          'relative w-full rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          // Color variants
          alreadyRegistered
            ? 'cursor-default bg-green-100 text-green-700 focus-visible:ring-green-500'
            : isRateLimited
              ? 'cursor-not-allowed bg-amber-50 text-amber-700 focus-visible:ring-amber-400'
              : isDisabled
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] focus-visible:ring-indigo-500',
        ].join(' ')}
      >
        {/* Loading spinner */}
        {isLoading && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </span>
        )}

        {/* Rate-limit progress ring */}
        {isRateLimited && (
          <RateLimitRing
            seconds={countdown}
            total={error?.type === 'rate_limit' ? error.retryAfter : 10}
          />
        )}

        {getButtonLabel()}
      </button>

      {/* ── Error banners ── */}
      {error && <ErrorBanner error={error} countdown={countdown} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Circular countdown ring inside the button for rate-limit state */
function RateLimitRing({ seconds, total }: { seconds: number; total: number }) {
  const radius   = 8;
  const circ     = 2 * Math.PI * radius;
  const progress = ((total - seconds) / total) * circ;

  return (
    <span className="absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
        {/* track */}
        <circle
          cx="10" cy="10" r={radius}
          fill="none" stroke="#FDE68A" strokeWidth="2"
        />
        {/* progress */}
        <circle
          cx="10" cy="10" r={radius}
          fill="none"
          stroke="#D97706"
          strokeWidth="2"
          strokeDasharray={circ}
          strokeDashoffset={circ - progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
    </span>
  );
}

/** Error banner rendered below the button */
function ErrorBanner({
  error,
  countdown,
}: {
  error: ErrorState;
  countdown: number;
}) {
  if (error.type === 'rate_limit') {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {/* Clock icon */}
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-medium">Quá nhiều yêu cầu</p>
          <p className="text-amber-700">
            Nút sẽ tự động mở lại sau{' '}
            <span className="font-bold tabular-nums">{countdown}</span> giây.
          </p>
        </div>
      </div>
    );
  }

  if (error.type === 'circuit_breaker') {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"
      >
        {/* Bolt icon */}
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-orange-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div>
          <p className="font-medium">Hệ thống thanh toán đang gián đoạn</p>
          <p className="text-orange-700">{error.message}</p>
          <p className="mt-1 text-xs text-orange-600">
            Bạn vẫn có thể xem và tìm kiếm workshop bình thường.
          </p>
        </div>
      </div>
    );
  }

  if (error.type === 'payment_timeout') {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {/* Refresh icon */}
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div>
          <p className="font-medium">Thanh toán thất bại</p>
          <p className="text-red-700">{error.message}</p>
        </div>
      </div>
    );
  }

  if (error.type === 'already_registered') {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
      >
        {/* Checkmark icon */}
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>{error.message}</p>
      </div>
    );
  }

  // generic
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {/* Warning icon */}
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p>{error.message}</p>
    </div>
  );
}
