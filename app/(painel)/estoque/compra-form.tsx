'use client';
import { useState } from 'react';
import { registrarCompraMaterial } from './actions';
import { Ajuda } from '@/lib/ajuda';

type M = { id: string; label: string };

export function CompraForm({ materials }: { materials: M[] }) {
  const [sel, setSel] = useState(materials[0]?.id ?? '__novo__');
  const novo = sel === '__novo__';

  return (
    <form action={registrarCompraMaterial}>
      <div className="campo">
        <label htmlFor="materialId">O que você comprou?</label>
        <select id="materialId" name="materialId" value={sel} onChange={(e) => setSel(e.target.value)}>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="__novo__">➕ Novo material…</option>
        </select>
      </div>

      {novo && (
        <div style={{ background: 'var(--areia)', borderRadius: 'var(--r-1)', padding: 12, marginBottom: 'var(--e-2)' }}>
          <div className="campo">
            <label htmlFor="novoNome">Nome do material</label>
            <input id="novoNome" name="novoNome" placeholder="Tecido, forro, elástico, argola…" required={novo} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
            <div className="campo">
              <label htmlFor="cor">Cor (opcional)</label>
              <input id="cor" name="cor" placeholder="vermelho" />
            </div>
            <div className="campo">
              <label htmlFor="unit">
                Medida
                <Ajuda>Como você mede esse material: em metros (tecido, elástico) ou em unidades (argolas, bojos, reguladores).</Ajuda>
              </label>
              <select id="unit" name="unit">
                <option value="metro">metros</option>
                <option value="unidade">unidades</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
        <div className="campo">
          <label htmlFor="qty">Quanto comprou?</label>
          <input id="qty" name="qty" inputMode="decimal" placeholder="10" required />
          <span className="ajuda">na medida do material (ex.: 10 metros)</span>
        </div>
        <div className="campo">
          <label htmlFor="total">Quanto pagou no total? (R$)</label>
          <input id="total" name="total" inputMode="decimal" placeholder="200,00" required />
        </div>
      </div>

      <button className="btn">Registrar compra</button>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </form>
  );
}
