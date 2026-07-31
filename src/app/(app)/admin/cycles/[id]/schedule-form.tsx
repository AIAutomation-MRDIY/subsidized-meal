'use client';

import { ActionForm } from '@/components/action-form';

import { updateCycleWindow } from '../actions';

export function ScheduleForm({
  cycleId,
  title,
  notes,
  orderOpenAt,
  orderCutoffAt,
  disabled,
}: {
  cycleId: string;
  title: string | null;
  notes: string | null;
  orderOpenAt: string;
  orderCutoffAt: string;
  disabled: boolean;
}) {
  return (
    <ActionForm
      action={updateCycleWindow}
      submitLabel="Save schedule"
      resetOnSuccess={false}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={cycleId} />

      <div>
        <label className="label">Title</label>
        <input name="title" defaultValue={title ?? ''} className="input" disabled={disabled} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Ordering opens</label>
          <input
            name="orderOpenAt"
            type="datetime-local"
            required
            defaultValue={orderOpenAt}
            className="input"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="label">Ordering cutoff</label>
          <input
            name="orderCutoffAt"
            type="datetime-local"
            required
            defaultValue={orderCutoffAt}
            className="input"
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="label">Notes for staff</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={notes ?? ''}
          className="input"
          disabled={disabled}
          placeholder="Collection point is Level 3 pantry from 12:15 pm."
        />
      </div>
    </ActionForm>
  );
}
