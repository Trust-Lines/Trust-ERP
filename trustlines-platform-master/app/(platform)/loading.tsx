export default function PlatformLoading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 28, width: 220 }} />
          <div className="skeleton" style={{ height: 13, width: 140 }} />
        </div>
        <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[160, 110, 110, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', gap: 16, padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          {['22%', '18%', '14%', '14%', '12%', '10%'].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 11, width: w }} />
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, r) => (
          <div key={r} style={{
            display: 'flex', gap: 16, alignItems: 'center', padding: '14px 18px',
            borderBottom: r < 8 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ height: 13, width: `${45 + ((r * 7) % 35)}%` }} />
              <div className="skeleton" style={{ height: 11, width: `${25 + ((r * 5) % 25)}%` }} />
            </div>
            <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 999, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 999, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
