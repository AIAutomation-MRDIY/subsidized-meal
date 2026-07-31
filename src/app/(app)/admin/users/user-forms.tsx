'use client';

import { ActionForm } from '@/components/action-form';
import { Dialog } from '@/components/dialog';

import { createUser, resetPassword, updateUser } from './actions';

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Employee — order food' },
  { value: 'ADMIN', label: 'Administrator — full access' },
  { value: 'ANALYTICS', label: 'Analytics — dashboards only' },
  { value: 'FINANCE', label: 'Finance — revenue, subsidy, exports' },
] as const;

type UserFields = {
  id: string;
  name: string;
  email: string;
  staffId: string | null;
  department: string | null;
  role: 'ADMIN' | 'ANALYTICS' | 'FINANCE' | 'USER';
  authProvider: 'LOCAL' | 'LDAP' | 'OIDC';
};

function CreateUserFields({ departments }: { departments: string[] }) {
  return (
    <>
      <div>
        <label className="label">Work email</label>
        <input name="email" type="email" required className="input" placeholder="name@mrdiy.com" />
      </div>
      <div>
        <label className="label">Full name</label>
        <input name="name" required className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Staff ID</label>
          <input name="staffId" className="input" placeholder="EMP-01234" />
        </div>
        <div>
          <label className="label">Department</label>
          <input name="department" list="dept-list" className="input" />
          <datalist id="dept-list">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className="label">Role</label>
        <select name="role" defaultValue="USER" className="input">
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Temporary password</label>
        <input name="password" type="password" required className="input" autoComplete="new-password" />
        <p className="mt-1 text-xs text-slate-500">
          Minimum 10 characters with upper case, lower case and a number. Hand it over in person or
          through a password manager — do not send it by email or chat.
        </p>
      </div>
    </>
  );
}

export function AddUserButton({ departments }: { departments: string[] }) {
  return (
    <Dialog
      title="Add a user"
      trigger={(open) => (
        <button type="button" className="btn-primary" onClick={open}>
          Add user
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={createUser}
          submitLabel="Create user"
          className="space-y-3"
          onSuccess={close}
        >
          <CreateUserFields departments={departments} />
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditUserDialog({ user, departments }: { user: UserFields; departments: string[] }) {
  return (
    <Dialog
      title={`Edit ${user.name}`}
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          Edit
        </button>
      )}
    >
      {(close) => (
        <ActionForm
          action={updateUser}
          submitLabel="Save changes"
          resetOnSuccess={false}
          className="space-y-3"
          onSuccess={close}
        >
          <input type="hidden" name="id" value={user.id} />
          <div>
            <label className="label">Email</label>
            <input value={user.email} disabled className="input" />
            <p className="mt-1 text-xs text-slate-500">
              Signs in with {user.authProvider === 'LOCAL' ? 'a local password' : user.authProvider}.
            </p>
          </div>
          <div>
            <label className="label">Full name</label>
            <input name="name" required defaultValue={user.name} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Staff ID</label>
              <input name="staffId" defaultValue={user.staffId ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <input name="department" list="dept-list-edit" defaultValue={user.department ?? ''} className="input" />
              <datalist id="dept-list-edit">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" defaultValue={user.role} className="input">
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function ResetPasswordDialog({ user }: { user: Pick<UserFields, 'id' | 'name'> }) {
  return (
    <Dialog
      title={`Reset password for ${user.name}`}
      width="max-w-sm"
      trigger={(open) => (
        <button type="button" className="btn-secondary btn-sm" onClick={open}>
          Reset password
        </button>
      )}
    >
      {() => (
        <ActionForm action={resetPassword} submitLabel="Reset" resetOnSuccess={false} className="space-y-3">
          <input type="hidden" name="id" value={user.id} />
          <div>
            <label className="label">New temporary password</label>
            <input name="password" type="password" required className="input" autoComplete="new-password" />
            <p className="mt-1 text-xs text-slate-500">
              Give it to them directly. Never send credentials over email or chat.
            </p>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
