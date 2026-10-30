'use client';

import { Fragment, useState } from 'react';
import {
  DEFAULT_VISIBLE_COLUMNS, COLUMN_LABELS,
  computeProjectColor, projectColorCss, groupItemsByType, groupPoSignStatus, groupAllSent,
  statusCellCss, signStatusCellCss, vendorText, mapStatus, mapSignStatus,
  effUsd, effTl, toNumber, fmtDateCss,
  isDateColumn, isMoneyColumn, BOARD_CSS,
  type PSection, type PItem, type ColumnKey,
} from '@/lib/excel/projectsExcelExport';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronDown, ChevronRight, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';

// Figma "Production Board" (node 384:51717) orders RTR before RTD; the Excel export keeps its own order.
const COLS: ColumnKey[] = DEFAULT_VISIBLE_COLUMNS.map(c => (c === 'rtd' ? 'rtr' : c === 'rtr' ? 'rtd' : c));
const LABELS: Partial<Record<ColumnKey, string>> = {
  projectNo: 'Project #', poSignStatus: 'PO Status', pfUsd: 'PF/USD', pfTl: 'PF/TL', containerNo: 'Container#',
};
const WIDTHS: Partial<Record<ColumnKey, number>> = {
  projectNo: 118, type: 94, pfCode: 125, vendor: 231, orderType: 117, poSignStatus: 124, pfSignStatus: 124, status: 135,
  rdy: 102, snd: 124, pfUsd: 100, pfTl: 103, invoice: 101, invoiceTl: 117, paymentRule: 116,
};
const MONEY_COLS: ColumnKey[] = ['pfUsd', 'pfTl', 'invoice', 'invoiceTl'];
const BAR_COLORS = ['#414346', '#848484'];
const TEXT_ON_BAR = 'text-[#EEF2F6]';

const TD = 'whitespace-nowrap border-b border-ui-divider bg-ui-page-bg px-2 py-2.5 text-left align-middle text-[12px] text-ui-body';
const TYPE_TEXT = 'text-[14px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading';

