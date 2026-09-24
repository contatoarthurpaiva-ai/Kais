/**
 * csv.ts — exportação CSV protegida contra fórmulas maliciosas (§8, §11).
 *
 * Células que começam com = + - @ (ou TAB/CR) são neutralizadas com um apóstrofo
 * inicial, evitando execução de fórmula ao abrir no Excel/Sheets. Aspas e
 * separadores são escapados corretamente.
 */

const DANGEROUS = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  const dangerous = DANGEROUS.test(s);
  const escaped = s.replace(/"/g, '""');
  const body = dangerous ? `'${escaped}` : escaped;
  const needsQuote = dangerous || /[",\n;]/.test(s);
  return needsQuote ? `"${body}"` : body;
}

/** Monta um CSV a partir de linhas (a primeira pode ser o cabeçalho). CRLF padrão. */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
