export default function ProjectDetailLoading() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div className="skeleton" style={{ height: 13, width: 55 }} />
        <span style={{ color: 'var(--fg-faint)', fontSize: 13 }}>/</span>
        <div className="skeleton" style={{ height: 13, width: 200 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[130, 110, 80, 60, 100, 80].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 24, width: w, borderRadius: 999 }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 11, width: 220 }} />
          <div className="skeleton" style={{ height: 28, width: 340 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="skeleton" style={{ height: 22, width: 110, borderRadius: 999 }} />
            <div className="skeleton" style={{ height: 14, width: 180 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 30, width: 70, borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 30, width: 75, borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 30, width: 130, borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 1 }}>
        {[80, 90, 130, 160, 50].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 34, width: w, borderRadius: '4px 4px 0 0' }} />
        ))}
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="skeleton" style={{ height: 11, width: 60 }} />
                <div className="skeleton" style={{ height: 16, width: 80 }} />
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="skeleton" style={{ height: 13, width: `${50 + i * 8}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="skeleton" style={{ height: 16, width: 100 }} />
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="skeleton" style={{ height: 11, width: 60 }} />
                    <div className="skeleton" style={{ height: 22, width: 80 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="skeleton" style={{ height: 16, width: 110 }} />
            </div>
            <div>
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 18px',
                    borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 13, width: '65%', marginBottom: 5 }} />
                    <div className="skeleton" style={{ height: 11, width: '40%' }} />
                  </div>
                  <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="detail-rail" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="rail-card">
            <div className="skeleton" style={{ height: 11, width: 40, marginBottom: 12 }} />
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0' }}>
                <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: '70%', marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 11, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="skeleton" style={{ height: 11, width: 100, marginBottom: 12 }} />
            {[1, 2].map(i => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 11, width: '95%', marginBottom: 3 }} />
                <div className="skeleton" style={{ height: 11, width: '60%' }} />
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="skeleton" style={{ height: 11, width: 80, marginBottom: 12 }} />
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton" style={{ height: 12, width: 60 }} />
                <div className="skeleton" style={{ height: 12, width: 80 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
