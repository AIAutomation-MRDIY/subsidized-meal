'use client';

import { useTranslations } from 'next-intl';

import { Dialog } from '@/components/dialog';
import { ActionForm } from '@/components/action-form';

import { createRestaurant, updateRestaurant } from './actions';

type RestaurantFields = {
  id: string;
  code: string | null;
  name: string;
  cuisine: string | null;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  isHalal: boolean;
};

function Fields({ restaurant }: { restaurant?: RestaurantFields }) {
  const t = useTranslations('restaurantsAdmin');
  const c = useTranslations('adminCommon');
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="label">{c('name')}</label>
          <input
            name="name"
            required
            defaultValue={restaurant?.name}
            className="input"
            placeholder={t('namePlaceholder')}
          />
        </div>
        <div>
          <label className="label">{t('code')}</label>
          <input
            name="code"
            defaultValue={restaurant?.code ?? ''}
            className="input uppercase"
            placeholder={t('codePlaceholder')}
            maxLength={40}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">{t('codeHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('cuisine')}</label>
          <input
            name="cuisine"
            defaultValue={restaurant?.cuisine ?? ''}
            className="input"
            placeholder={t('cuisinePlaceholder')}
          />
        </div>
        <div>
          <label className="label">{t('contact')}</label>
          <input
            name="contactName"
            defaultValue={restaurant?.contactName ?? ''}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="label">{t('phone')}</label>
        <input
          name="contactPhone"
          defaultValue={restaurant?.contactPhone ?? ''}
          className="input"
          placeholder={t('phonePlaceholder')}
        />
      </div>
      <div>
        <label className="label">{t('description')}</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={restaurant?.description ?? ''}
          className="input"
        />
      </div>
      <div>
        <label className="label">{t('address')}</label>
        <textarea
          name="address"
          rows={2}
          defaultValue={restaurant?.address ?? ''}
          className="input"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          name="isHalal"
          defaultChecked={restaurant?.isHalal ?? false}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm font-medium text-slate-700">Halal certified</span>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          HALAL
        </span>
      </label>
    </>
  );
}

export function AddRestaurantButton() {
  const t = useTranslations('restaurantsAdmin');
  return (
    <Dialog
      title={t('addARestaurant')}
      trigger={(open) => (
        <button type="button" className="btn-primary" onClick={open}>
          {t('addRestaurant')}
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={createRestaurant}
          submitLabel={t('addRestaurant')}
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
  const t = useTranslations('restaurantsAdmin');
  const c = useTranslations('adminCommon');
  return (
    <Dialog
      title={t('editRestaurant', { name: restaurant.name })}
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          {c('edit')}
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={updateRestaurant}
          submitLabel={c('saveChanges')}
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
