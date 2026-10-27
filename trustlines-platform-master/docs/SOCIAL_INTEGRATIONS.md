# Social media integrations

The Social Media page (`/marketing/social`) can connect to the platforms themselves. Once a platform is connected:

- followers and post results sync every night, or on demand with **Sync now**;
- posts written in the ERP publish when their time comes, or right away with **Publish now**.

| Platform | Sync followers + results | Publish from the ERP |
|---|---|---|
| Instagram (Business / Creator) | ✅ | ✅ image or Reel (video) |
| Facebook Page | ✅ | ✅ text, image or video |
| LinkedIn company page | ✅ (needs Community Management API) | ✅ text or image |
| YouTube channel | ✅ | — (upload in YouTube Studio) |

Accounts that aren't connected still work by hand, as they did before.

## 1. Database

Apply these migrations, on the TEST DB first:

- `127_pr_workspace.sql`
- `128_social_integrations.sql`

Both only add tables and columns.

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Variable | What |
|---|---|
| `APP_ENCRYPTION_KEY` | **Required for every platform.** 32 random bytes in base64 (`openssl rand -base64 32`). It encrypts the stored platform tokens. If it changes, every platform has to be connected again. |
| `META_APP_ID`, `META_APP_SECRET` | Meta app (Instagram + Facebook) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client (YouTube) |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn app |
| `META_GRAPH_VERSION` | Optional. Defaults to `v23.0`. |
| `LINKEDIN_API_VERSION` | Optional, `YYYYMM`. Defaults to `202609`. LinkedIn supports each version for about a year, so move it forward when LinkedIn warns. |
| `NEXT_PUBLIC_APP_URL` | Must be the real address of the ERP, because the redirect URIs below are built from it. |

A platform only shows a **Connect** button once its variables and `APP_ENCRYPTION_KEY` are set. Until then, the page lists what's missing to managers.

## 3. Redirect URIs to register

Each URI has to match exactly, so register one for production and one for local development (`http://localhost:3000/...`).

- Meta: `https://<erp-domain>/api/marketing/social/callback/meta`
- Google: `https://<erp-domain>/api/marketing/social/callback/google`
- LinkedIn: `https://<erp-domain>/api/marketing/social/callback/linkedin`

## 4. Meta app (Instagram + Facebook)

1. **Instagram account.** The account must be **Business** or **Creator** and linked to the company Facebook Page: Instagram → Settings → Account type, then Page → Linked accounts.
2. **Create the app.** In [developers.facebook.com](https://developers.facebook.com), go to My Apps → Create app, choose the *Other* / *Business* type, and pick the company Business portfolio.
3. **Add Facebook Login for Business.** Under Settings → Valid OAuth Redirect URIs, enter the Meta URI from step 3.
4. **Add the Instagram product** (*Instagram API with Facebook Login*).
5. **Copy the keys.** App settings → Basic gives the App ID and App Secret. Put them in `META_APP_ID` and `META_APP_SECRET`.
6. **Add the team.** While the app is in **Development mode**, only people with a role on it (App roles → Administrators / Testers) can connect. That's enough for the team, and it skips Meta's app review.

   Going *Live* later needs App Review for these permissions:
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - `read_insights`, `business_management`
   - `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`
7. **Connect.** In the ERP, open Social Media → Accounts → **Instagram & Facebook → Connect**. On Meta's screen, **tick the company Page and its Instagram account**. If nothing is ticked, no accounts are linked.

Instagram limits publishing to 100 posts per 24 hours. Images must be JPEG; ImageKit images are converted automatically.

## 5. Google (YouTube)

1. **Create the client.** In Google Cloud Console, go to APIs & Services:
   - enable **YouTube Data API v3**;
   - set up the OAuth consent screen as *Internal* if the channel belongs to the company Google Workspace, otherwise *External* with the team as test users;
   - under Credentials, create an OAuth client ID of type *Web application* and enter the Google redirect URI.
2. **Set the keys** in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **Connect.** Sign in with the Google account that owns or manages the channel.

## 6. LinkedIn

1. **Create the app.** In [linkedin.com/developers](https://www.linkedin.com/developers), create an app linked to the company page, then have a page admin verify the page.
2. **Request the product.** Under Products, request **Community Management API**. LinkedIn reviews this request, which can take days to weeks. Without it, the connection fails with a permissions error.
3. **Set up auth.** Under Auth, add the LinkedIn redirect URI, and copy the Client ID and Secret into `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
4. **Connect** with a LinkedIn user who is an **admin** of the company page.

LinkedIn logins last about 60 days. Unless LinkedIn has given the app refresh tokens, a manager has to press **Reconnect** before then. The card shows the expiry date.

## How it runs

- **`/api/cron/social-sync`**, nightly at 04:30 UTC: reads followers plus the latest 50 posts per account, with insights for the newest 25.
- **`/api/cron/social-publish`**, every 15 minutes: publishes posts whose status is **Scheduled** and whose **Publish automatically at** time has passed. A post is locked while it publishes, so it can't go out twice.
  - If a publish is cut off half-way, the post is marked **Failed** instead of being retried, because the platform may already have it.
  - The error is shown on the post. Saving the post again retries it at its time.
- **Who can do what:**
  - Only Marketing managers (`MARKETING_MANAGE_ROLES`) can connect or disconnect a platform.
  - Anyone in Marketing can sync, schedule and publish.
- **Token storage:** tokens are encrypted with `APP_ENCRYPTION_KEY` and never sent to the browser.
- **Disconnect:** wipes the tokens. The accounts keep their history and become manual.
