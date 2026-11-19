import type ExcelJS from 'exceljs';
import { BORDER_ARGB } from '@/lib/production/boardColors';

const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_ARGB } };
export const BORDERS_ALL: Partial<ExcelJS.Borders> = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
export const CENTER: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' };
export function fillBg(argb: string): ExcelJS.Fill { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
