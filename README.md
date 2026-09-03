# Sensum Staff OS

Telegram Mini App and backend for attendance, quality inspections, KPI and weekly Excel schedule imports.

## Current foundation

- Telegram Mini App entry point and secure Telegram `initData` validation.
- Employee lookup by immutable Telegram ID in the existing Notion **Employees** data source.
- Telegram webhook route with a `/start` flow that sends the Mini App button.
- Notion-ready data-source IDs for Employees, Shifts, Attendance and Schedule Imports.

## Local start

1. Copy `.env.example` to `.env.local` and fill the secrets.
2. Run `npm install`.
3. Run `npm run dev`.

## Deployment sequence

1. Push this directory to a private GitHub repository.
2. Deploy it on Vercel or Railway and set the environment variables.
3. Create a Telegram bot through BotFather and set its Mini App domain to `APP_URL`.
4. Share the Sensum Notion databases with the Notion integration.
5. Set the Telegram webhook to `https://APP_URL/api/telegram/webhook` with `TELEGRAM_WEBHOOK_SECRET`.

The backend is intentionally not enabled until Telegram and Notion secrets are supplied.
