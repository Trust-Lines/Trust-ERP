'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLUMN_LABELS, computeProjectColor, groupItemsByType, groupAllSent, vendorText, effUsd, effTl, toNumber, isMoneyColumn,
  type PSection, type PItem, type PProject, type ColumnKey,
} from '@/lib/production/boardModel';
import { EmptyState } from '@/components/ui/empty-state';
import { Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useColumnWidths, type SizedColumn } from '@/components/ui/column-resize';
import { ConfirmModal } from '@/components/ui/modal';
import { ProjectMenu } from './ProjectMenu';
import type { ProductionAccess } from '@/lib/production/access';
import type { PfGroup } from './ProductionFlags';
import { EditItemPanel, OrderTypePicker, RowMenu, VendorPicker, useBoardLists, type PanelItem } from './BoardEditors';
import { normalizeSign, normalizeStatus, poRollup, signStyle, statusStyle } from '@/lib/production/statuses';
import {
  COLS, HEAD_H, LABELS, MONEY_COLS, NO_ACCESS, PROJECT_TONE, TD, WIDTHS, cellValue, sortForDisplay, toneBg, toneFg,
} from './operational-board/boardStyles';
import { OrderType } from './operational-board/BoardChips';
import { StatusCell, StatusMenu } from './operational-board/StatusCells';
import { GAP_W, PAY_COLS, PAY_GROUPS, PayCells, TITLE_H } from './operational-board/payments';
import {
  GrandTotalRow, ProjectHeadRow, ProjectNoCell, ProjectTotalRow, RegionBandRow, SectionTotalRow, TypeCell,
  type BoardSelection, type MoneyTotals,
} from './operational-board/BoardRows';
import { BoardColGroup, BoardHead } from './operational-board/BoardHead';
import { useBoardActions, type TypeGroupRef } from './operational-board/useBoardActions';
import { useStickyScrollbar } from './operational-board/useStickyScrollbar';

// ProductionFlags imports the status chip from here.
export { StatusChip } from './operational-board/StatusCells';

type TypeGroup = TypeGroupRef & { items: PItem[] };