function money(col: ColumnKey, n: number): string {
  const sym = col === 'pfUsd' || col === 'invoice' ? '$' : '₺';
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(value: unknown): string {
  const [d, m, y] = fmtDateCss(value).split('/');
  return y ? `${Number(m)}/${Number(d)}/${y}` : '';
}

function titleCase(label: string): string {
  return label.toLowerCase().replace(/(^|[\s(/])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());
}

function cellValue(col: ColumnKey, item: PItem): React.ReactNode {
  if (col === 'vendor')   return vendorText(item.vendor);
  if (isMoneyColumn(col)) return money(col, toNumber((item as Record<string, unknown>)[col] as number));
  if (isDateColumn(col))  return shortDate((item as Record<string, unknown>)[col]);
  const v = (item as Record<string, unknown>)[col];
  return v == null ? '' : String(v);
}

// Figma's red chips are pure red with white text; everything else keeps the Excel fill.
function Chip({ css, children }: { css: { bg: string; fg: string } | null; children: React.ReactNode }) {
  if (!children) return null;
  const red = css && ['#DC2626', '#FF0000'].includes(css.bg);
  return (
    <span
      className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] py-2 pl-2.5 pr-2 text-[12px] font-medium leading-4"
      style={{ background: red ? '#FF0000' : css?.bg ?? 'var(--status-t0-bg)', color: red ? '#FFFFFF' : css?.fg ?? 'var(--status-t0-fg)' }}
    >
      {children}
    </span>
  );
}

function OrderType({ value }: { value?: string | null }) {
  const tone = value ? 't0' : 't10';
  return <Chip css={{ bg: `var(--status-${tone}-bg)`, fg: `var(--status-${tone}-fg)` }}>{value || '-'}</Chip>;
}

function MoneyChip({ col, value }: { col: ColumnKey; value: number }) {
  return (
    <span className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2.5 pr-2 text-[12px] font-medium leading-4 text-[var(--color-secondary-700)] dark:text-ui-heading">
      {money(col, value)}
    </span>
  );
}

export function OperationalBoard({ sections }: { sections: PSection[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const nonEmpty = sections.filter(s => s.projects.length > 0);

  if (!nonEmpty.length) {
    return (
      <EmptyState
        icon={<Factory />}
        title="No production rows yet"
        description="Projects with production items will appear here grouped by region."
      />
    );
  }

  function toggle(key: string) {
    setCollapsed(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  const moneyStart = COLS.indexOf('pfUsd');
  const afterMoney = COLS.length - COLS.indexOf('invoiceTl') - 1;

  return (
    <div className="overflow-x-auto rounded-[8px] border border-ui-divider">
      <table className="w-full min-w-max border-collapse">
        <colgroup>
          {COLS.map(c => <col key={c} style={{ width: WIDTHS[c] ?? 107 }} />)}
        </colgroup>
        <thead>
          <tr>
            {COLS.map(col => (
              <th key={col} className="h-[46px] whitespace-nowrap border-b border-ui-divider bg-ui-surface px-2 text-left text-[12px] font-semibold leading-[1.4] text-ui-body">
                {LABELS[col] ?? COLUMN_LABELS[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nonEmpty.map((section, si) => {
            let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;

            const projectRows = section.projects.map((project, pi) => {
              const groups = groupItemsByType(project.items || []);
              const dataRowCount = groups.reduce((n, g) => n + g.items.length, 0);
              const projColor = projectColorCss(computeProjectColor(project));
              const barColor = BAR_COLORS[pi % BAR_COLORS.length];
              const key = `${section.label}:${project.projectNo}`;
              const isCollapsed = collapsed.has(key);
              const Chevron = isCollapsed ? ChevronRight : ChevronDown;

              const totals: Partial<Record<ColumnKey, number>> = {};
              for (const it of project.items || []) {
                totals.pfUsd = (totals.pfUsd ?? 0) + toNumber(it.pfUsd);
                totals.pfTl = (totals.pfTl ?? 0) + toNumber(it.pfTl);
                totals.invoice = (totals.invoice ?? 0) + toNumber(it.invoice);
                totals.invoiceTl = (totals.invoiceTl ?? 0) + toNumber(it.invoiceTl);
                secUsd += effUsd(it); secTl += effTl(it);
                secInv += toNumber(it.invoice); secInvTl += toNumber(it.invoiceTl);
              }

              let dataRowSeen = 0;
              const bodyRows: React.ReactNode[] = [];
              groups.forEach((group, gi) => {
                const allSent = groupAllSent(group.items);
                const poRollup = groupPoSignStatus(group.items);
                group.items.forEach((item, ii) => {
                  const isFirstDataRow = dataRowSeen === 0;
                  const isFirstOfGroup = ii === 0;
                  dataRowSeen++;
                  bodyRows.push(
                    <tr key={`${pi}-${gi}-${ii}`}>
                      {COLS.map(col => {
                        if (col === 'projectNo') {
                          if (!isFirstDataRow) return null;
                          return (
                            <td key={col} rowSpan={dataRowCount + 1} className="border-r border-ui-divider text-center text-[24px] font-medium text-[var(--ui-page-bg)]" style={{ background: projColor }}>
                              {String(project.projectNo)}
                            </td>
                          );
                        }
                        if (col === 'type') {
                          if (!isFirstOfGroup) return null;
                          return (
                            <td key={col} rowSpan={group.items.length} className={cn(TD, TYPE_TEXT)}
                              style={allSent ? { background: BOARD_CSS.typeAllSent.bg, color: BOARD_CSS.typeAllSent.fg } : undefined}>
                              {group.type}
                            </td>
                          );
                        }
                        if (col === 'poSignStatus') {
                          if (!isFirstOfGroup) return null;
                          return (
                            <td key={col} rowSpan={group.items.length} className={TD}>
                              <Chip css={signStatusCellCss(poRollup)}>{titleCase(poRollup)}</Chip>
                            </td>
                          );
                        }
                        if (col === 'orderType') return <td key={col} className={TD}><OrderType value={item.orderType} /></td>;
                        if (col === 'pfSignStatus') return <td key={col} className={TD}><Chip css={statusCellCss(item.pfSignStatus)}>{titleCase(mapSignStatus(item.pfSignStatus))}</Chip></td>;
                        if (col === 'status') return <td key={col} className={TD}><Chip css={statusCellCss(item.status)}>{titleCase(mapStatus(item.status))}</Chip></td>;
                        return (
                          <td key={col} className={cn(TD, (col === 'pfCode' || col === 'vendor') && 'text-[13px] leading-[1.4]', isMoneyColumn(col) && 'text-[var(--color-secondary-700)] dark:text-ui-heading')}>
                            {cellValue(col, item)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              });

              return (
                <Fragment key={`proj-${pi}`}>
                  <tr>
                    <td colSpan={COLS.length} className="border-b border-ui-divider p-2" style={{ background: barColor }}>
                      <button
                        type="button" onClick={() => toggle(key)} aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} project ${project.projectNo}`}
                        className={cn('flex items-center gap-4 border-0 bg-transparent p-0 text-left', TEXT_ON_BAR)}
                      >
                        <Chevron size={24} aria-hidden />
                        <span className="text-[16px] font-medium">
                          {isCollapsed && project.projectName ? `${project.projectNo} · ${project.projectName}` : project.projectName || project.projectNo}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed && bodyRows}
                  {!isCollapsed && (
                    <tr>
                      <td colSpan={moneyStart - 1} className={cn('px-4 py-2.5 text-[14px] font-semibold', TEXT_ON_BAR)} style={{ background: barColor }}>TOTAL</td>
                      {MONEY_COLS.map(col => (
                        <td key={col} className="px-2 py-2.5" style={{ background: barColor }}><MoneyChip col={col} value={totals[col] ?? 0} /></td>
                      ))}
                      <td colSpan={afterMoney} style={{ background: barColor }} />
                    </tr>
                  )}
                </Fragment>
              );
            });

            const secTotals: Partial<Record<ColumnKey, number>> = { pfUsd: secUsd, pfTl: secTl, invoice: secInv, invoiceTl: secInvTl };
            return (
              <Fragment key={`sec-${si}`}>
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-2 text-[14px] font-semibold" style={{ background: BOARD_CSS.sectionHeader.bg, color: BOARD_CSS.sectionHeader.fg }}>
                    {section.label}
                  </td>
                </tr>
                {projectRows}
                <tr>
                  <td colSpan={moneyStart} className="px-4 py-2.5 text-[14px] font-semibold" style={{ background: BOARD_CSS.sectionTotal.bg, color: BOARD_CSS.sectionTotal.fg }}>
                    {section.label.toUpperCase()} TOTALS
                  </td>
                  {MONEY_COLS.map(col => (
                    <td key={col} className="px-2 py-2.5" style={{ background: BOARD_CSS.sectionTotal.bg }}><MoneyChip col={col} value={secTotals[col] ?? 0} /></td>
                  ))}
                  <td colSpan={afterMoney} style={{ background: BOARD_CSS.sectionTotal.bg }} />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
