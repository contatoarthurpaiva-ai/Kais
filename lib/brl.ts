/** Helpers de formatação/parse compartilhados por UI e API. */

export function formatBRLcents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );
}

/** Converte texto "R$ 15,00" ou "15,00" ou "15.00" em centavos inteiros. */
export function parseBRLtoCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function pct(dec: number): string {
  return (dec * 100).toFixed(2) + '%';
}
