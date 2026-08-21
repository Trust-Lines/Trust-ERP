'use client';

import { Fragment } from 'react';
import {
  DEFAULT_VISIBLE_COLUMNS, COLUMN_LABELS, COLUMN_WIDTHS,
  computeProjectColor, projectColorCss, groupItemsByType, groupPoSignStatus, groupAllSent,
  statusCellCss, signStatusCellCss, vendorText, mapStatus, mapSignStatus,
  effUsd, effTl, toNumber, fmtMoneyCss, fmtDateCss,
  isDateColumn, isMoneyColumn, BOARD_CSS,
  type PSection, type PItem, type ColumnKey,
} from '@/lib/excel/projectsExcelExport';

const COLS = DEFAULT_VISIBLE_COLUMNS;
const BORDER = `1px solid ${BOARD_CSS.border}`;

function cellValue(col: ColumnKey, item: PItem): React.ReactNode {
  if (col === 'vendor')       return vendorText(item.vendor);
  if (col === 'pfSignStatus') return mapSignStatus(item.pfSignStatus);
  if (col === 'status')       return mapStatus(item.status);
  if (isMoneyColumn(col))     return fmtMoneyCss(col, toNumber((item as Record<string, unknown>)[col] as number));
  if (isDateColumn(col))      return fmtDateCss((item as Record<string, unknown>)[col]);
  const v = (item as Record<string, unknown>)[col];
  return v == null ? '' : String(v);
}

const tdBase: React.CSSProperties = {
  border: BORDER, padding: '3px 6px', textAlign: 'center',
  whiteSpace: 'nowrap', fontSize: 11, height: 22, verticalAlign: 'middle',
};

