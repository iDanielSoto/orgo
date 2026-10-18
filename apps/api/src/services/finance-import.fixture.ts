import ExcelJS from 'exceljs';

const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Libro con la forma del Excel de finanzas (sólo para pruebas): hoja del mes actual, hoja del
 * mes siguiente y una hoja de totales; columnas de distribución y totales como fórmulas.
 */
export async function financeWorkbook(today: string): Promise<Buffer> {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const wb = new ExcelJS.Workbook();

  const cur = wb.addWorksheet(MONTHS[m - 1]!);
  cur.getRow(1).values = ['Nombre', 'Entrada', null, 'Ahorro', 'Gastos fijos', 'Gustos', null, null, 'Porcentajes'];
  cur.getCell('A2').value = 'Premio Hacka';
  cur.getCell('B2').value = 4333.33;
  cur.getCell('A3').value = `Sueldo 1 ${ABBR[m - 1]}`;
  cur.getCell('B3').value = 2100;
  cur.getCell('A4').value = `Sueldo 28 ${ABBR[m - 1]}`; // sin importe
  for (const r of [2, 3, 4]) {
    cur.getCell(`E${r}`).value = { formula: `B${r}*$J$2`, result: r === 4 ? undefined : 1 } as ExcelJS.CellFormulaValue;
    cur.getCell(`F${r}`).value = { formula: `B${r}*$J$3` } as ExcelJS.CellFormulaValue;
    cur.getCell(`G${r}`).value = { formula: `B${r}*$J$4` } as ExcelJS.CellFormulaValue;
  }
  cur.getCell('I2').value = 'AHORRO';
  cur.getCell('J2').value = 0.7;
  cur.getCell('I3').value = 'GASTO';
  cur.getCell('J3').value = 0.2;
  cur.getCell('I4').value = 'GUSTO';
  cur.getCell('J4').value = 0.1;
  cur.getRow(7).getCell(9).value = 'Nombre';
  cur.getRow(7).getCell(10).value = 'Cantidad';
  cur.getRow(7).getCell(11).value = 'Fecha';
  const day1 = new Date(Date.UTC(y, m - 1, 1));
  const expenses: [string, number, Date | null][] = [
    ['Hamburguesas', 400, day1],
    ['Comida de mi noviecita', 140, day1],
    ['Internet', 399, day1],
    ['Deudas', 2080, null],
  ];
  expenses.forEach(([name, amount, date], i) => {
    const r = 8 + i;
    cur.getCell(`I${r}`).value = name;
    cur.getCell(`J${r}`).value = amount;
    if (date) {
      cur.getCell(`K${r}`).value = date;
      cur.getCell(`K${r}`).numFmt = 'd/m';
    }
  });
  cur.getCell('L24').value = 'Gasto disponible';
  cur.getCell('A25').value = 'TOTAL';
  cur.getCell('B25').value = { formula: 'SUM(B2:B24)', result: 6433.33 } as ExcelJS.CellFormulaValue;
  cur.getCell('E25').value = { formula: 'SUM(E2:E24)', result: 4503.33 } as ExcelJS.CellFormulaValue;
  cur.getCell('L25').value = { formula: 'F25-SUM(J8:J25)', result: -1732.33 } as ExcelJS.CellFormulaValue;

  const next = wb.addWorksheet(`${MONTHS[nm - 1]} ${ny}`);
  next.getRow(1).values = ['Nombre', 'Entrada'];
  next.getCell('A2').value = 'Beca Santander';
  next.getCell('B2').value = 4500;
  next.getCell('E2').value = { formula: 'B2*0.7', result: 3150 } as ExcelJS.CellFormulaValue;
  next.getCell('A25').value = 'TOTAL';
  next.getCell('B25').value = { formula: 'SUM(B2:B24)', result: 4500 } as ExcelJS.CellFormulaValue;

  const totals = wb.addWorksheet('Hoja 2');
  totals.getCell('B2').value = 'TOTAL AHORROS';
  totals.getCell('B3').value = { formula: `'${next.name}'!E25+${cur.name}!E25`, result: 7653.33 } as ExcelJS.CellFormulaValue;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
