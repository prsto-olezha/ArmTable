import { Workbook, type Worksheet } from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { computeStandings, type StandingRow } from './standings';
import { isTauri } from './storage';
import { FORMAT_SHORT, type Category, type Tournament } from '../types';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const thinBorder = {
  style: 'thin' as const,
  color: { argb: 'FFB0BEC5' },
};
const CELL_BORDER = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F5AA0' } };
const TITLE_FONT = { bold: true, size: 15, color: { argb: 'FF14324F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const MEDAL_FILLS = ['FFFFE082', 'FFECF0F3', 'FFFFD3B0'].map(fgColor => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: fgColor },
}));

function participantsBySeed(cat: Category) {
  return [...cat.participants].sort((a, b) => a.seed - b.seed);
}

function nameOf(cat: Category, id: string): string {
  return cat.participants.find(p => p.id === id)?.name ?? '—';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Турнир';
}

function safeSheetName(raw: string, used: Set<string>): string {
  let base = raw.replace(/[\\/*?:[\]]+/g, ' ').trim().slice(0, 31) || 'Категория';
  let name = base;
  let i = 2;
  while (used.has(name)) {
    const suffix = ` (${i++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name);
  return name;
}

function headerRow(ws: Worksheet, row: number, headers: string[], startCol = 1) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, startCol + i);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

function borderRange(ws: Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = CELL_BORDER;
    }
  }
}

function medalRowFill(row: StandingRow): { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } } | null {
  if (row.played === 0) return null;
  if (row.place >= 1 && row.place <= 3) {
    return MEDAL_FILLS[row.place - 1];
  }
  return null;
}

/* ── Лист «Призёры» ─────────────────────────────────── */

function buildSummarySheet(wb: Workbook, t: Tournament) {
  const ws = wb.addWorksheet('Призёры');
  ws.columns = [{ width: 26 }, { width: 34 }, { width: 34 }, { width: 34 }];

  ws.getCell(1, 1).value = `${t.name} — призёры`;
  ws.getCell(1, 1).font = TITLE_FONT;
  ws.mergeCells(1, 1, 1, 4);

  let row = 3;
  headerRow(ws, row, ['Категория', '🥇 1 место', '🥈 2 место', '🥉 3 место']);
  row++;

  for (const cat of t.categories.filter(c => c.started)) {
    const top = computeStandings(cat).filter(r => r.played > 0).slice(0, 3);
    ws.getCell(row, 1).value = cat.name;
    ws.getCell(row, 1).font = { bold: true };
    for (let i = 0; i < 3; i++) {
      const r = top[i];
      const cell = ws.getCell(row, 2 + i);
      if (r) {
        const weight = r.participant.weight != null ? `, ${r.participant.weight} кг` : '';
        cell.value = `${r.participant.name}${weight}`;
      } else {
        cell.value = '—';
        cell.font = { color: { argb: 'FF9AA7B4' } };
      }
      if (top.length) cell.fill = MEDAL_FILLS[i];
    }
    borderRange(ws, row, 1, row, 4);
    row++;
  }
  if (row === 4) {
    ws.getCell(row, 1).value = 'Нет начатых категорий';
    borderRange(ws, row, 1, row, 4);
  }
}

/* ── Лист категории ─────────────────────────────────── */

function buildCategorySheet(wb: Workbook, cat: Category, sheetName: string) {
  const ws = wb.addWorksheet(sheetName);
  const people = participantsBySeed(cat);
  const standings = computeStandings(cat);

  ws.getCell(1, 1).value = cat.name;
  ws.getCell(1, 1).font = TITLE_FONT;
  ws.getCell(2, 1).value = `Формат: ${FORMAT_SHORT[cat.format]} · участников: ${people.length}`;
  ws.getCell(2, 1).font = { color: { argb: 'FF5A6A7B' } };

  let row = 4;

  /* Расписание по турам */
  ws.getCell(row, 1).value = 'Расписание и результаты по турам';
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row++;
  headerRow(ws, row, ['Тур', 'Участник 1', 'Счёт', 'Участник 2', 'Победитель']);
  row++;

  const rounds = [...new Set(cat.matches.map(m => m.round))].sort((a, b) => a - b);
  for (const r of rounds) {
    const matches = cat.matches.filter(m => m.round === r);
    for (const m of matches) {
      ws.getCell(row, 1).value = m.round;
      ws.getCell(row, 2).value = nameOf(cat, m.p1);
      ws.getCell(row, 3).value = m.s1 != null ? `${m.s1}:${m.s2}` : '—';
      ws.getCell(row, 3).alignment = { horizontal: 'center' };
      ws.getCell(row, 4).value = nameOf(cat, m.p2);
      if (m.s1 != null) {
        ws.getCell(row, 5).value = nameOf(cat, m.s1 > m.s2! ? m.p1 : m.p2);
        if (m.technical) {
          ws.getCell(row, 5).value += ' (тех.)';
        }
      }
      row++;
    }
    const busy = new Set(matches.flatMap(m => [m.p1, m.p2]));
    const resting = people.filter(p => !busy.has(p.id));
    if (resting.length) {
      ws.getCell(row, 2).value = `Пропуск тура: ${resting.map(p => p.name).join(', ')}`;
      ws.getCell(row, 2).font = { italic: true, color: { argb: 'FF7A8794' } };
      row++;
    }
  }
  borderRange(ws, 5, 1, row - 1, 5);
  row += 2;

  /* Кросс-таблица */
  ws.getCell(row, 1).value = 'Кросс-таблица результатов';
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row++;

  const standById = new Map(standings.map(r => [r.participant.id, r]));
  const matrixTop = row;
  // шапка: имена вертикально
  const corner = ws.getCell(matrixTop, 1);
  corner.value = '№ / ФИО';
  corner.font = HEADER_FONT;
  corner.fill = HEADER_FILL;
  corner.border = CELL_BORDER;
  corner.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  people.forEach((p, i) => {
    const cell = ws.getCell(matrixTop, 2 + i);
    cell.value = `${p.seed}. ${p.name}`;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = CELL_BORDER;
    cell.alignment = { textRotation: 90, vertical: 'bottom', horizontal: 'center' };
  });
  ws.getRow(matrixTop).height = 110;
  const statCols = ['И', 'В', 'П', 'Р+', 'Р−', '±', 'Очки', 'Место'];
  statCols.forEach((h, i) => {
    const cell = ws.getCell(matrixTop, 2 + people.length + i);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = CELL_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  people.forEach((p, i) => {
    const r = matrixTop + 1 + i;
    const nameCell = ws.getCell(r, 1);
    nameCell.value = `${p.seed}. ${p.name}`;
    nameCell.font = { bold: true };
    nameCell.border = CELL_BORDER;
    nameCell.alignment = { vertical: 'middle' };
    people.forEach((o, j) => {
      const cell = ws.getCell(r, 2 + j);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'center' };
      if (i === j) {
        cell.value = '✕';
        cell.font = { color: { argb: 'FFB0BEC5' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EEF4' } };
        return;
      }
      const m = cat.matches.find(
        x =>
          x.s1 != null &&
          ((x.p1 === p.id && x.p2 === o.id) || (x.p1 === o.id && x.p2 === p.id)),
      );
      if (m && m.s1 != null) {
        const mine = m.p1 === p.id ? m.s1 : m.s2!;
        const theirs = m.p1 === p.id ? m.s2! : m.s1!;
        cell.value = `${mine}:${theirs}`;
        if (mine > theirs) cell.font = { bold: true, color: { argb: 'FF1C7C33' } };
      }
    });
    const s = standById.get(p.id)!;
    const stats = [s.played, s.wins, s.losses, s.roundsWon, s.roundsLost, s.roundDiff, s.points, s.place];
    stats.forEach((v, k) => {
      const cell = ws.getCell(r, 2 + people.length + k);
      cell.value = v;
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'center' };
      if (k === 2 && v > 0) cell.font = { bold: true };
    });
    const fill = medalRowFill(s);
    if (fill) {
      for (let c = 1; c <= 2 + people.length + stats.length - 1; c++) {
        ws.getCell(r, c).fill = fill;
      }
    }
  });
  borderRange(ws, matrixTop, 1, matrixTop + people.length, 2 + people.length + statCols.length - 1);
  row = matrixTop + people.length + 2;

  /* Итоговое положение */
  ws.getCell(row, 1).value = 'Итоговое положение';
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row++;
  headerRow(ws, row, ['Место', '№', 'ФИО', 'Вес, кг', 'Игры', 'Победы', 'Поражения', 'Раунды +', 'Раунды −', '±', 'Очки']);
  row++;
  for (const s of standings) {
    const fill = medalRowFill(s);
    const values = [
      s.place,
      s.participant.seed,
      s.participant.name + (s.participant.withdrawn ? ' (снят)' : ''),
      s.participant.weight,
      s.played,
      s.wins,
      s.losses,
      s.roundsWon,
      s.roundsLost,
      s.roundDiff,
      s.points,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, 1 + i);
      cell.value = v;
      cell.border = CELL_BORDER;
      if (i === 2) cell.alignment = { horizontal: 'left' };
      else cell.alignment = { horizontal: 'center' };
      if (i === 0 || i === 10) cell.font = { bold: true };
      if (fill) cell.fill = fill;
    });
    row++;
  }
  borderRange(ws, row - standings.length, 6, row - 1, 11);

  /* Ширины колонок */
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= 1 + people.length; c++) {
    ws.getColumn(c).width = 6;
  }
  const statStart = 2 + people.length;
  for (let i = 0; i < statCols.length; i++) {
    ws.getColumn(statStart + i).width = 6.5;
  }
}

/* ── Сборка и сохранение ────────────────────────────── */

export async function buildTournamentWorkbook(t: Tournament): Promise<Workbook> {
  const wb = new Workbook();
  wb.creator = 'ArmTable';
  wb.created = new Date();

  buildSummarySheet(wb, t);
  const used = new Set<string>(['Призёры']);
  for (const cat of t.categories.filter(c => c.started)) {
    buildCategorySheet(wb, cat, safeSheetName(cat.name, used));
  }
  return wb;
}

export async function exportTournamentToExcel(t: Tournament): Promise<string | null> {
  const wb = await buildTournamentWorkbook(t);
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `ArmTable_${sanitizeFileName(t.name)}.xlsx`;

  if (isTauri()) {
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: 'Книга Excel', extensions: ['xlsx'] }],
    });
    if (!path) return null;
    await writeFile(path, new Uint8Array(buffer as ArrayBuffer));
    return path;
  }

  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
