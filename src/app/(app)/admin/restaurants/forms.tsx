'use client';

import { Dialog } from '@/components/dialog';
import { ActionForm } from '@/components/action-form';

import { createRestaurant, updateRestaurant } from './actions';

type RestaurantFields = {
  id: string;
  name: string;
  cuisine: string | null;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
};

function Fields({ restaurant }: { restaurant?: RestaurantFields }) {
  return (
    <>
      <div>
        <label className="label">Name</label>
        <input
          name="name"
          required
          defaultValue={restaurant?.name}
          className="input"
          placeholder="Nasi Kandar Pelita"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Cuisine</label>
          <input
            name="cuisine"
            defaultValue={restaurant?.cuisine ?? ''}
            className="input"
            placeholder="Mamak"
          />
        </div>
        <div>
          <label className="label">Contact</label>
          <input
            name="contactName"
            defaultValue={restaurant?.contactName ?? ''}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          name="contactPhone"
          defaultValue={restaurant?.contactPhone ?? ''}
          className="input"
          placeholder="03-1234 5678"
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={restaurant?.description ?? ''}
          className="input"
        />
      </div>
      <div>
        <label className="label">Address</label>
        <textarea
          name="address"
          rows={2}
          defaultValue={restaurant?.address ?? ''}
          className="input"
        />
      </div>
    </>
  );
}

export function AddRestaurantButton() {
  return (
    <Dialog
      title="Add a restaurant"
      trigger={(open) => (
        <button type="button" className="btn-primary" onClick={open}>
          Add restaurant
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={createRestaurant}
          submitLabel="Add restaurant"
          className="space-y-3"
          onSuccess={close}
        >
          <Fields />
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditRestaurantDialog({ restaurant }: { restaurant: RestaurantFields }) {
  return (
    <Dialog
      title={`Edit ${restaurant.name}`}
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          Edit
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={updateRestaurant}
          submitLabel="Save changes"
          resetOnSuccess={false}
          className="space-y-3"
          onSuccess={close}
        >
          <input type="hidden" name="id" value={restaurant.id} />
          <Fields restaurant={restaurant} />
        </ActionForm>
      )}
    </Dialog>
  );
}
