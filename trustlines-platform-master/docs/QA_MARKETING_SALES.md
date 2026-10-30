# QA checklist — Marketing & Sales handover

Run on the **TEST** environment with the test accounts: marketing_pr, marketing_manager, sales_rep, sales_marketing_manager and general_manager.

Use your own email addresses as Contacts, so no real customer receives an email.

For every check, record ✅ or ❌. For each ❌, note the screen, the steps and what happened, and add a screenshot.

## Before starting
- **Migrations:** 127, 128, 129, 130 and 131 are applied on TEST.
- **Vercel env:** `APP_ENCRYPTION_KEY`, `MAIL_FOOTER_ADDRESS` and `CRON_SECRET` are set. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are only needed for section 9.

## 1. Roles & page access (`/roles`, every account)
| # | Check | Expected |
|---|---|---|
| 1.1 | Open Roles & Permissions | Every page is listed in groups: General, Marketing, Sales, Projects & Supply, Operations, Finance, Admin |
| 1.2 | As GM, switch **Contact Manager** off for marketing_pr, then save | marketing_pr no longer sees Contact Manager in the sidebar, and `/marketing/contact-manager` sends them to the Dashboard |
| 1.3 | Switch it back on | The link and the page are back |
| 1.4 | Log in as sales_rep | Sales pages are visible (CRM Board, Tasks, Handoffs, Sales Trash); Sales Team and Sales Dashboard are not |
| 1.5 | Log in as marketing_pr | There is no Sales group, and no prices or margins are visible anywhere |

## 2. Contacts (marketing_pr)
| # | Check | Expected |
|---|---|---|
| 2.1 | Contacts → click quick query **Follow-up overdue** | Only Contacts whose target contact date has passed are listed |
| 2.2 | The target contact date column | Shows the same date as the Contact page; it is not one day earlier |
| 2.3 | Contact Manager while the network is off (DevTools → Offline) | An error toast appears and the list doesn't turn empty |

## 3. Email sending (every account that sends)
| # | Check | Expected |
|---|---|---|
| 3.1 | Settings → Email sending → choose Google, enter an App Password → **Save & send test email** | A green **Connected** badge appears and the test email arrives |
| 3.2 | Use a wrong password | A clear message about the App Password appears, not "Could not send" |
| 3.3 | Open a Contact → **Emails & activity** → **Send email** with a template | The email arrives from your mailbox and shows in the list as **Sent**. Opening it adds an "opened" eye icon |
| 3.4 | Send to a made-up address on a real domain (for example `nobody-xyz@gmail.com`) | Either an error appears or, after a bounce, the address is on the **Do-not-email list** |

## 4. Email campaigns (marketing_manager)
| # | Check | Expected |
|---|---|---|
| 4.1 | Email Campaigns → New campaign → set the audience to your own test Contacts | The recipient count updates live |
| 4.2 | Template, preview, then **Send a test to me** | The test arrives with **[Test]** in the subject and an Unsubscribe link at the bottom |
| 4.3 | **Send now** | The report shows progress, Delivered and Opened |
| 4.4 | Click a link in the received email | Clicked goes up and the link appears under "Links clicked" |
| 4.5 | Click **Unsubscribe** → press the button | "You're unsubscribed" appears, and the address shows on the Do-not-email list |
| 4.6 | Send another campaign to the same audience | The unsubscribed address is not counted |
| 4.7 | **Sent emails** tab | Totals, "Who sent them", and each email with its content |

## 5. Social media & calendar (marketing_pr)
| # | Check | Expected |
|---|---|---|
| 5.1 | Social Media → Add manual account → Record followers twice on different dates | The account card shows the % change |
| 5.2 | New post → status Published → enter results | Engagement and rate appear in the table |
| 5.3 | Calendar → click a day → add an event spanning 3 days | It shows on all three days; editing and deleting work |
| 5.4 | A planned post and a campaign with dates | Both show on the calendar and link to their pages |

## 6. Website CMS (marketing_manager)
| # | Check | Expected |
|---|---|---|
| 6.1 | Blog → new post without a cover → save as draft | It saves, and the list shows an empty box instead of a broken image |
| 6.2 | Try to publish it | "Add a cover image before publishing" appears |

## 7. Estimate & contract (sales_rep, on an accepted Opportunity)
| # | Check | Expected |
|---|---|---|
| 7.1 | Open the deal → **Estimate & Contract** → New estimate with 3 lines, a 10 % discount and 8 % tax | The totals add up (check by hand) |
| 7.2 | **Send** with "Email the link" ticked to your own address | The email arrives, and a link is shown once with a Copy button |
| 7.3 | Open the link in a private window | You see the estimate with your company name and the lines; Print / save as PDF works |
| 7.4 | Accept with your name | The deal shows **Accepted by …**, and the sales owner gets a notification |
| 7.5 | **Draft contract** → edit the text → Send | A link is created |
| 7.6 | Open the contract link → tick the box, type your name → **Sign** | "Signed electronically by …" appears; the deal shows **Contract signed — you can close the deal as Won** |
| 7.7 | Open the old estimate link after sending a new version | It says the estimate was replaced or is no longer valid |
| 7.8 | Log in as marketing_pr and open the same deal | The card says "handled by Sales" with no error |

## 8. Deals (sales_rep)
| # | Check | Expected |
|---|---|---|
| 8.1 | Handoffs → a deal with no project | **Close Won** is disabled, with the tooltip "Accept the Opportunity first" |
| 8.2 | New lead → fill only Company → Create | "Nothing to save yet" appears, and no empty lead is created |

## 9. Google (only once the Google Cloud values are set)
| # | Check | Expected |
|---|---|---|
| 9.1 | Settings → Google account → Connect | Google consent appears, then "Google connected" |
| 9.2 | My meetings | Your Google Calendar meetings are listed; a meeting with a Contact's address shows that Contact's name |
| 9.3 | Schedule meeting from a Contact page | A Google invite with a Meet link arrives at the attendee |
| 9.4 | Customer 360 → Add Meeting with the Google invite option | An invite is sent and **Join Google Meet** shows on the meeting |
| 9.5 | Cancel the meeting in My meetings | The attendee gets a cancellation |

## Report back
Send the ❌ list, one line per failure: **#, account, what happened**. Anything under section 1 (who can see what) or 7 (prices / signatures) is a blocker for the handover.
