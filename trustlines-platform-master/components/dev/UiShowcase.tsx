'use client';

import * as React from 'react';
import { BriefcaseBusinessIcon, CircleCheckIcon, HourglassIcon, InfoIcon, PlusIcon, XIcon } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { CurrencyCell } from '@/components/ui/currency-cell';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <header>
          <h1 className="text-xl font-bold text-primary-950">Base components</h1>
          <p className="text-[12px] text-primary-500">
            components/ui — compare with Figma TRUST-LINES-ERP › DAY 03 › Components. Tab through the page to check keyboard focus.
          </p>
        </header>

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
              <Label>Status badges (Status Language tones)</Label>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="neutral" icon={<CircleCheckIcon />}>Neutral</Badge>
                <Badge tone="info">Info</Badge>
                <Badge tone="accent" icon={<HourglassIcon />}>Pending Review</Badge>
                <Badge tone="warning">Warning</Badge>
                <Badge tone="success" icon={<CircleCheckIcon />}>Approved</Badge>
                <Badge tone="error">Rejected</Badge>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </TooltipProvider>
  );
}
