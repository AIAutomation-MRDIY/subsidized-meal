import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { describeRule } from '@/lib/subsidy';
import { formatDate, toDateKey } from '@/lib/cycle';
import { PageHeader, Section, EmptyState, Alert } from '@/components/ui';
import { InlineSubmit } from '@/components/action-form';

import { deleteSubsidyRule, toggleSubsidyRule } from './actions';
import { AddRuleButton, EditRuleDialog } from './rule-form';

export const dynamic = 'force-dynamic';

const TYPE_LABEL = {
  PERCENTAGE: 'Percentage',
  FIXED_PER_ITEM: 'Per item',
  FIXED_PER_DAY: 'Daily cap',
} as const;

export default async function SubsidiesPage() {
  await requireCapability('subsidy:manage');

  const rules = await prisma.subsidyRule.findMany({
    orderBy: [{ active: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
  });

  const departmentRows = await prisma.user.findMany({
    where: { department: { not: null } },
    distinct: ['department'],
    select: { department: true },
    orderBy: { department: 'asc' },
  });
  const departments = departmentRows.map((r) => r.department!).filter(Boolean);

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <>
      <PageHeader
        title="Company subsidies"
        subtitle="What MR DIY contributes towards each meal. Staff only ever see the price they pay."
        action={<AddRuleButton departments={departments} />}
      />

      {activeCount === 0 ? (
        <div className="mb-6">
          <Alert tone="warning">
            No active subsidy rules — staff currently pay the full menu price.
          </Alert>
        </div>
      ) : null}

      <Section title="Rules" description={`${activeCount} active of ${rules.length}`}>
          {rules.length === 0 ? (
          <EmptyState
            title="No subsidy rules"
            hint="Add one — for example RM 5.00 off each meal for everyone."
            action={<AddRuleButton departments={departments} />}
          />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Type</th>
                    <th>Benefit</th>
                    <th>Applies to</th>
                    <th className="num">Priority</th>
                    <th>Window</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-slate-900">{r.name}</td>
                      <td className="text-slate-600">{TYPE_LABEL[r.type]}</td>
                      <td className="text-slate-900">{describeRule(r)}</td>
                      <td className="text-slate-600">
                        {r.scope === 'ALL' ? 'Everyone' : (r.department ?? '—')}
                      </td>
                      <td className="num text-slate-600">{r.priority}</td>
                      <td className="text-xs text-slate-500">
                        {r.effectiveFrom || r.effectiveTo
                          ? `${r.effectiveFrom ? formatDate(r.effectiveFrom, 'long') : 'any'} → ${
                              r.effectiveTo ? formatDate(r.effectiveTo, 'long') : 'open'
                            }`
                          : 'Always'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <EditRuleDialog
                            rule={{
                              id: r.id,
                              name: r.name,
                              type: r.type,
                              value: r.value,
                              capSen: r.capSen,
                              scope: r.scope,
                              department: r.department,
                              priority: r.priority,
                              effectiveFrom: r.effectiveFrom ? toDateKey(r.effectiveFrom) : null,
                              effectiveTo: r.effectiveTo ? toDateKey(r.effectiveTo) : null,
                            }}
                            departments={departments}
                          />
                          <form action={toggleSubsidyRule}>
                            <input type="hidden" name="id" value={r.id} />
                            <InlineSubmit label={r.active ? 'Disable' : 'Enable'} />
                          </form>
                          <form action={deleteSubsidyRule}>
                            <input type="hidden" name="id" value={r.id} />
                            <InlineSubmit
                              label="Delete"
                              variant="danger"
                              confirm={`Delete "${r.name}"? Orders already paid are unaffected.`}
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

    </>
  );
}