export function OperationalBoard({ sections, access = NO_ACCESS, groups = [], onGroupsChanged, onSaved, groupRanks, selection, payments = false, payEdit = false }: {
  sections: PSection[];
  /** Payments: this role may type into the paid / date / invoice cells ("Edit payments"). */
  payEdit?: boolean;
  /** Payments page: the Accounting / Payments T Lines / Invoice & Receipt tables to the right. */
  payments?: boolean;
  /** Roles page → Production Board switches. */
  access?: ProductionAccess;
  groups?: PfGroup[]; onGroupsChanged?: () => void; onSaved?: () => void;
  /** Groups view: rank of "group|projectId|type" for the type cell's badge. */
  groupRanks?: Map<string, number>;
  /** Half toolbar: the selection box on each Project # cell, shown once "Select" was used. */
  selection?: BoardSelection;
}) {
  // Column widths like the accounting sheet: fit the widest text, drag a header edge to resize,
  // double-click to fit again; remembered in this browser.
  const allItems = useMemo(() => sections.flatMap(s => s.projects.flatMap(p => p.items ?? [])), [sections]);
  const sizing = useMemo<SizedColumn<PItem>[]>(() => COLS.map(col => ({
    id: col, label: LABELS[col] ?? COLUMN_LABELS[col],
    text: (it: PItem) => (col === 'projectNo' ? '' : col === 'pfSignStatus' ? signStyle(it.pfSignStatus).label
      : col === 'poSignStatus' ? signStyle(it.poSignStatus).label : col === 'status' ? statusStyle(it.status).label
      : String(cellValue(col, it) ?? '')),
    chip: col === 'orderType' || col === 'status' || col === 'pfSignStatus' || col === 'poSignStatus',
    min: WIDTHS[col] && (col === 'projectNo' || col === 'type') ? WIDTHS[col] : 64,
  })), []);
  const { width, startResize, fit } = useColumnWidths('production-tracker-widths', sizing, allItems);
  const typeLeft = width('projectNo');
  const canStatus = access.editStatus, canRows = access.editRows, canDelRows = access.deleteRows;
  // Without "Money columns" the four money columns and the TOTAL rows are left out.
  const cols = COLS.filter(c => (access.viewMoney || !MONEY_COLS.includes(c)) && (access.viewPf || (c !== 'pfCode' && c !== 'pfSignStatus')));

  const actions = useBoardActions({ sections, canStatus, onSaved });
  const lists = useBoardLists();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{ kind: 'vendor' | 'orderType'; item: PItem; rect: DOMRect } | null>(null);
  const [panel, setPanel] = useState<{ key: string; point: { x: number; y: number } } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ item: PItem; point: { x: number; y: number } } | null>(null);
  const [toDelete, setToDelete] = useState<PItem | null>(null);
  // Project menu (right click on a Project # box or a project header).
  const [projMenu, setProjMenu] = useState<{ project: PProject; headKey: string } | null>(null);
  const [projToDelete, setProjToDelete] = useState<PProject | null>(null);
  const openProjMenu = (e: React.MouseEvent, project: PProject, headKey: string) => {
    if (!project.id) return;
    e.preventDefault();
    e.stopPropagation();
    setProjMenu(m => (m?.headKey === headKey ? null : { project, headKey }));
  };

  const nonEmpty = sections.filter(s => s.projects.length > 0);
  function toggle(key: string) {
    setCollapsed(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  const moneyStart = cols.indexOf('pfUsd');
  const afterMoney = cols.length - cols.indexOf('invoiceTl') - 1;
  const span = { moneyStart, afterMoney };
  // The latest onSaved for the payment cells, without rebuilding the body when it changes.
  const savedRef = useRef(onSaved);
  useEffect(() => { savedRef.current = onSaved; }, [onSaved]);
  const reload = useCallback(() => savedRef.current?.(), []);
  // Payments: the cards' title bar sits over the column headings, so the region bands stick lower.
  const headH = payments ? HEAD_H + TITLE_H : HEAD_H;

  // The table body is the expensive part of this board (profiled: ~80 ms for 400 rows, ~310 ms for
  // 1,600). It depends only on the data, pending edits, collapsed groups, column widths and access /
  // selection — never on which popup is open — so it is built once per change of those and reused
  // while a status list, picker, panel or menu opens and closes. Its handlers only call state
  // setters (stable) or read values that are in the dependency list.
  const colWidthKey = cols.map(c => width(c)).join(',');
  const { body, groupsByKey } = useMemo(() => {
    // The type groups drawn in the body, for the Edit Item panel.
    const groupsByKey = new Map<string, TypeGroup>();

    /** One board row: the board's cells (Project # / Type / PO merged over their groups) + payment cells. */
    const itemRow = (item: PItem, rowKey: string, cells: (col: ColumnKey) => React.ReactNode) => (
      <tr key={rowKey}
        onContextMenu={canDelRows && item.id ? e => { e.preventDefault(); setRowMenu({ item, point: { x: e.clientX, y: e.clientY } }); } : undefined}>
        {cols.map(cells)}
        {payments && <PayCells item={item} edit={payEdit} onSaved={reload} />}
      </tr>
    );

    /** The plain (per-row) cells: order type, vendor, PF / status chips and the text / money / date columns. */
    const rowCell = (col: ColumnKey, item: PItem): React.ReactNode => {
      if (col === 'orderType') return (
        <td key={col} className={cn(TD, canRows && item.id && 'cursor-pointer hover:bg-ui-hover-bg')}
          onClick={canRows && item.id ? e => setPicker({ kind: 'orderType', item, rect: e.currentTarget.getBoundingClientRect() }) : undefined}>
          <OrderType value={item.orderType} />
        </td>
      );
      if (col === 'vendor') return (
        <td key={col} className={cn(TD, 'text-[13px] leading-[1.4]', canRows && item.id && 'cursor-pointer hover:bg-ui-hover-bg')}
          onClick={canRows && item.id ? e => setPicker({ kind: 'vendor', item, rect: e.currentTarget.getBoundingClientRect() }) : undefined}>
          {cellValue(col, item)}
        </td>
      );
      if (col === 'pfSignStatus') return (
        <StatusCell key={col} opt={signStyle(item.pfSignStatus)} editable={canStatus && !!item.id}
          onOpen={a => actions.openMenu('pf', [item.id!], normalizeSign(item.pfSignStatus), a)} />
      );
      if (col === 'status') return (
        <StatusCell key={col} opt={statusStyle(item.status)} editable={canStatus && !!item.id}
          onOpen={a => actions.openMenu('status', [item.id!], normalizeStatus(item.status), a)} />
      );
      return (
        <td key={col} className={cn(TD, col === 'pfCode' && 'text-[13px] leading-[1.4]', isMoneyColumn(col) && 'text-[var(--color-secondary-700)] dark:text-ui-heading')}>
          {cellValue(col, item)}
        </td>
      );
    };

    const body = (
      <tbody>
        {nonEmpty.map((section, si) => {
          let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;

          const projectRows = section.projects.map((project, pi) => {
            const typeGroups = groupItemsByType(project.items || []);
            const dataRowCount = typeGroups.reduce((n, g) => n + g.items.length, 0);
            const tone = PROJECT_TONE[computeProjectColor(project)];
            const barStyle = { background: toneBg(tone), color: toneFg(tone) };
            const key = `${section.label}:${project.projectNo}`;
            const isCollapsed = collapsed.has(key);

            const totals: MoneyTotals = {};
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
            typeGroups.forEach((group, gi) => {
              const shown = sortForDisplay(group.items.map(actions.view));
              const groupKey = `${shown[0]?.caseId ?? shown[0]?.projectId ?? project.projectNo}|${group.type}`;
              groupsByKey.set(groupKey, { type: group.type, items: shown, projectId: shown[0]?.projectId ?? null, caseId: shown[0]?.caseId ?? null, customTypeCode: shown[0]?.customTypeCode ?? null });
              const allSent = groupAllSent(shown);
              const po = poRollup(shown.map(i => i.poSignStatus));
              const rank = section.group != null ? groupRanks?.get(`${section.group}|${shown[0]?.projectId}|${group.type.toLowerCase()}`) : undefined;
              shown.forEach((item, ii) => {
                const isFirstDataRow = dataRowSeen === 0;
                const isFirstOfGroup = ii === 0;
                dataRowSeen++;
                bodyRows.push(itemRow(item, `${pi}-${gi}-${ii}`, col => {
                  if (col === 'projectNo') {
                    if (!isFirstDataRow) return null;
                    return <ProjectNoCell key={col} project={project} rowCount={dataRowCount} barStyle={barStyle} selection={selection}
                      onContextMenu={e => openProjMenu(e, project, key)} />;
                  }
                  if (col === 'type') {
                    if (!isFirstOfGroup) return null;
                    return <TypeCell key={col} type={group.type} rowCount={group.items.length} allSent={allSent} rank={rank} left={typeLeft}
                      onOpen={canRows ? e => setPanel({ key: groupKey, point: { x: e.clientX, y: e.clientY } }) : undefined} />;
                  }
                  if (col === 'poSignStatus') {
                    if (!isFirstOfGroup) return null;
                    // One PO cell for the whole type group, filled from top to bottom.
                    const ids = shown.map(i => i.id).filter(Boolean) as string[];
                    return (
                      <StatusCell key={col} rowSpan={group.items.length} opt={signStyle(po)} editable={canStatus && ids.length > 0}
                        onOpen={a => actions.openMenu('po', ids, po, a)} />
                    );
                  }
                  return rowCell(col, item);
                }));
              });
            });

            return (
              <Fragment key={`proj-${pi}`}>
                <ProjectHeadRow project={project} headKey={key} collapsed={isCollapsed} barStyle={barStyle} colCount={cols.length} payments={payments}
                  onToggle={() => toggle(key)} onContextMenu={e => openProjMenu(e, project, key)} />
                {!isCollapsed && bodyRows}
                {!isCollapsed && access.viewMoney && (
                  <ProjectTotalRow items={project.items || []} totals={totals} span={span} barStyle={barStyle} payments={payments} />
                )}
              </Fragment>
            );
          });

          const secTotals: MoneyTotals = { pfUsd: secUsd, pfTl: secTl, invoice: secInv, invoiceTl: secInvTl };
          // A region folds like a project (same fold state); its totals row stays visible.
          const regionKey = `region:${section.label}`;
          const regionClosed = collapsed.has(regionKey);
          return (
            <Fragment key={`sec-${si}`}>
              <RegionBandRow section={section} closed={regionClosed} top={headH} colCount={cols.length} payments={payments}
                onToggle={() => toggle(regionKey)} />
              {!regionClosed && projectRows}
              {access.viewMoney && !payments && <SectionTotalRow label={section.label} totals={secTotals} span={span} />}
            </Fragment>
          );
        })}
        {payments && access.viewMoney && (
          <GrandTotalRow items={nonEmpty.flatMap(sec => sec.projects.flatMap(p => p.items || []))} span={span} />
        )}
      </tbody>
    );
    return { body, groupsByKey };
  }, [sections, actions.pending, collapsed, colWidthKey, typeLeft, access, selection, groupRanks, payments, payEdit, reload, moneyStart, afterMoney]);

  const scrollbar = useStickyScrollbar(nonEmpty.length);

  if (!nonEmpty.length) {
    return (
      <EmptyState
        icon={<Factory />}
        title="No production rows yet"
        description="Projects with production items will appear here grouped by region."
      />
    );
  }

  const tableWidth = cols.reduce((t, c) => t + width(c), 0) + (payments ? PAY_COLS.reduce((t, c) => t + c.w, 0) + PAY_GROUPS.length * GAP_W : 0);

  return (
    <div className="relative">
    <div ref={scrollbar.boxRef} onScroll={scrollbar.onBoxScroll}
      className={cn('overflow-auto', !payments && 'rounded-[8px] border border-ui-divider')} style={{ maxHeight: 'calc(100dvh - 220px)' }}>
      <table className="table-fixed border-separate border-spacing-0" style={{ width: `max(${tableWidth}px, 100%)` }}>
        <BoardColGroup cols={cols} width={width} payments={payments} />
        <BoardHead cols={cols} typeLeft={typeLeft} payments={payments} onResize={startResize} onFit={fit} />
        {body}
      </table>
      {actions.menu && <StatusMenu menu={actions.menu} onPick={v => void actions.pickStatus(v)} onClose={actions.closeMenu} />}
      {picker?.kind === 'vendor' && (
        <VendorPicker rect={picker.rect} current={picker.item.vendorId ?? null} vendors={lists.vendors} onVendorsChanged={async () => { await lists.reloadVendors(); onSaved?.(); }}
          onClose={() => setPicker(null)} onPick={v => { const it = picker.item; setPicker(null); void actions.pickVendor(it, v); }} />
      )}
      {picker?.kind === 'orderType' && (
        <OrderTypePicker rect={picker.rect} current={picker.item.orderType ?? null} options={lists.orderTypes} onAdded={() => void lists.reloadOrderTypes()}
          onClose={() => setPicker(null)} onClear={() => { const it = picker.item; setPicker(null); void actions.pickOrderType(it, null); }}
          onPick={name => { const it = picker.item; setPicker(null); void actions.pickOrderType(it, name); }} />
      )}
      {panel && groupsByKey.get(panel.key) && (() => {
        const g = groupsByKey.get(panel.key)!;
        const items: PanelItem[] = g.items.filter(i => i.id).map(i => ({ id: i.id!, pfCode: i.pfCode ?? null, vendorId: i.vendorId ?? null, orderType: i.orderType ?? null }));
        return (
          <EditItemPanel point={panel.point} type={g.type} items={items} vendors={lists.vendors} orderTypes={lists.orderTypes} canAdd={canRows}
            onSave={(id, patch) => actions.patchItem(id, patch)} onAddItem={() => actions.addItem(g)} onClose={() => setPanel(null)}
            onVendorsChanged={() => lists.reloadVendors()} onOrderTypesChanged={() => void lists.reloadOrderTypes()} />
        );
      })()}
      {projMenu && (
        <ProjectMenu key={projMenu.headKey} project={projMenu.project} headKey={projMenu.headKey} access={access}
          groups={groups} onGroupsChanged={() => onGroupsChanged?.()} onSaved={() => onSaved?.()}
          onDelete={() => setProjToDelete(projMenu.project)} onClose={() => setProjMenu(null)}
          onSelect={selection && projMenu.project.id ? () => selection.toggle(projMenu.project.id!) : undefined}
          selected={!!projMenu.project.id && !!selection?.selected.has(projMenu.project.id)} />
      )}
      <ConfirmModal
        open={!!projToDelete} onOpenChange={o => { if (!o) setProjToDelete(null); }}
        title="Delete this project?" tone="destructive" confirmLabel="Delete Project"
        description={projToDelete ? `Are you sure you want to delete the project "${projToDelete.editName || projToDelete.projectNo}"?` : undefined}
        warning="It goes to the trash and can be restored from there."
        onConfirm={async () => { if (projToDelete) await actions.deleteProject(projToDelete); setProjToDelete(null); }}
      />
      {rowMenu && (
        <RowMenu point={rowMenu.point} title={rowMenu.item.type ?? 'Row'} onClose={() => setRowMenu(null)}
          onDelete={() => { const it = rowMenu.item; setRowMenu(null); setToDelete(it); }} />
      )}
      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title="Delete this row?" tone="destructive" confirmLabel="Delete Row"
        description={toDelete ? [toDelete.type, toDelete.pfCode, vendorText(toDelete.vendor)].filter(Boolean).join(' · ') : undefined}
        warning={toDelete && (toDelete.pfCode || toDelete.vendorId) ? 'This row has a vendor or PF code. It goes to the trash and can be restored from there.' : undefined}
        onConfirm={async () => { if (toDelete) await actions.deleteItem(toDelete); setToDelete(null); }}
      />
    </div>
      {scrollbar.showBar && (
        <div ref={scrollbar.barRef} aria-hidden onScroll={scrollbar.onBarScroll}
          className="sticky bottom-0 z-40 overflow-x-auto overflow-y-hidden border-t border-ui-divider bg-ui-page-bg" style={{ height: 16 }}>
          <div style={{ width: scrollbar.barWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
