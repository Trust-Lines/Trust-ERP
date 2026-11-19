// Production board → .xlsx download. This module pulls in exceljs + file-saver; load it lazily
// (`await import(...)`) from the click handler. Board types and helpers live in
// lib/production/boardModel.ts and boardColors.ts.

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DEFAULT_VISIBLE_COLUMNS, type ColumnKey, type PSection } from '@/lib/production/boardModel';
import { XLSX_MIME } from './excelStyles';
import { writeProjectsSheet } from './projectsSheet';
import { buildProjectTotalFromSections, writeProjectTotalSheet, type PCompanyTotals } from './projectTotalSheet';

export type { PCategoryRows, PCompanyTotals, PMoney } from './projectTotalSheet';

export interface ExportProjectsOptions {
  projects: PSection[];
  missingExtra?: PSection[];
  directOrders?: PSection[];
  projectTotalRate?: number;
  projectTotal?: PCompanyTotals[];
  visibleColumns?: ColumnKey[];
  isColumnVisible?: (key: ColumnKey) => boolean;
  filename?: string;
  /** Leave the Project Total sheet out (roles without the money columns). */
  skipProjectTotal?: boolean;
}

function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Projects Export';
  wb.created = new Date();
  return wb;
}

async function download(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: XLSX_MIME }), filename);
}

/** Full workbook: Projects, Missing & Extra, Direct Orders, and (unless skipped) Project Total. */
export async function exportProjectsWorkbook(opts: ExportProjectsOptions): Promise<void> {
  const cols = (opts.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS)
    .filter(c => (opts.isColumnVisible ? opts.isColumnVisible(c) : true));

  const wb = newWorkbook();
  writeProjectsSheet(wb, 'Projects', opts.projects, cols);
  if (opts.missingExtra) writeProjectsSheet(wb, 'Missing & Extra', opts.missingExtra, cols);
  if (opts.directOrders) writeProjectsSheet(wb, 'Direct Orders', opts.directOrders, cols);

  if (!opts.skipProjectTotal) {
    const ptData = opts.projectTotal ?? buildProjectTotalFromSections({
      projects: opts.projects,
      missingExtra: opts.missingExtra ?? [],
      directOrders: opts.directOrders ?? [],
    });
    writeProjectTotalSheet(wb, ptData, opts.projectTotalRate ?? 41.23);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  await download(wb, opts.filename || `Projects_${dateStr}.xlsx`);
}

/** One tab's sheet on its own (Missing & Extra / Direct Orders tabs of the Production tracker). */
export async function exportBoardSheet(opts: { sheetName: string; sections: PSection[]; filename: string; visibleColumns?: ColumnKey[] }): Promise<void> {
  const wb = newWorkbook();
  writeProjectsSheet(wb, opts.sheetName, opts.sections, opts.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS);
  await download(wb, opts.filename);
}
