import Link from 'next/link';

export default function ProjectNotFound() {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 12, textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 56, opacity: 0.12, lineHeight: 1 }}>⊘</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-default)', margin: 0 }}>
        Project not found
      </h2>
      <p style={{ fontSize: 14, color: 'var(--fg-subtle)', margin: 0, maxWidth: 340 }}>
        This project doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/projects" className="btn btn-ghost" style={{ marginTop: 8 }}>
        ← Back to projects
      </Link>
    </div>
  );
}
