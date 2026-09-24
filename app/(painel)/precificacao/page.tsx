'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  unitCostFromPurchase,
  componentCostPerPiece,
  costPerPieceFromBatch,
} from '@/src/domain/index';
import { formatBRLcents } from '@/lib/brl';

type Sim = {
  targetPriceCents: number;
  minPriceCents: number;
  zeroFloorCents: number;
  maxDiscount: { available: boolean; valueCents: number; pct: number; reason?: string };
  evaluation: null | {
    state: string;
    contributionCents: number;
    contributionPct: number | null;
    finalPriceCents: number;
  };
  assumptions: string[];
};

const ESTADO_LABEL: Record<string, string> = {
  dentro_da_meta: 'Dentro da meta',
  abaixo_da_meta: 'Abaixo da meta (respeita o mínimo)',
  abaixo_do_minimo: 'Abaixo do mínimo — exige confirmação',
  contribuicao_negativa: 'Contribuição negativa',
  incompleto: 'Cálculo incompleto',
};

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function reaisToCents(r: number): number {
  return Math.round(r * 100);
}

export default function Precificacao() {
  // entradas guiadas de custo (§1.1)
  const [tecidoPago, setTecidoPago] = useState('200'); // R$ pagos no material
  const [tecidoQtd, setTecidoQtd] = useState('10'); // metros comprados
  const [consumo, setConsumo] = useState('0,5'); // metros por peça
  const [costuraLote, setCosturaLote] = useState('100'); // R$ pagos na costura do lote
  const [costuraPecas, setCosturaPecas] = useState('20'); // peças do lote
  const [outrosReais, setOutrosReais] = useState('0'); // outros custos diretos/peça

  // despesas variáveis, taxa e metas
  const [eReais, setEReais] = useState('3'); // embalagem/frete atribuído (R$)
  const [taxaPct, setTaxaPct] = useState('2,99'); // taxa de pagamento (%)
  const [metaPct, setMetaPct] = useState('35'); // meta de margem (%)
  const [minPct, setMinPct] = useState('20'); // margem mínima (%)
  const [precoPretendido, setPrecoPretendido] = useState(''); // R$ opcional

  const [sim, setSim] = useState<Sim | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [comoCalc, setComoCalc] = useState(false);

  // custo calculado localmente (prévia); o servidor revalida ao salvar
  const custo = useMemo(() => {
    const cmMetro = tecidoQtd ? unitCostFromPurchase(reaisToCents(num(tecidoPago)), num(tecidoQtd)) : 0;
    const custoTecido = componentCostPerPiece(cmMetro, num(consumo));
    const custoCostura = costuraPecas
      ? costPerPieceFromBatch(reaisToCents(num(costuraLote)), num(costuraPecas))
      : 0;
    const outros = reaisToCents(num(outrosReais));
    return { custoTecido, custoCostura, outros, C: custoTecido + custoCostura + outros };
  }, [tecidoPago, tecidoQtd, consumo, costuraLote, costuraPecas, outrosReais]);

  // prévia recalcula automaticamente (debounce), sem botão obrigatório
  useEffect(() => {
    const body = {
      C: custo.C,
      E: reaisToCents(num(eReais)),
      t: num(taxaPct) / 100,
      goalMargin: num(metaPct) / 100,
      minMargin: num(minPct) / 100,
      desiredPriceCents: precoPretendido ? reaisToCents(num(precoPretendido)) : undefined,
    };
    const id = setTimeout(async () => {
      try {
        const r = await fetch('/api/pricing/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) {
          setErro(j.error ?? 'Não foi possível calcular');
          setSim(null);
        } else {
          setErro(null);
          setSim(j);
        }
      } catch {
        setErro('Falha de conexão');
      }
    }, 300);
    return () => clearTimeout(id);
  }, [custo.C, eReais, taxaPct, metaPct, minPct, precoPretendido]);

  return (
    <div>
      <h1 style={{ marginTop: 0, color: 'var(--verde-escuro)' }}>Simular preço</h1>
      <p style={{ color: '#55655c', marginTop: 4 }}>
        Preencha o que você sabe. O sistema calcula custo, preço sugerido e limite de desconto.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e-3)' }} className="grade">
        {/* ENTRADAS */}
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Custos da peça</h2>

          <div className="campo">
            <label>Quanto pagou no tecido? (R$)</label>
            <input value={tecidoPago} onChange={(e) => setTecidoPago(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Qual quantidade comprou? (metros)</label>
            <input value={tecidoQtd} onChange={(e) => setTecidoQtd(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Quanto material esta peça usa? (metros)</label>
            <input value={consumo} onChange={(e) => setConsumo(e.target.value)} inputMode="decimal" />
            <span className="ajuda">
              Tecido por peça: <strong>{formatBRLcents(custo.custoTecido)}</strong>
            </span>
          </div>

          <div className="campo">
            <label>Quanto pagou na costura do lote? (R$)</label>
            <input value={costuraLote} onChange={(e) => setCosturaLote(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Quantas peças o lote produziu?</label>
            <input value={costuraPecas} onChange={(e) => setCosturaPecas(e.target.value)} inputMode="decimal" />
            <span className="ajuda">
              Costura por peça: <strong>{formatBRLcents(custo.custoCostura)}</strong>
            </span>
          </div>

          <div className="campo">
            <label>Outros custos diretos por peça (R$)</label>
            <input value={outrosReais} onChange={(e) => setOutrosReais(e.target.value)} inputMode="decimal" />
          </div>
        </section>

        {/* PREFERÊNCIAS */}
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Vendas e metas</h2>
          <div className="campo">
            <label>Embalagem/frete por peça (R$)</label>
            <input value={eReais} onChange={(e) => setEReais(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Taxa de pagamento (%)</label>
            <input value={taxaPct} onChange={(e) => setTaxaPct(e.target.value)} inputMode="decimal" />
            <span className="ajuda">Ex.: taxa de cartão da modalidade escolhida.</span>
          </div>
          <div className="campo">
            <label>Meta de margem (%)</label>
            <input value={metaPct} onChange={(e) => setMetaPct(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Margem mínima (%)</label>
            <input value={minPct} onChange={(e) => setMinPct(e.target.value)} inputMode="decimal" />
          </div>
          <div className="campo">
            <label>Testar um preço pretendido (R$, opcional)</label>
            <input value={precoPretendido} onChange={(e) => setPrecoPretendido(e.target.value)} inputMode="decimal" />
          </div>
        </section>
      </div>

      {/* RESULTADOS (somente leitura) */}
      <section className="resultado" style={{ marginTop: 'var(--e-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Resultado calculado</h2>
          <button className="btn secundario" onClick={() => setComoCalc((v) => !v)}>
            {comoCalc ? 'Ocultar' : 'Como foi calculado?'}
          </button>
        </div>

        {erro && (
          <p className="estado abaixo_do_minimo" role="alert" style={{ marginTop: 12 }}>
            ⚠ {erro}
          </p>
        )}

        {sim && !erro && (
          <>
            <div style={{ marginTop: 12 }} className="num">
              <div className="linha-resultado">
                <span className="rot">Custo direto da peça (C)</span>
                <span className="val">{formatBRLcents(custo.C)}</span>
              </div>
              <div className="linha-resultado">
                <span className="rot">Preço-alvo (na meta)</span>
                <span className="val">{formatBRLcents(sim.targetPriceCents)}</span>
              </div>
              <div className="linha-resultado">
                <span className="rot">Preço mínimo</span>
                <span className="val">{formatBRLcents(sim.minPriceCents)}</span>
              </div>
              <div className="linha-resultado">
                <span className="rot">Piso sem contribuição p/ fixos</span>
                <span className="val">{formatBRLcents(sim.zeroFloorCents)}</span>
              </div>
              <div className="linha-resultado">
                <span className="rot">Desconto máximo seguro</span>
                <span className="val">
                  {sim.maxDiscount.available
                    ? `${formatBRLcents(sim.maxDiscount.valueCents)} (${(sim.maxDiscount.pct * 100).toFixed(2)}%)`
                    : '—'}
                </span>
              </div>
            </div>

            {sim.evaluation && (
              <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`estado ${sim.evaluation.state}`}>
                  {sim.evaluation.state === 'dentro_da_meta' ? '✓' : '•'}{' '}
                  {ESTADO_LABEL[sim.evaluation.state] ?? sim.evaluation.state}
                </span>
                <span className="num">
                  Contribuição: <strong>{formatBRLcents(sim.evaluation.contributionCents)}</strong>
                  {sim.evaluation.contributionPct !== null &&
                    ` (${(sim.evaluation.contributionPct * 100).toFixed(2)}%)`}
                </span>
              </div>
            )}

            {comoCalc && (
              <ul style={{ marginTop: 12, color: '#55655c', fontSize: '0.85rem' }}>
                {sim.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <style>{`@media (max-width: 720px){ .grade{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