export function OperationalBoard({ sections }: { sections: PSection[] }) {
  const nonEmpty = sections.filter(s => s.projects.length > 0);

  if (!nonEmpty.length) {
    return (
      <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-muted)' }}>No production rows yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Projects with production items will appear here grouped by region.</div>
      </div>
    );
  }

  const totalLabelIdx = (() => {
    const i = COLS.indexOf('pfUsd');
    return i > 0 ? i - 1 : 0;
  })();

  return (
    <div style={{ overflowX: 'auto', border: BORDER, borderRadius: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <colgroup>
          {COLS.map(c => <col key={c} style={{ width: COLUMN_WIDTHS[c] }} />)}
        </colgroup>
        <tbody>
          {nonEmpty.map((section, si) => {
            let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;

            const projectRows = section.projects.map((project, pi) => {
              const groups = groupItemsByType(project.items || []);
              const dataRowCount = groups.reduce((n, g) => n + g.items.length, 0);
              const projColor = projectColorCss(computeProjectColor(project));

              let projUsd = 0, projTl = 0, projInv = 0, projInvTl = 0;
              for (const it of project.items || []) {
                projUsd += toNumber(it.pfUsd); projTl += toNumber(it.pfTl);
                projInv += toNumber(it.invoice); projInvTl += toNumber(it.invoiceTl);
                secUsd += effUsd(it); secTl += effTl(it);
                secInv += toNumber(it.invoice); secInvTl += toNumber(it.invoiceTl);
              }

              let dataRowSeen = 0;
              const bodyRows: React.ReactNode[] = [];
              groups.forEach((group, gi) => {
                const allSent = groupAllSent(group.items);
                const poRollup = groupPoSignStatus(group.items);
                const poCss = signStatusCellCss(poRollup);
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
                            <td key={col} rowSpan={dataRowCount + 1} style={{
                              ...tdBase, background: projColor, color: '#fff',
                              fontWeight: 800, fontSize: 14,
                            }}>
                              {String(project.projectNo)}
                            </td>
                          );
                        }
                        if (col === 'type') {
                          if (!isFirstOfGroup) return null;
                          return (
                            <td key={col} rowSpan={group.items.length} style={{
                              ...tdBase, fontWeight: 700,
                              ...(allSent ? { background: BOARD_CSS.typeAllSent.bg, color: BOARD_CSS.typeAllSent.fg } : {}),
                            }}>
                              {group.type}
                            </td>
                          );
                        }
                        if (col === 'poSignStatus') {
                          if (!isFirstOfGroup) return null;
                          return (
                            <td key={col} rowSpan={group.items.length} style={{
                              ...tdBase, fontWeight: poCss ? 700 : 400,
                              ...(poCss ? { background: poCss.bg, color: poCss.fg } : {}),
                            }}>
                              {poRollup}
                            </td>
                          );
                        }
                        const colorCss = col === 'status' ? statusCellCss(item.status)
                          : col === 'pfSignStatus' ? statusCellCss(item.pfSignStatus)
                          : null;
                        return (
                          <td key={col} style={{
                            ...tdBase,
                            ...(colorCss ? { background: colorCss.bg, color: colorCss.fg, fontWeight: 700 } : {}),
                          }}>
                            {cellValue(col, item)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              });

              const totalRow = (
                <tr key={`${pi}-total`}>
                  {COLS.map((col, ci) => {
                    if (col === 'projectNo') return null;
                    const isLabel = ci === totalLabelIdx;
                    const money = col === 'pfUsd' ? projUsd : col === 'pfTl' ? projTl
                      : col === 'invoice' ? projInv : col === 'invoiceTl' ? projInvTl : null;
                    return (
                      <td key={col} style={{
                        ...tdBase, background: BOARD_CSS.projectTotal.bg, color: BOARD_CSS.projectTotal.fg, fontWeight: 700,
                      }}>
                        {isLabel ? 'TOTAL' : money != null ? fmtMoneyCss(col, money) : ''}
                      </td>
                    );
                  })}
                </tr>
              );

              return (
                <Fragment key={`proj-${pi}`}>
                  <tr key={`${pi}-bar`}>
                    <td colSpan={COLS.length} style={{
                      ...tdBase, textAlign: 'center', background: BOARD_CSS.projectHeader.bg,
                      color: BOARD_CSS.projectHeader.fg, fontWeight: 700, fontSize: 12, height: 26,
                    }}>
                      {project.projectNo} - {project.projectName ?? ''}
                    </td>
                  </tr>
                  <tr key={`${pi}-hdr`}>
                    {COLS.map(col => (
                      <td key={col} style={{
                        ...tdBase, background: BOARD_CSS.columnHeader.bg, color: BOARD_CSS.columnHeader.fg,
                        fontWeight: 700, fontSize: 10, whiteSpace: 'normal',
                      }}>
                        {COLUMN_LABELS[col]}
                      </td>
                    ))}
                  </tr>
                  {bodyRows}
                  {totalRow}
                </Fragment>
              );
            });

            return (
              <Fragment key={`sec-${si}`}>
                <tr>
                  <td colSpan={COLS.length} style={{
                    ...tdBase, textAlign: 'center', background: BOARD_CSS.sectionHeader.bg,
                    color: BOARD_CSS.sectionHeader.fg, fontWeight: 800, fontSize: 15, height: 30,
                  }}>
                    {section.label}
                  </td>
                </tr>
                {projectRows}
                <tr key={`sec-${si}-total`}>
                  {COLS.map((col, ci) => {
                    const labelEnd = COLS.indexOf('pfUsd');
                    if (labelEnd > 1 && ci === 0) {
                      return (
                        <td key={col} colSpan={labelEnd} style={{
                          ...tdBase, textAlign: 'center', background: BOARD_CSS.sectionTotal.bg,
                          color: BOARD_CSS.sectionTotal.fg, fontWeight: 800, fontSize: 12,
                        }}>
                          {section.label.toUpperCase()} TOTALS
                        </td>
                      );
                    }
                    if (labelEnd > 1 && ci < labelEnd) return null;
                    const money = col === 'pfUsd' ? secUsd : col === 'pfTl' ? secTl
                      : col === 'invoice' ? secInv : col === 'invoiceTl' ? secInvTl : null;
                    return (
                      <td key={col} style={{
                        ...tdBase, background: BOARD_CSS.sectionTotal.bg, color: BOARD_CSS.sectionTotal.fg, fontWeight: 800, fontSize: 12,
                      }}>
                        {money != null ? fmtMoneyCss(col, money) : ''}
                      </td>
                    );
                  })}
                </tr>
                <tr key={`sec-${si}-sp`}><td colSpan={COLS.length} style={{ height: 12, border: 'none' }} /></tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
