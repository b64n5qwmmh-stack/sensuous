import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  NOTION_API_KEY: z.string().min(1).optional(),
  NOTION_EMPLOYEES_DATA_SOURCE_ID: z.string().uuid().optional(),
  NOTION_SHIFTS_DATA_SOURCE_ID: z.string().uuid().optional(),
  NOTION_ATTENDANCE_DATA_SOURCE_ID: z.string().uuid().optional(),
  NOTION_SCHEDULE_IMPORTS_DATA_SOURCE_ID: z.string().uuid().optional(),
});

export const env = schema.parse({
  APP_URL: process.env.APP_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_EMPLOYEES_DATA_SOURCE_ID: process.env.NOTION_EMPLOYEES_DATA_SOURCE_ID,
  NOTION_SHIFTS_DATA_SOURCE_ID: process.env.NOTION_SHIFTS_DATA_SOURCE_ID,
  NOTION_ATTENDANCE_DATA_SOURCE_ID: process.env.NOTION_ATTENDANCE_DATA_SOURCE_ID,
  NOTION_SCHEDULE_IMPORTS_DATA_SOURCE_ID: process.env.NOTION_SCHEDULE_IMPORTS_DATA_SOURCE_ID,
});
