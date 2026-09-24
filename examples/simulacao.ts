/**
 * simulacao.ts — exemplo executável do motor (npm run demo).
 * Reproduz o fluxo "a proprietária informa; o sistema calcula" (§1.1) para uma
 * peça, sem que ninguém precise montar fórmula. Números fictícios.
 */
import {
  unitCostFromPurchase,
  componentCostPerPiece,
  costPerPieceFromBatch,
  targetPrice,
  zeroContributionFloor,
  minimumPrice,
  maxDiscount,
  evaluateDiscount,
  formatBRL,
  type PriceInputs,
} from '../src/domain/index.ts';

// 1) A proprietária informa custos em linguagem simples ------------------------
const tecidoPorMetro = unitCostFromPurchase(20000, 10); // pagou R$200 por 10 m
const custoTecido = componentCostPerPiece(tecidoPorMetro, 0.5); // usa 0,5 m/peça
const custoCostura = costPerPieceFromBatch(10000, 20); // R$100 de costura / 20 peças
const C = custoTecido + custoCostura; // custo direto unitário
const E = 300; // embalagem+frete subsidiado atribuídos à unidade (R$3,00)

// 2) Preferências comerciais (assistente explica; não são "descobertas") -------
const t = 0.0299; // taxa de cartão configurada (2,99%)
const inputs: PriceInputs = { C, E, t };
const meta = 0.35; // meta de margem de contribuição
const minima = 0.2; // margem mínima

// 3) O sistema calcula tudo ----------------------------------------------------
const precoAlvo = targetPrice({ ...inputs, m: meta });
const piso = zeroContributionFloor(inputs);
const precoMin = minimumPrice(inputs, minima);
const desc = maxDiscount(precoAlvo, precoMin);

console.log('KAIS — simulação de preço (exemplo)');
console.log('─'.repeat(48));
console.log('Custo do tecido/peça .......', formatBRL(custoTecido));
console.log('Custo da costura/peça ......', formatBRL(custoCostura));
console.log('Custo direto (C) ...........', formatBRL(C));
console.log('Despesas variáveis (E) .....', formatBRL(E));
console.log('Taxa aplicada (t) ..........', (t * 100).toFixed(2) + '%');
console.log('─'.repeat(48));
console.log('Preço-alvo (meta 35%) ......', formatBRL(precoAlvo));
console.log('Preço mínimo (mín. 20%) ....', formatBRL(precoMin));
console.log('Piso sem contribuição ......', formatBRL(piso), '(fixos ainda a cobrir)');
console.log('─'.repeat(48));
if (desc.available) {
  console.log('Desconto máximo seguro .....', formatBRL(desc.valueCents), `(${(desc.pct * 100).toFixed(2)}%)`);
}

// 4) A proprietária testa um desconto pretendido -------------------------------
const precoComDesconto = precoAlvo - 500; // quer dar R$5 de desconto
const aval = evaluateDiscount(precoAlvo, precoComDesconto, inputs, {
  minMargin: minima,
  goalMargin: meta,
});
console.log('\nSe vender por', formatBRL(precoComDesconto) + ':');
console.log('  contribuição ..............', formatBRL(aval.contributionCents),
  aval.contributionPct !== null ? `(${(aval.contributionPct * 100).toFixed(2)}%)` : '');
console.log('  situação ..................', aval.state);
