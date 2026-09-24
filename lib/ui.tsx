import { formatBRLcents } from './brl';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 'var(--e-3)' }}>
      <h1 style={{ margin: 0, color: 'var(--verde-escuro)' }}>{title}</h1>
      {subtitle && <p style={{ margin: '4px 0 0', color: '#55655c' }}>{subtitle}</p>}
    </header>
  );
}

export function Money({ cents }: { cents: number }) {
  return <span className="num">{formatBRLcents(cents)}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="estado incompleto" style={{ marginTop: 12 }}>
      • {children}
    </p>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  placeholder,
  defaultValue,
  required,
  step,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  step?: string;
  help?: string;
}) {
  return (
    <div className="campo">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        step={step}
        inputMode={type === 'number' ? 'decimal' : undefined}
      />
      {help && <span className="ajuda">{help}</span>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--borda)',
                  color: '#55655c',
                  fontSize: '0.82rem',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
