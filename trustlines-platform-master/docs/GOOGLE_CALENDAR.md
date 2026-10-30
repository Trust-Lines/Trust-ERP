# Google Calendar & Meet

Each person connects **their own** Google account in **Settings → Google account**. After that:

- **My meetings** (sidebar → Dashboard) lists their Google Calendar meetings, covering the last 60 days and the next 120. Each meeting shows who it was with (the matching Contact or Customer), a **Join** link, and, after a Google Meet call, its **Recording** and **Transcript**.
- A **Contact page** (Emails & activity tab) lists the meetings anyone on the team had with that Contact.
- **Schedule meeting** (My meetings and Contact pages) creates the event on the person's own calendar with a Google Meet link. Google emails the invitations.
- **Customer 360 → Add Meeting** has a "Send a Google Calendar invitation with a Google Meet link" option.

Everyone sees only their own calendar. Meetings are linked to a Contact or Customer by attendee email; colleagues on the company domain are ignored.

## Setup (once, by an admin)

1. **Google Cloud project.** Use the same project as YouTube, or a new one.
   - Go to **APIs & Services → Library** and enable **Google Calendar API** and **Google Meet REST API**.
2. **OAuth consent screen.**
   - Set **User type: Internal**. Only accounts in the company's Google Workspace can connect, and Google's app verification isn't needed.
   - Add these scopes:
     - `.../auth/calendar.events`
     - `.../auth/meetings.space.readonly`
     - `openid`
     - `email`
3. **Credentials.** Use the existing Web OAuth client (the YouTube one), or create a **Web application** OAuth client. Add these **Authorized redirect URIs**:
   - `https://<erp-domain>/api/me/google/callback`
   - `http://localhost:3000/api/me/google/callback`, for local development

   YouTube keeps its own URI, `.../api/marketing/social/callback/google`.
4. **Vercel environment variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_ENCRYPTION_KEY` (already set). Then **Redeploy**.
5. **Database:** apply `supabase/migrations/130_google_calendar.sql`.

## How it runs

- **Sync:** every 10 minutes the GitHub Actions workflow (`.github/workflows/frequent-crons.yml`) calls `/api/cron/google-sync`. Each calendar is synced at most every 30 minutes. Opening My meetings also syncs if the copy is more than 10 minutes old, and there is a **Sync now** button.
- **Read-only:** a sync never changes anything in Google. Google is only changed when someone creates or cancels a meeting from the ERP.
- **Recordings and transcripts:** these are looked up for Meet calls that ended in the last 30 days.
  - Google only keeps them when the call was recorded or transcribed, which needs a Workspace plan that supports it.
  - The links open the files in the organizer's Google Drive, with Google's own sharing rules.
- **Tokens:** they are encrypted with `APP_ENCRYPTION_KEY`. **Disconnect** revokes the access at Google and deletes the person's synced copy.
