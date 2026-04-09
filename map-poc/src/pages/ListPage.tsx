import Header from '../components/Header';

const FAKE_ROWS = Array.from({ length: 12 }, (_, i) => ({
  id: `LU${String(10000 + i * 137).padStart(6, '0')}`,
  nummer: String(1000 + i * 31),
  kanton: 'LU',
  flaeche: 300 + i * 412,
  vollstaendigkeit: i % 4 === 0 ? 'unvollständig' : 'vollständig',
}));

export default function ListPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f5f6f8',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Header />

      <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(12px, 4vw, 24px) clamp(28px, 6vw, 40px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 800, color: '#1a1a1a' }}>
            Parzellenliste
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#888' }}>
            Mockup — Dummy-Daten
          </p>

          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f0f2f5' }}>
                    {['NBIdent', 'Nummer', 'Kanton', 'Fläche (m²)', 'Vollständigkeit'].map((heading) => (
                      <th key={heading} style={{ padding: '12px clamp(10px, 2vw, 16px)', textAlign: 'left', fontWeight: 600, color: '#444' }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAKE_ROWS.map((row, index) => (
                    <tr key={row.id} style={{ borderTop: '1px solid #f0f0f0', background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px clamp(10px, 2vw, 16px)', color: '#1a1a1a' }}>{row.id}</td>
                      <td style={{ padding: '10px clamp(10px, 2vw, 16px)' }}>{row.nummer}</td>
                      <td style={{ padding: '10px clamp(10px, 2vw, 16px)' }}>{row.kanton}</td>
                      <td style={{ padding: '10px clamp(10px, 2vw, 16px)' }}>{row.flaeche.toLocaleString()}</td>
                      <td style={{ padding: '10px clamp(10px, 2vw, 16px)' }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 20,
                            background: row.vollstaendigkeit === 'vollständig' ? '#d4edda' : '#fff3cd',
                            color: row.vollstaendigkeit === 'vollständig' ? '#155724' : '#856404',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.vollstaendigkeit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
