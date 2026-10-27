// Ready-made SMTP settings for the common mailbox providers (Settings → Email sending).
// No server imports here — the Settings page (a client component) reads this too.

export const SMTP_PRESETS = [
  {
    value: 'google', label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 465, secure: true, dailyLimit: 400,
    help: 'Use an App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.',
  },
  {
    value: 'microsoft', label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, secure: false, dailyLimit: 400,
    help: 'Your admin must allow “Authenticated SMTP” for your mailbox. With MFA on, use an app password.',
  },
  { value: 'custom', label: 'Other (custom SMTP)', host: '', port: 587, secure: false, dailyLimit: 300, help: 'Ask your email provider for the SMTP server, port and security type.' },
] as const;
