'use client';

import { useState } from 'react';

export type EmployeeRow = {
  name: string;
  staffId: string | null;
  department: string | null;
  status: 'confirmed' | 'not-received' | 'pending';
};

export type ReceiptGroup = {
  dishName: string;
  restaurantName: string;
  deliverySiteName: string;
  total: number;
  confirmed: number;
  notReceived: number;
  pending: number;
  employees: EmployeeRow[];
};

export function EmployeeReceiptTable({ groups }: { groups: ReceiptGroup[] }) {
  const [open, setOpen] = useState<ReceiptGroup | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Dish</th>
              <th>Restaurant</th>
              <th>Delivery Site</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={i}>
                <td className="font-medium text-slate-900">{g.dishName}</td>
                <td className="text-slate-500 text-sm">{g.restaurantName}</td>
                <td className="text-slate-600">{g.deliverySiteName}</td>
                <td className="num text-slate-700 font-medium">{g.total}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {g.confirmed > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ {g.confirmed} confirmed
                      </span>
                    )}
                    {g.pending > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ⏳ {g.pending} pending
                      </span>
                    )}
                    {g.notReceived > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        ✕ {g.notReceived} not received
                      </span>
                    )}
                    {g.confirmed === g.total && (
                      <span className="text-xs text-slate-400">All confirmed</span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => setOpen(g)}
                    className="btn-secondary btn-sm text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{open.dishName}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{open.restaurantName} · {open.deliverySiteName}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="text-emerald-700 font-medium">{open.confirmed} confirmed</span>
                  <span className="text-amber-700 font-medium">{open.pending} pending</span>
                  {open.notReceived > 0 && (
                    <span className="text-red-700 font-medium">{open.notReceived} not received</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="ml-4 text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Employee list */}
            <div className="overflow-y-auto px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Staff ID</th>
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {open.employees.map((emp, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-xs text-slate-400">{idx + 1}</td>
                      <td className="py-2 font-medium text-slate-900">{emp.name}</td>
                      <td className="py-2 font-mono text-xs text-slate-500">{emp.staffId ?? '—'}</td>
                      <td className="py-2 text-xs text-slate-500">{emp.department ?? '—'}</td>
                      <td className="py-2 text-xs font-medium">
                        {emp.status === 'confirmed' && <span className="text-emerald-600">Confirmed</span>}
                        {emp.status === 'not-received' && <span className="text-red-600">Not Received</span>}
                        {emp.status === 'pending' && <span className="text-amber-600">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button onClick={() => setOpen(null)} className="btn-secondary btn-sm text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
