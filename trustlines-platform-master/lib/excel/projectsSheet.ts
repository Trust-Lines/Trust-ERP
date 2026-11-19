import type ExcelJS from 'exceljs';
import {
  COLUMN_LABELS, COLUMN_WIDTHS, DEFAULT_VISIBLE_COLUMNS,
  computeProjectColor, effTl, effUsd, groupAllSent, groupItemsByType, groupPoSignStatus, isDateColumn, isMoneyColumn, isUsdColumn,
  itemField, mapSignStatus, mapStatus, parseDate, toNumber, vendorText,
  type ColumnKey, type PSection,
} from '@/lib/production/boardModel';
import { PALETTE, projectColorArgb, signStatusFill, statusFill } from '@/lib/production/boardColors';
import { BORDERS_ALL, CENTER, fillBg } from './excelStyles';

/**
 * One board sheet (Projects / Missing & Extra / Direct Orders). Per section:
 *   section band → per project: header band, column header, item rows (Type and PO Sign merged
 *   per type group, Project No merged down the block), project TOTAL → section TOTALS.
 * Project totals use the PF price; section totals use the effective amount (invoice, else PF).
 */
export function writeProjectsSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  sections: PSection[],
  visibleColumns: ColumnKey[] = DEFAULT_VISIBLE_COLUMNS,
): void {
  const cols = visibleColumns;
  if (cols.length === 0) return;

  const colCount = cols.length;
  const projNoIdx = cols.indexOf('projectNo');
  const typeIdx = cols.indexOf('type');
  const poSignIdx = cols.indexOf('poSignStatus');
  const pfUsdIdx = cols.indexOf('pfUsd');
  const totalLabelIdx = pfUsdIdx > 0 ? pfUsdIdx - 1 : 0;

  const ws = wb.addWorksheet(sheetName.substring(0, 31), {
    views: [{ state: 'frozen', ySplit: 0, xSplit: 0 }],
  });
  ws.columns = cols.map(c => ({ width: Math.round(COLUMN_WIDTHS[c] / 7.5) }));

  const setMoney = (cell: ExcelJS.Cell, col: ColumnKey, n: number) => {
    cell.value = n !== 0 ? n : null;
    cell.numFmt = isUsdColumn(col) ? '$#,##0.00' : '₺#,##0.00';
    cell.alignment = CENTER;
  };

  for (const section of sections) {
    if (!section.projects.length) continue;

    const secRow = ws.addRow([section.label]);
    ws.mergeCells(secRow.number, 1, secRow.number, colCount);
    const secCell = secRow.getCell(1);
    secCell.font = { bold: true, size: 14, color: { argb: PALETTE.sectionHeader.fg } };
    secCell.fill = fillBg(PALETTE.sectionHeader.bg);
    secCell.alignment = CENTER;
    secRow.height = 28;

    let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;

    for (const project of section.projects) {
      const projColor = projectColorArgb(computeProjectColor(project));

      const projRow = ws.addRow([`${project.projectNo} - ${project.projectName ?? ''}`]);
      ws.mergeCells(projRow.number, 1, projRow.number, colCount);
      const pc = projRow.getCell(1);
      pc.font = { bold: true, size: 11, color: { argb: PALETTE.projectHeader.fg } };
      pc.fill = fillBg(PALETTE.projectHeader.bg);
      pc.alignment = CENTER;
      projRow.height = 24;

      const hdrRow = ws.addRow(cols.map(c => COLUMN_LABELS[c]));
      hdrRow.height = 22;
      hdrRow.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: PALETTE.columnHeader.fg } };
        cell.fill = fillBg(PALETTE.columnHeader.bg);
        cell.alignment = { ...CENTER, wrapText: true };
        cell.border = BORDERS_ALL;
      });

      const firstDataRow = ws.lastRow!.number + 1;
      let projUsd = 0, projTl = 0, projInv = 0, projInvTl = 0;

      for (const group of groupItemsByType(project.items || [])) {
        const groupStart = ws.lastRow!.number + 1;
        const allSent = groupAllSent(group.items);
        const groupPo = groupPoSignStatus(group.items);

        for (const item of group.items) {
          const row = ws.addRow(cols.map(() => ''));
          row.height = 18;

          row.eachCell({ includeEmpty: true }, (cell, n) => {
            const col = cols[n - 1];
            cell.font = { size: 10 };
            cell.border = BORDERS_ALL;
            cell.alignment = CENTER;

            // Filled once per group / project below (merged cells).
            if (col === 'projectNo' || col === 'type' || col === 'poSignStatus') return;
            if (col === 'vendor') { cell.value = vendorText(item.vendor); return; }
            if (col === 'pfSignStatus') { cell.value = mapSignStatus(item.pfSignStatus); }
            else if (col === 'status') { cell.value = mapStatus(item.status); }
            else if (isMoneyColumn(col)) { setMoney(cell, col, toNumber(itemField(item, col))); cell.font = { size: 10 }; cell.border = BORDERS_ALL; }
            else if (isDateColumn(col)) { cell.value = parseDate(itemField(item, col)) ?? ''; cell.numFmt = 'dd/mm/yyyy'; }
            else cell.value = (itemField(item, col) as ExcelJS.CellValue) ?? '';

            if (col === 'status' || col === 'pfSignStatus') {
              const f = statusFill(col === 'status' ? item.status : item.pfSignStatus);
              if (f) { cell.fill = fillBg(f.bg); cell.font = { size: 10, bold: true, color: { argb: f.fg } }; }
            }
          });

          projUsd += toNumber(item.pfUsd);
          projTl += toNumber(item.pfTl);
          projInv += toNumber(item.invoice);
          projInvTl += toNumber(item.invoiceTl);
          secUsd += effUsd(item);
          secTl += effTl(item);
          secInv += toNumber(item.invoice);
          secInvTl += toNumber(item.invoiceTl);
        }

        const groupEnd = ws.lastRow!.number;

        if (typeIdx >= 0 && group.items.length) {
          const c = typeIdx + 1;
          if (groupEnd > groupStart) ws.mergeCells(groupStart, c, groupEnd, c);
          const cell = ws.getCell(groupStart, c);
          cell.value = group.type;
          cell.alignment = CENTER;
          cell.border = BORDERS_ALL;
          if (allSent) { cell.fill = fillBg(PALETTE.typeAllSent.bg); cell.font = { size: 10, bold: true, color: { argb: PALETTE.typeAllSent.fg } }; }
          else cell.font = { size: 10, bold: true };
        }

        if (poSignIdx >= 0 && group.items.length) {
          const c = poSignIdx + 1;
          if (groupEnd > groupStart) ws.mergeCells(groupStart, c, groupEnd, c);
          const cell = ws.getCell(groupStart, c);
          cell.value = groupPo;
          cell.alignment = CENTER;
          cell.border = BORDERS_ALL;
          const f = signStatusFill(groupPo);
          if (f) { cell.fill = fillBg(f.bg); cell.font = { size: 10, bold: true, color: { argb: f.fg } }; }
          else cell.font = { size: 10 };
        }
      }

      const ptRow = ws.addRow(cols.map(() => ''));
      ptRow.height = 20;
      ptRow.eachCell({ includeEmpty: true }, (cell, n) => {
        const col = cols[n - 1];
        cell.font = { bold: true, size: 10, color: { argb: PALETTE.projectTotal.fg } };
        cell.fill = fillBg(PALETTE.projectTotal.bg);
        cell.border = BORDERS_ALL;
        cell.alignment = CENTER;
        if (n - 1 === totalLabelIdx) cell.value = 'TOTAL';
        else if (col === 'pfUsd') setMoney(cell, col, projUsd);
        else if (col === 'pfTl') setMoney(cell, col, projTl);
        else if (col === 'invoice') setMoney(cell, col, projInv);
        else if (col === 'invoiceTl') setMoney(cell, col, projInvTl);
        if (isMoneyColumn(col)) { cell.font = { bold: true, size: 10, color: { argb: PALETTE.projectTotal.fg } }; cell.fill = fillBg(PALETTE.projectTotal.bg); cell.border = BORDERS_ALL; }
      });

      if (projNoIdx >= 0 && (project.items?.length ?? 0) > 0) {
        const c = projNoIdx + 1;
        if (ptRow.number > firstDataRow) ws.mergeCells(firstDataRow, c, ptRow.number, c);
        const cell = ws.getCell(firstDataRow, c);
        cell.value = String(project.projectNo);
        cell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        cell.fill = fillBg(projColor);
        cell.alignment = CENTER;
        cell.border = BORDERS_ALL;
      }
    }

    const stRow = ws.addRow(cols.map(() => ''));
    stRow.height = 24;
    stRow.eachCell({ includeEmpty: true }, (cell, n) => {
      const col = cols[n - 1];
      cell.font = { bold: true, size: 12, color: { argb: PALETTE.sectionTotal.fg } };
      cell.fill = fillBg(PALETTE.sectionTotal.bg);
      cell.border = BORDERS_ALL;
      cell.alignment = CENTER;
      if (col === 'pfUsd') setMoney(cell, col, secUsd);
      else if (col === 'pfTl') setMoney(cell, col, secTl);
      else if (col === 'invoice') setMoney(cell, col, secInv);
      else if (col === 'invoiceTl') setMoney(cell, col, secInvTl);
      if (isMoneyColumn(col)) { cell.font = { bold: true, size: 12, color: { argb: PALETTE.sectionTotal.fg } }; cell.fill = fillBg(PALETTE.sectionTotal.bg); cell.border = BORDERS_ALL; }
    });
    const labelEnd = pfUsdIdx > 1 ? pfUsdIdx : 1;
    if (labelEnd > 1) ws.mergeCells(stRow.number, 1, stRow.number, labelEnd);
    const stLabel = ws.getCell(stRow.number, 1);
    stLabel.value = `${section.label.toUpperCase()} TOTALS`;
    stLabel.alignment = CENTER;

    ws.addRow([]);
  }
}
