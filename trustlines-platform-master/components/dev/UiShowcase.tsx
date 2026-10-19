'use client';

import * as React from 'react';
import { BadgeAlertIcon, BriefcaseBusinessIcon, CheckIcon, CircleCheckIcon, ClipboardListIcon, ClockIcon, DollarSignIcon, InboxIcon, InfoIcon, PlusIcon, SearchXIcon, SendIcon, Trash2Icon, UsersIcon, XIcon } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { DocStatusBadge } from '@/components/platform/projects/plan-layout/shared';
import { STATUS_TAGS, type StatusGroup } from '@/lib/status/tags';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { CurrencyCell } from '@/components/ui/currency-cell';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { KpiCard, KpiCardRow } from '@/components/ui/kpi-card';
import { ConfirmModal, Modal, ModalClose, ModalContent, ModalTrigger, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Skeleton, SkeletonCard, SkeletonGroup, SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { feedback } from '@/components/ui/feedback-toast';
import { FilesEmptyState } from '@/components/platform/shared/FilesEmptyState';

const OPTIONS = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[4px] border border-ui-divider bg-ui-surface-elevated p-4">
      <h2 className="mb-4 text-[13px] font-semibold text-primary-950">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-medium text-primary-500">{children}</div>;
}

export function UiShowcase() {
  const [date, setDate] = React.useState<Date | null>(new Date(2026, 4, 22));
  const [tags, setTags] = React.useState<string[]>(['urgent']);
  const [page, setPage] = React.useState(1);
  const [hidden, setHidden] = React.useState(false);
  const [confirmResult, setConfirmResult] = React.useState<string | null>(null);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <header>
          <h1 className="text-xl font-bold text-primary-950">Base components</h1>
          <p className="text-[12px] text-primary-500">
            components/ui — compare with Figma TRUST-LINES-ERP › DAY 03 › Components. Tab through the page to check keyboard focus.
          </p>
        </header>

        <Panel title="Foundations (Figma DAY 02 › Task 5)">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <Label>Text sizes</Label>
              <div className="space-y-1 text-primary-950">
                <div className="text-h1">Heading H1 · 36</div>
                <div className="text-h2">Heading H2 · 30</div>
                <div className="text-h3">Heading H3 · 24</div>
                <div className="text-h4">Heading H4 · 20</div>
                <div className="text-body-lg">Body Large · 18</div>
                <div className="text-body">Body Default · 16</div>
                <div className="text-body-sm">Body Small · 14</div>
                <div className="text-meta">Helper / Metadata · 13</div>
                <div className="text-caption">Caption / small · 12</div>
              </div>
            </div>
            <div>
              <Label>Shadows</Label>
              <div className="grid grid-cols-2 gap-4 p-2">
                {(['shadow-01', 'shadow-02', 'shadow-03', 'shadow-04'] as const).map((s, i) => (
                  <div key={s} className={`grid h-16 place-items-center rounded-card bg-ui-surface-elevated text-caption text-primary-500 ${s}`}>
                    Shadow/0{i + 1}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Corner radius</Label>
                <div className="flex flex-wrap gap-3">
                  {[
                    ['rounded-tag', '4 · tags, compact inputs'],
                    ['rounded-control', '8 · buttons, dropdowns'],
                    ['rounded-card', '12 · cards, panels'],
                    ['rounded-modal', '16 · modals'],
                  ].map(([cls, label]) => (
                    <div key={cls} className="flex flex-col items-center gap-1">
                      <div className={`size-12 border border-primary-700 bg-primary-50 ${cls}`} />
                      <span className="max-w-20 text-center text-[10px] text-primary-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Spacing (Tailwind scale)</Label>
                <div className="flex items-end gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map(n => (
                    <div key={n} className="flex flex-col items-center gap-1">
                      <div className="w-3 bg-accent-500" style={{ height: n * 4 }} />
                      <span className="text-[9px] text-primary-500">{n * 4}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Buttons">
          <div className="grid grid-cols-4 gap-x-6 gap-y-3">
            {['Default', 'Hover/click (hover me)', 'Loading', 'Ghost / disabled'].map((h) => (
              <Label key={h}>{h}</Label>
            ))}
            <Button><BriefcaseBusinessIcon />Primary Button</Button>
            <Button className="bg-primary-700"><BriefcaseBusinessIcon />Primary Button</Button>
            <Button loading><BriefcaseBusinessIcon />Primary Button</Button>
            <Button disabled><BriefcaseBusinessIcon />Primary Button</Button>

            <Button variant="secondary">Secondary Button</Button>
            <Button variant="secondary" className="border-primary-700 text-primary-700">Secondary Button</Button>
            <Button variant="secondary" loading>Secondary Button</Button>
            <Button variant="secondary" disabled>Secondary Button</Button>

            <Button size="icon" aria-label="Close"><XIcon /></Button>
            <Button size="icon" aria-label="Close" className="bg-primary-700"><XIcon /></Button>
            <Button size="icon" aria-label="Close" loading><XIcon /></Button>
            <Button size="icon" aria-label="Close" disabled><XIcon /></Button>
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div><Label>S</Label><Button size="sm"><BriefcaseBusinessIcon />Primary Button</Button></div>
            <div><Label>M</Label><Button size="md"><BriefcaseBusinessIcon />Primary Button</Button></div>
            <div><Label>L</Label><Button size="lg"><BriefcaseBusinessIcon />Primary Button</Button></div>
            <div><Label>Load more (outline, M)</Label><Button variant="outline" size="md">Load More<PlusIcon /></Button></div>
          </div>
        </Panel>

        <Panel title="Form Components">
          <div className="grid grid-cols-[232px_140px_1fr] gap-x-5 gap-y-3">
            <div className="space-y-3">
              <Input placeholder="Text Input..." aria-label="Text input" />
              <Textarea placeholder="Text Area..." aria-label="Text area" />
              <Input placeholder="Invalid input" aria-label="Invalid input" aria-invalid />
              <Input placeholder="Disabled input" aria-label="Disabled input" disabled />
            </div>
            <div className="space-y-3">
              <Combobox options={OPTIONS} placeholder="Combo box.." aria-label="Combo box" />
              <Select options={OPTIONS} placeholder="Dropdown" aria-label="Dropdown" />
              <Select options={OPTIONS} placeholder="Disabled" aria-label="Disabled dropdown" disabled />
            </div>
            <div className="space-y-4">
              <div className="flex gap-10">
                <div>
                  <Label>Checkbox</Label>
                  <div className="flex gap-1.5">
                    <Checkbox aria-label="Unchecked" />
                    <Checkbox aria-label="Checked" defaultChecked />
                    <Checkbox aria-label="Disabled" disabled />
                  </div>
                </div>
                <div>
                  <Label>Radio Buttons</Label>
                  <RadioGroup defaultValue="b" aria-label="Radio example" className="gap-1.5">
                    <RadioGroupItem value="a" aria-label="Option A" />
                    <RadioGroupItem value="b" aria-label="Option B" />
                  </RadioGroup>
                </div>
                <div>
                  <Label>Switch</Label>
                  <div className="flex gap-1.5">
                    <Switch aria-label="Off" />
                    <Switch aria-label="On" defaultChecked />
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <DatePicker placeholder="Start Date" aria-label="Start date" />
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Other Components">
          <div className="grid grid-cols-[150px_220px_1fr] gap-x-8 gap-y-5">
            <div className="flex flex-col items-start gap-2">
              <Label>Badge S / M / L</Label>
              <Badge tone="success" size="sm">Status (S)</Badge>
              <Badge tone="success" size="md">Status (M)</Badge>
              <Badge tone="success" size="lg">Status (L)</Badge>
            </div>
            <div className="space-y-4">
              <div><Label>Tag input</Label><TagInput value={tags} onValueChange={setTags} /></div>
              <div>
                <Label>Tooltip (hover or focus)</Label>
                <Tooltip>
                  <TooltipTrigger render={<Button variant="outline" size="sm" />}>Show tooltip</TooltipTrigger>
                  <TooltipContent><InfoIcon className="size-4" />Tooltip</TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Label>Tabs</Label>
                <Tabs defaultValue="1">
                  <TabsList>
                    <TabsTrigger value="1">Tab 1</TabsTrigger>
                    <TabsTrigger value="2">Tab 2</TabsTrigger>
                  </TabsList>
                  <TabsContent value="1" className="text-[11px] text-primary-500">First tab content</TabsContent>
                  <TabsContent value="2" className="text-[11px] text-primary-500">Second tab content</TabsContent>
                </Tabs>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Breadcrumb</Label>
                <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Others', href: '/settings' }, { label: 'Personal information' }]} />
              </div>
              <div><Label>Pagination</Label><Pagination page={page} pageCount={8} onPageChange={setPage} /></div>
              <div>
                <Label>Currency cell</Label>
                <div className="flex items-center gap-1.5">
                  <CurrencyCell amount={1000.98} hidden={hidden} />
                  <CurrencyCell amount={1000.98} hidden />
                  <Switch aria-label="Hide amount" checked={hidden} onCheckedChange={setHidden} />
                </div>
              </div>
            </div>
            <div className="col-span-3">
              <Label>Avatar sizes (icon / initials)</Label>
              <div className="flex items-end gap-3">
                <Avatar size="xs" /><Avatar size="sm" /><Avatar size="md" /><Avatar size="lg" /><Avatar size="xl" />
                <Avatar size="md" name="Fatma Demir" />
              </div>
            </div>
            <div className="col-span-3">
              <Label>Status Chip tones T0–T10 (Figma &quot;Status Colors&quot;) — light / dark</Label>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {(['', 'dark'] as const).map(mode => (
                  <div key={mode || 'light'} className={`${mode} flex flex-wrap gap-x-3 gap-y-2 rounded-card p-3 ${mode ? 'bg-primary-950' : 'border border-ui-divider bg-ui-surface-elevated'}`}>
                    {(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'] as const).map(t => (
                      <div key={t} className="flex flex-col items-center gap-1">
                        <span className="inline-flex h-6 items-center gap-1 rounded-tag px-2.5 text-[11px] font-medium" style={{ background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` }}>
                          <CircleCheckIcon className="size-3.5" />Status
                        </span>
                        <span className={`text-[10px] font-semibold ${mode ? 'text-primary-50' : 'text-primary-800'}`}>{t.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Label>Status tags — tone + icon + label per status (lib/status/tags.ts → &lt;StatusBadge&gt;)</Label>
              {(['', 'dark'] as const).map(mode => (
                <div key={mode || 'light'} className={`${mode} mb-4 grid gap-4 rounded-card p-3 md:grid-cols-2 xl:grid-cols-3 ${mode ? 'bg-primary-950' : ''}`}>
                  {(Object.keys(STATUS_TAGS) as StatusGroup[]).map(group => (
                    <div key={group} className="rounded-card border border-ui-divider bg-ui-surface p-3">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="text-meta font-semibold text-ui-heading">{STATUS_TAGS[group].title}</span>
                        <span className="text-[10px] text-ui-text-secondary">{STATUS_TAGS[group].tags.length} statuses</span>
                      </div>
                      <ul className="space-y-1.5">
                        {STATUS_TAGS[group].tags.map(t => (
                          <li key={t.key} className="grid grid-cols-[1fr_auto_7rem] items-center gap-3">
                            <StatusBadge group={group} status={t.key} />
                            <span className="text-[10px] font-semibold text-ui-body">{t.tone.toUpperCase()}</span>
                            <span className="truncate font-mono text-[10px] text-ui-text-secondary">{t.icon.displayName ?? ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Label>Sizes S / M / L, without icon, and an unmapped status:</Label>
                <StatusBadge group="production" status="in_production" size="sm" />
                <StatusBadge group="production" status="in_production" size="md" />
                <StatusBadge group="production" status="in_production" size="lg" />
                <StatusBadge group="approval" status="approved" showIcon={false} />
                <StatusBadge group="approval" status="Mystery status" />
              </div>
              <div className="mt-3 rounded-card border border-ui-divider p-3" data-testid="doc-status-check">
                <Label>Document status → tag (the real DocStatusBadge used on project documents, all 6 stored values)</Label>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {(['draft', 'pending_approval', 'revised', 'rejected', 'approved', 'signed'] as const).map(s => (
                    <li key={s} className="flex items-center justify-between gap-3">
                      <code className="text-[11px] text-primary-500">{s}</code>
                      <DocStatusBadge status={s} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="ERP components (Task 11) · Empty state">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Page / table level — with create action</Label>
              <EmptyState
                boxed
                icon={<UsersIcon />}
                title="No customers yet"
                description="Click “New customer” to add the first one."
                action={<Button size="sm"><PlusIcon />New customer</Button>}
              />
            </div>
            <div>
              <Label>Filtered list — nothing matches</Label>
              <EmptyState
                boxed
                icon={<SearchXIcon />}
                title="No contact matches your filters"
                description="Try a different search or clear the filters."
                action={<Button variant="outline" size="sm">Clear filters</Button>}
              />
            </div>
            <div>
              <Label>No action (read-only view)</Label>
              <EmptyState boxed icon={<Trash2Icon />} title="Trash is empty" description="Deleted items stay here for 30 days." />
            </div>
            <div>
              <Label>Small — inline inside a card</Label>
              <div className="rounded-card border border-ui-divider bg-ui-surface-elevated px-4 py-2">
                <div className="text-meta font-semibold text-primary-800">Contacts</div>
                <EmptyState size="sm" title="No contacts yet." />
                <EmptyState size="sm" icon={<InboxIcon />} title="No activity yet." description="Comments and changes will show here." />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="ERP components (Task 11) · Skeleton (loading placeholders)">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div><Label>Text (3 lines)</Label><SkeletonText /></div>
              <div><Label>Card (KPI / quick-view section)</Label><SkeletonCard /></div>
              <div>
                <Label>Custom shapes with &lt;Skeleton&gt;</Label>
                <SkeletonGroup className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-control" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </SkeletonGroup>
              </div>
            </div>
            <div><Label>Table (any list while it loads)</Label><SkeletonTable rows={5} /></div>
          </div>
        </Panel>

        <Panel title="ERP components (Task 11) · KPI card (Figma DAY 02 › Approval)">
          <Label>As in Figma: Approvals (up = good), Projects (down = bad), Tasks (wide, with list)</Label>
          <div className="grid gap-2.5 lg:grid-cols-[257px_257px_1fr]">
            <KpiCard icon={<CircleCheckIcon />} label="Approvals" value={14} trend={{ value: 3.5, context: 'versus last month' }} />
            <KpiCard icon={<BriefcaseBusinessIcon />} label="Projects" value={32} trend={{ value: -1.3, context: 'versus last month' }} />
            <KpiCard tone="muted" icon={<ClipboardListIcon />} label="Tasks" value={2}>
              <KpiCardRow tone="error" icon={<BadgeAlertIcon />} title="High Priority" subtitle="Provision - Approval Request" meta="10/09/2026" />
              <KpiCardRow tone="warning" icon={<BadgeAlertIcon />} title="Medium Priority" subtitle="Provision - Approval Request" meta="10/09/2026" />
            </KpiCard>
          </div>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label>Clickable (href) — hover / Tab</Label><KpiCard href="/leads" icon={<DollarSignIcon />} label="Pipeline value" value="$277K" /></div>
            <div><Label>Down is good (overdue)</Label><KpiCard icon={<ClockIcon />} label="Overdue" value={3} trend={{ value: -25, goodWhen: 'down' }} /></div>
            <div><Label>No change</Label><KpiCard icon={<SendIcon />} label="Proposal sent" value={3} trend={{ value: 0 }} /></div>
            <div><Label>Loading</Label><KpiCard icon={<CheckIcon />} label="Deals closed" value={0} loading /></div>
          </div>
        </Panel>

        <Panel title="ERP components (Task 11) · Modal">
          <p className="mb-3 text-meta text-primary-500">
            Open each one, then test the keyboard: Tab stays inside, Esc closes, focus returns to the button. Confirm dialogs ignore backdrop clicks.
          </p>
          <div className="flex flex-wrap gap-2">
            <Modal>
              <ModalTrigger render={<Button />}>Form modal (md)</ModalTrigger>
              <ModalContent
                title="Create a project"
                description="Turn an approved opportunity into a shared workspace."
                footer={<>
                  <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
                  <ModalClose render={<Button />}>Create project</ModalClose>
                </>}
              >
                <div className="space-y-3">
                  <div><label htmlFor="m-name" className="mb-1 block text-caption font-medium text-ui-body">Project name *</label><Input id="m-name" defaultValue="Northstar · CRM rollout" /></div>
                  <div><label htmlFor="m-client" className="mb-1 block text-caption font-medium text-ui-body">Client *</label><Select id="m-client" options={[{ value: 'northstar', label: 'Northstar Labs' }]} placeholder="Select client" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="m-owner" className="mb-1 block text-caption font-medium text-ui-body">Owner</label><Select id="m-owner" options={[{ value: 'maya', label: 'Maya Chen' }]} placeholder="Select owner" /></div>
                    <div><label htmlFor="m-due" className="mb-1 block text-caption font-medium text-ui-body">Due date</label><Input id="m-due" type="date" /></div>
                  </div>
                  <p className="text-caption text-ui-text-secondary">The client contact will not be notified until you invite them.</p>
                </div>
              </ModalContent>
            </Modal>

            <Modal>
              <ModalTrigger render={<Button variant="secondary" />}>Info modal (sm)</ModalTrigger>
              <ModalContent
                size="sm"
                title="Your project is ready"
                description="Everything your team needs is in one place."
                footer={<>
                  <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Not now</ModalClose>
                  <ModalClose render={<Button />}>Open project</ModalClose>
                </>}
              >
                <div className="space-y-4">
                  <StatusBadge group="project_stage" status="completed" label="Project created" size="sm" />
                  <p>Northstar · CRM rollout is ready. We&apos;ve carried over your client, owner and approved scope.</p>
                  <ul className="space-y-2.5 pl-2">
                    {['Invite your delivery team', 'Confirm milestones and due dates', 'Upload the signed statement of work'].map(step => (
                      <li key={step} className="flex items-center gap-2.5"><CircleCheckIcon className="size-4 shrink-0" aria-hidden />{step}</li>
                    ))}
                  </ul>
                </div>
              </ModalContent>
            </Modal>

            <Modal>
              <ModalTrigger render={<Button variant="outline" />}>Long content (lg, scrolls)</ModalTrigger>
              <ModalContent size="lg" title="Activity history" description="Body scrolls; header and footer stay put." footer={<ModalClose render={<Button variant="secondary" />}>Close</ModalClose>}>
                <ul className="space-y-2">
                  {Array.from({ length: 30 }, (_, i) => (
                    <li key={i} className="rounded-control bg-primary-50 px-3 py-2 text-meta">Change #{30 - i} — status updated by ZZTEST Ops Manager</li>
                  ))}
                </ul>
              </ModalContent>
            </Modal>

            <ConfirmModal
              trigger={<Button variant="outline">Confirm (archive)</Button>}
              title="Archive this lead?"
              description="It disappears from the board but stays searchable. You can restore it any time."
              confirmLabel="Archive"
              onConfirm={() => setConfirmResult('Archived (demo)')}
            />
            <ConfirmModal
              trigger={<Button variant="destructive"><Trash2Icon />Destructive confirm</Button>}
              tone="destructive"
              title="Delete this project?"
              description="Review what will move to Trash before continuing."
              warning="This removes the project from active work. Team members will lose access."
              confirmLabel="Move to Trash"
              onConfirm={() => new Promise<void>(r => setTimeout(() => { setConfirmResult('Moved to Trash after 1s save (demo)'); r(); }, 1000))}
            >
              <div className="space-y-1.5">
                <p className="font-semibold">Northstar · CRM rollout</p>
                <p className="text-ui-text-secondary">PRJ-2048 · Northstar Labs</p>
                <p>12 tasks, 4 documents and 8 comments will move with this project.</p>
              </div>
              <p className="text-ui-text-secondary">You can restore it from Trash for 30 days. After 15 Nov 2026, it will be permanently deleted.</p>
            </ConfirmModal>
          </div>
          {confirmResult && <p role="status" className="mt-3 text-meta text-success-dark">Last confirm: {confirmResult}</p>}
        </Panel>

        <Panel title="Feedback patterns · Toast">
          <p className="mb-3 text-meta text-primary-500">Toasts appear bottom-right. Success links to the record, info offers Undo, error offers Retry.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => feedback.success('Changes saved', { description: 'Northstar · CRM rollout is up to date.', action: { label: 'View project', href: '/projects' } })}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => feedback.info('Project moved to Trash', { description: 'PRJ-2048 can be restored for 30 days.', action: { label: 'Undo move', onClick: () => feedback.success('Project restored') } })}>
              Info toast (Undo)
            </Button>
            <Button variant="secondary" onClick={() => feedback.error('Upload interrupted', { description: 'proposal-v3.pdf could not be uploaded.', action: { label: 'Retry upload', onClick: () => feedback.success('Uploaded') } })}>
              Error toast (Retry)
            </Button>
          </div>
        </Panel>

        <Panel title="Feedback patterns · Empty state / first use">
          <div className="rounded-[8px] border border-ui-divider">
            <FilesEmptyState onUpload={() => feedback.info('Upload clicked (demo)')} hint="PDF, DWG, DXF and images" />
          </div>
        </Panel>
      </div>
    </TooltipProvider>
  );
}
