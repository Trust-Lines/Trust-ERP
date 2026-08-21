import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP credentials not set — skipping email to', to);
    return;
  }
  await transporter.sendMail({
    from: `"Trust-Lines" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export function approvalRequestHtml({
  recipientName,
  approverName,
  projectName,
  projectCode,
  docLabel,
  versionLabel,
  actionUrl,
}: {
  recipientName: string;
  approverName:  string;
  projectName:   string;
  projectCode:   string;
  docLabel:      string;
  versionLabel:  string;
  actionUrl:     string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#0d9488;padding:24px 28px;">
      <div style="font-size:18px;font-weight:700;color:white;letter-spacing:-0.3px;">Trust-Lines</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Design & Supply</div>
    </div>
    <!-- Body -->
    <div style="padding:28px 28px 20px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;">Hi ${approverName},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
        A new document is awaiting your approval.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="color:#6b7280;padding:3px 0;width:110px;">Project</td><td style="color:#111827;font-weight:600;">${projectName}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Code</td><td style="color:#111827;">${projectCode}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Document</td><td style="color:#111827;font-weight:600;">${docLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Version</td><td style="color:#111827;">${versionLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Requested by</td><td style="color:#111827;">${recipientName}</td></tr>
        </table>
      </div>

      <a href="${actionUrl}" style="display:inline-block;background:#0d9488;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:7px;">
        Review &amp; Approve →
      </a>
    </div>
    <!-- Footer -->
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Trust-Lines Design and Supply · This is an automated message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function approvalRejectedHtml({
  rejectorName, recipientName, projectName, projectCode, docLabel, versionLabel, actionUrl, notes,
}: {
  rejectorName:  string;
  recipientName: string;
  projectName:   string;
  projectCode:   string;
  docLabel:      string;
  versionLabel:  string;
  actionUrl:     string;
  notes?:        string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:24px 28px;">
      <div style="font-size:18px;font-weight:700;color:white;">Trust-Lines</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Document Rejected</div>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;">Hi ${recipientName},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
        A document has been <strong style="color:#dc2626;">rejected</strong> by ${rejectorName}.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 18px;margin-bottom:${notes ? '12px' : '22px'};">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="color:#6b7280;padding:3px 0;width:110px;">Project</td><td style="color:#111827;font-weight:600;">${projectName}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Code</td><td style="color:#111827;">${projectCode}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Document</td><td style="color:#111827;font-weight:600;">${docLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Version</td><td style="color:#111827;">${versionLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Rejected by</td><td style="color:#dc2626;font-weight:600;">${rejectorName}</td></tr>
        </table>
      </div>
      ${notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:22px;font-size:13px;color:#92400e;"><strong>Reason:</strong> ${notes}</div>` : ''}
      <a href="${actionUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:7px;">
        View Document →
      </a>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Trust-Lines Design and Supply · This is an automated message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function approvalCompletedHtml({
  approverName,
  projectName,
  projectCode,
  docLabel,
  versionLabel,
  actionUrl,
  allApproved,
}: {
  approverName:  string;
  projectName:   string;
  projectCode:   string;
  docLabel:      string;
  versionLabel:  string;
  actionUrl:     string;
  allApproved:   boolean;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#0d9488;padding:24px 28px;">
      <div style="font-size:18px;font-weight:700;color:white;">Trust-Lines</div>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#111827;">
        ${allApproved ? '✅ All approvals complete' : `✅ Stage approved by ${approverName}`}
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="color:#6b7280;padding:3px 0;width:110px;">Project</td><td style="color:#111827;font-weight:600;">${projectName}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Code</td><td style="color:#111827;">${projectCode}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Document</td><td style="color:#111827;font-weight:600;">${docLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0;">Version</td><td style="color:#111827;">${versionLabel}</td></tr>
        </table>
      </div>
      <a href="${actionUrl}" style="display:inline-block;background:#0d9488;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:7px;">
        View Project →
      </a>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Trust-Lines Design and Supply · This is an automated message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
