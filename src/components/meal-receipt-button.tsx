'use client';

/**
 * Meal receipt button shown next to each PAID order item on service day.
 *
 * Three states:
 *   unset      → primary "I received" button + small "I didn't receive" link
 *   confirmed  → green badge + optional Undo  (employee or system)
 *   notReceived → red badge + optional Undo   (mirrors confirmed exactly)
 *
 * Both marking actions are symmetrical: no cutoff block on mark, cutoff
 * blocks undo. Admin is alerted via the kitchen-page banner (queried
 * server-side from notReceivedAt).
 */

import { useState, useTransition } from 'react';
import {
  confirmMealReceived,
  undoMealReceived,
  markMealNotReceived,
  undoMealNotReceived,
} from '@/app/(app)/menu/actions.receipt';

type Props = {
  orderItemId: string;
  receivedAt: Date | string | null;
  receivedBySystem: boolean;
  notReceivedAt: Date | string | null;
  canUndo: boolean;
  receivedAtLabel?: string;
};

export function MealReceiptButton({
  orderItemId,
  receivedAt,
  receivedBySystem,
  notReceivedAt,
  canUndo,
  receivedAtLabel,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'unset' | 'confirmed' | 'notReceived'>(
    notReceivedAt ? 'notReceived' : receivedAt ? 'confirmed' : 'unset',
  );
  const [bySystem, setBySystem] = useState(receivedBySystem);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
      else onOk();
    });
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────
  if (state === 'confirmed') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {bySystem ? 'Auto-confirmed at 6 PM' : 'Received'}
          </span>
          {receivedAtLabel && <span className="text-xs text-slate-400">{receivedAtLabel}</span>}
          {canUndo && !bySystem && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => undoMealReceived(orderItemId), () => setState('unset'))}
              className="text-xs text-slate-400 underline decoration-dotted hover:text-slate-600 disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Not received ──────────────────────────────────────────────────────────
  if (state === 'notReceived') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Not Received — Admin Alerted
          </span>
          {canUndo && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => undoMealNotReceived(orderItemId), () => setState('unset'))}
              className="text-xs text-slate-400 underline decoration-dotted hover:text-slate-600 disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Unset — primary confirm + secondary not-received link ─────────────────
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(
            () => confirmMealReceived(orderItemId),
            () => { setState('confirmed'); setBySystem(false); },
          )
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Working…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            I received my meal
          </>
        )}
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(
            () => markMealNotReceived(orderItemId),
            () => setState('notReceived'),
          )
        }
        className="self-start text-xs text-slate-400 underline decoration-dotted hover:text-red-600 disabled:opacity-50"
      >
        I did not receive my meal
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
