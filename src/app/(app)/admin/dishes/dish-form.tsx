'use client';

import { Dialog } from '@/components/dialog';
import { ActionForm } from '@/components/action-form';

import { createDish, updateDish } from './actions';

export type RestaurantOption = { id: string; name: string; active: boolean };

type DishFields = {
  id: string;
  restaurantId: string;
  name: string;
  priceSen: number;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
};

function Fields({
  restaurants,
  dish,
}: {
  restaurants: RestaurantOption[];
  dish?: DishFields;
}) {
  return (
    <>
      <div>
        <label className="label">Restaurant</label>
        <select name="restaurantId" required defaultValue={dish?.restaurantId ?? ''} className="input">
          <option value="" disabled>
            Choose a restaurant
          </option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="label">Dish name</label>
          <input name="name" required defaultValue={dish?.name} className="input" placeholder="Nasi Lemak Ayam" />
        </div>
        <div>
          <label className="label">Price (RM)</label>
          <input
            name="price"
            required
            inputMode="decimal"
            defaultValue={dish ? (dish.priceSen / 100).toFixed(2) : ''}
            className="input"
            placeholder="12.50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <input name="category" defaultValue={dish?.category ?? ''} className="input" placeholder="Main" />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input
            name="tags"
            defaultValue={dish?.tags.join(', ') ?? ''}
            className="input"
            placeholder="halal, spicy"
          />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea name="description" rows={2} defaultValue={dish?.description ?? ''} className="input" />
      </div>

      <div>
        <label className="label">Image URL</label>
        <input name="imageUrl" type="url" defaultValue={dish?.imageUrl ?? ''} className="input" />
      </div>
    </>
  );
}

export function AddDishButton({ restaurants }: { restaurants: RestaurantOption[] }) {
  return (
    <Dialog
      title="Add a dish"
      trigger={(open) => (
        <button
          type="button"
          className="btn-primary"
          onClick={open}
          disabled={restaurants.length === 0}
        >
          Add dish
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={createDish}
          submitLabel="Add dish"
          className="space-y-3"
          onSuccess={close}
        >
          <Fields restaurants={restaurants} />
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditDishDialog({
  dish,
  restaurants,
}: {
  dish: DishFields;
  restaurants: RestaurantOption[];
}) {
  return (
    <Dialog
      title={`Edit ${dish.name}`}
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          Edit
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={updateDish}
          submitLabel="Save changes"
          resetOnSuccess={false}
          className="space-y-3"
          onSuccess={close}
        >
          <input type="hidden" name="id" value={dish.id} />
          <Fields restaurants={restaurants} dish={dish} />
        </ActionForm>
      )}
    </Dialog>
  );
}
