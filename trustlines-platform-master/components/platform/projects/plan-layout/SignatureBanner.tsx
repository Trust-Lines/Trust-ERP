'use client';

/** "Set up your signature" / "Signature saved" strip shown to assigned approvers. */
export function SignatureBanner({ isAssignedApprover, userSignature, onOpenSignaturePad }: {
  isAssignedApprover: boolean;
  userSignature: string | null | undefined;
  onOpenSignaturePad: () => void;
}) {
  const noSignatureBanner = isAssignedApprover && userSignature === null;

  return (
    <>
    {noSignatureBanner && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 12,
        background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', borderRadius: 7,
      }}>
        <span style={{ fontSize: 18 }}>✍️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning-fg)' }}>Signature not set up</div>
          <div style={{ fontSize: 11, color: 'var(--status-warning)' }}>Your signature will be embedded in PDFs when you approve documents.</div>
        </div>
        <button
          onClick={onOpenSignaturePad}
          style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: 'var(--status-warning)', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          Set Up Signature
        </button>
      </div>
    )}

    {isAssignedApprover && userSignature && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 10, background: 'var(--status-success-bg)', border: '1px solid var(--status-success-bg)', borderRadius: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={userSignature} alt="Your signature" style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
        <div style={{ flex: 1, fontSize: 11, color: 'var(--status-success)', fontWeight: 600 }}>Signature saved — will appear on approvals</div>
        <button onClick={onOpenSignaturePad} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', textDecoration: 'underline' }}>
          Change
        </button>
      </div>
    )}
    </>
  );
}
