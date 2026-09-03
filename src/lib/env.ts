import { z } from "zod";

const optionalValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? undefined : value), schema.optional());

const schema = z.object({
  APP_URL: optionalValue(z.string().url()),
  TELEGRAM_BOT_TOKEN: optionalValue(z.string().min(1)),
  TELEGRAM_WEBHOOK_SECRET: optionalValue(z.string().min(16)),
  NOTION_API_KEY: optionalValue(z.string().min(1)),
  NOTION_EMPLOYEES_DATA_SOURCE_ID: optionalValue(z.string().uuid()),
  NOTION_SHIFTS_DATA_SOURCE_ID: optionalValue(z.string().uuid()),
  NOTION_ATTENDANCE_DATA_SOURCE_ID: optionalValue(z.string().uuid()),
  NOTION_SCHEDULE_IMPORTS_DATA_SOURCE_ID: optionalValue(z.string().uuid()),
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
