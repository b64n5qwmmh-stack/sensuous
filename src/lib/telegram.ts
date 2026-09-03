import crypto from "node:crypto";
import { env } from "@/lib/env";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

export function validateTelegramInitData(initData: string): TelegramUser {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram bot is not configured.");

  const values = new URLSearchParams(initData);
  const hash = values.get("hash");
  if (!hash) throw new Error("Telegram authorization data has no hash.");

  values.delete("hash");
  const dataCheckString = [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
    throw new Error("Telegram authorization signature is invalid.");
  }

  const authDate = Number(values.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86_400) {
    throw new Error("Telegram authorization data has expired.");
  }

  const rawUser = values.get("user");
  if (!rawUser) throw new Error("Telegram authorization data has no user.");
  return JSON.parse(rawUser) as TelegramUser;
}

export async function sendTelegramMessage(chatId: number, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.APP_URL) throw new Error("Telegram bot is not configured.");

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "☕ Открыть Sensum Staff", web_app: { url: env.APP_URL } }]],
      },
    }),
  });

  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${await response.text()}`);
}
