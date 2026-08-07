'use client';

import { Dialog } from '@/components/dialog';
import { ActionForm } from '@/components/action-form';

import { createDeliverySite, updateDeliverySite } from './actions';

type DeliverySiteFields = {
  id: string;
  name: string;
};

function Fields({ site }: { site?: DeliverySiteFields }) {
  return (
    <div>
      <label className="label">Name</label>
      <input
        name="name"
        required
        defaultValue={site?.name}
        className="input"
        placeholder="Warehouse A"
      />
    </div>
  );
}

export function AddDeliverySiteButton() {
  return (
    <Dialog
      title="Add a delivery site"
      trigger={(open) => (
        <button type="button" className="btn-primary" onClick={open}>
          Add site
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={createDeliverySite}
          submitLabel="Add site"
          className="space-y-3"
          onSuccess={close}
        >
          <Fields />
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditDeliverySiteDialog({ site }: { site: DeliverySiteFields }) {
  return (
    <Dialog
      title={`Edit ${site.name}`}
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          Edit
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={updateDeliverySite}
          submitLabel="Save changes"
          resetOnSuccess={false}
          className="space-y-3"
          onSuccess={close}
        >
          <input type="hidden" name="id" value={site.id} />
          <Fields site={site} />
        </ActionForm>
      )}
    </Dialog>
  );
}
