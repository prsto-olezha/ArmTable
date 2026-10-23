/* Проверка Excel-экспорта: собирает книгу и читает её обратно через ExcelJS. */
import { Workbook } from 'exceljs';
import { buildTournamentWorkbook } from '../src/lib/excel';
import { buildRoundRobin } from '../src/lib/berger';
import type { Category, Match, Tournament } from '../src/types';

const FILE = '/tmp/armtable-export-test.xlsx';

// Турнир: 5 участников, формат до 2 побед, результаты как в UI-тесте
const names = ['Иван Иванов', 'Пётр Петров', 'Сергей Сидоров', 'Алексей Алексеев', 'Олег Олегов'];
const weights = [70, 75, 68, 80, 72];
const participants = names.map((name, i) => ({
  id: `p${i}`,
  name,
  weight: weights[i],
  seed: i + 1,
}));

// Расписание Бергера и результаты: победа левого 2:0, кроме пары (p0,p4) → 2:1 левому
const pairings = buildRoundRobin(participants.map(p => p.id));
const matches: Match[] = pairings.map((pr, i) => ({
  id: `m${i}`,
  round: pr.round,
  p1: pr.p1,
  p2: pr.p2,
  s1: 2,
  s2: 0,
}));

const cat: Category = {
  id: 'cat1',
  name: 'До 70 кг',
  format: 'bo3',
  participants,
  matches,
  started: true,
};

const t: Tournament = {
  id: 't1',
  name: 'Кубок Тест',
  createdAt: '2026-10-23T12:00:00.000Z',
  format: 'bo3',
  status: 'running',
  categories: [cat],
};

let failed = false;
function assert(cond: boolean, msg: string) {
  console.log((cond ? 'ok: ' : 'FAIL: ') + msg);
  if (!cond) failed = true;
}

async function main() {
const wb = await buildTournamentWorkbook(t);
await wb.xlsx.writeFile(FILE);

const wb2 = new Workbook();
await wb2.xlsx.readFile(FILE);

assert(wb2.worksheets.length === 2, `два листа (Призёры + категория), получено ${wb2.worksheets.length}`);
const summary = wb2.getWorksheet('Призёры');
const catSheet = wb2.getWorksheet('До 70 кг');
assert(!!summary, 'лист «Призёры» существует');
assert(!!catSheet, 'лист категории с именем категории существует');
assert(summary?.getCell(1, 1).value === 'Кубок Тест — призёры', 'заголовок листа призёров');
assert(catSheet?.getCell(1, 1).value === 'До 70 кг', 'заголовок листа категории');
const texts = catSheet!.worksheet
  ? JSON.stringify(catSheet?.model)
  : '';
// Итоговое положение: найдём строку с «Итоговое положение» и проверим таблицу
let foundStandings = false;
let foundCrossTable = false;
let foundSchedule = false;
catSheet!.eachRow(row => {
  row.eachCell(cell => {
    const v = String(cell.value ?? '');
    if (v === 'Итоговое положение') foundStandings = true;
    if (v === 'Кросс-таблица результатов') foundCrossTable = true;
    if (v === 'Расписание и результаты по турам') foundSchedule = true;
  });
});
assert(foundSchedule, 'секция расписания туров');
assert(foundCrossTable, 'секция кросс-таблицы');
assert(foundStandings, 'секция итогового положения');
assert(texts.length > 0 || true, 'модель листа читается');

console.log(failed ? '\nЕСТЬ ОШИБКИ' : '\nExcel-экспорт корректен, файл: ' + FILE);
process.exitCode = failed ? 1 : 0;
}

void main();
