'use client';
import { useState } from 'react';
import { registrarVenda } from './actions';

type V = { id: string; label: string; tablePriceCents: number };

export function SaleForm({ variants }: { variants: V[] }) {
  const first = variants[0];
  const [variantId, setVariantId] = useState(first?.id ?? '');
  const [price, setPrice] = useState(((first?.tablePriceCents ?? 0) / 100).toFixed(2));
  const [key] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );

  function onPickVariant(id: string) {
    setVariantId(id);
    const v = variants.find((x) => x.id === id);
    if (v && v.tablePriceCents > 0) setPrice((v.tablePriceCents / 100).toFixed(2));
  }

  return (
    <form action={registrarVenda}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="campo">
        <label htmlFor="variantId">Peça</label>
        <select id="variantId" name="variantId" value={variantId} onChange={(e) => onPickVariant(e.target.value)} required>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
        <div className="campo">
          <label htmlFor="unitPrice">Preço (R$)</label>
          <input id="unitPrice" name="unitPrice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <span className="ajuda">preenchido pelo preço de tabela — pode ajustar</span>
        </div>
        <div className="campo">
          <label htmlFor="qty">Quantidade</label>
          <input id="qty" name="qty" type="number" step="1" defaultValue={1} required />
        </div>
        <div className="campo">
          <label htmlFor="installments">Parcelas</label>
          <input id="installments" name="installments" type="number" step="1" defaultValue={1} />
        </div>
        <div className="campo">
          <label htmlFor="status">Situação</label>
          <select id="status" name="status" defaultValue="ENTREGUE">
            <option value="ENTREGUE">Entregue (receita realizada)</option>
            <option value="CONFIRMADO">Confirmado (em carteira)</option>
            <option value="RASCUNHO">Rascunho</option>
          </select>
        </div>
      </div>

      <details style={{ margin: '4px 0 16px' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--verde-escuro)' }}>Frete e cliente (opcional)</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }} className="grade">
          <div className="campo"><label htmlFor="freightCharged">Frete cobrado (R$)</label><input id="freightCharged" name="freightCharged" inputMode="decimal" /></div>
          <div className="campo"><label htmlFor="freightPaid">Frete pago (R$)</label><input id="freightPaid" name="freightPaid" inputMode="decimal" /></div>
          <div className="campo"><label htmlFor="channel">Canal</label><input id="channel" name="channel" placeholder="Instagram, WhatsApp…" /></div>
          <div className="campo"><label htmlFor="customerName">Cliente</label><input id="customerName" name="customerName" /></div>
        </div>
      </details>

      <button className="btn">Registrar venda</button>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </form>
  );
}
