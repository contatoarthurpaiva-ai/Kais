/**
 * costing.ts — custeio de materiais e fabricação (§4, §4.1).
 *
 * Princípios inegociáveis:
 *  - Compra ≠ consumo: comprar 10 m e usar 4 m deixa 6 m em estoque.
 *  - Custo segue o MATERIAL efetivamente consumido, a variante e sua produção.
 *  - Grupos de estoque preservam a origem econômica: materiais/destinos distintos
 *    NUNCA viram média global. Média ponderada só dentro do mesmo grupo homogêneo.
 *  - Custo por lote é dividido pelas unidades BOAS produzidas.
 *
 * Todos os valores em centavos; quantidades em unidade-base (metros, unidades…).
 */

import { Cents, MoneyError, roundCents } from './money';

/** Custo por unidade-base a partir de uma compra: R$ pagos / quantidade comprada. */
export function unitCostFromPurchase(paidCents: Cents, quantity: number): number {
  if (quantity <= 0) throw new MoneyError('Quantidade comprada deve ser > 0');
  return paidCents / quantity; // centavos por unidade-base (precisão mantida)
}

/** Custo de um componente numa peça: custo/unidade-base × consumo por peça. */
export function componentCostPerPiece(unitCostCentsPerBase: number, consumptionPerPiece: number): Cents {
  if (consumptionPerPiece < 0) throw new MoneyError('Consumo não pode ser negativo');
  return roundCents((unitCostCentsPerBase * consumptionPerPiece) / 100);
}

/** Custo de mão de obra por peça a partir de um lote: R$ do lote / peças produzidas. */
export function costPerPieceFromBatch(batchCents: Cents, goodPieces: number): Cents {
  if (goodPieces <= 0) throw new MoneyError('Lote com rendimento zero está bloqueado (§4)');
  return roundCents(batchCents / goodPieces / 100);
}

/**
 * Grupo de estoque homogêneo com custo médio ponderado.
 * value = valor contábil gerencial acumulado (centavos, inteiro).
 * qty   = quantidade em unidade-base.
 * Média = value/qty (mantida com precisão; arredonda só ao custear a peça).
 */
export class StockGroup {
  constructor(
    public readonly id: string,
    public valueCents: Cents = 0,
    public qty: number = 0,
  ) {}

  /** Média ponderada atual (centavos por unidade-base), ou 0 se vazio. */
  get avgCents(): number {
    return this.qty > 0 ? this.valueCents / this.qty : 0;
  }

  /** Entrada de compra: soma valor e quantidade (mesmo grupo homogêneo). */
  addPurchase(paidCents: Cents, quantity: number): void {
    if (quantity <= 0) throw new MoneyError('Quantidade da compra deve ser > 0');
    if (paidCents < 0) throw new MoneyError('Valor da compra não pode ser negativo');
    this.valueCents += paidCents;
    this.qty += quantity;
  }

  /**
   * Consome `quantity` do grupo pela média ponderada. Retorna o custo consumido
   * (centavos, arredondado) e reduz value/qty preservando precisão.
   */
  consume(quantity: number): Cents {
    if (quantity <= 0) throw new MoneyError('Consumo deve ser > 0');
    if (quantity > this.qty + 1e-9) {
      throw new MoneyError(`Estoque insuficiente no grupo ${this.id}: ${this.qty} < ${quantity}`);
    }
    // custo consumido proporcional ao valor acumulado (evita drift de arredondamento)
    const consumedCents = roundCents((this.valueCents * (quantity / this.qty)) / 100);
    this.valueCents -= consumedCents;
    this.qty -= quantity;
    if (this.qty <= 1e-9) {
      // fecha resíduos numéricos quando esvazia
      this.qty = 0;
      this.valueCents = 0;
    }
    return consumedCents;
  }

  /**
   * Transfere `quantity` para outro grupo, transportando o custo contábil
   * gerencial correspondente. Sem receita, lucro ou nova compra (§4.1).
   */
  transferTo(dest: StockGroup, quantity: number): Cents {
    const carried = this.consume(quantity);
    dest.valueCents += carried;
    dest.qty += quantity;
    return carried;
  }
}
