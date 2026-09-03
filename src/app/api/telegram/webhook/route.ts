import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = { message?: { chat: { id: number }; text?: string } };

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  if (update.message?.text === "/start") {
    await sendTelegramMessage(update.message.chat.id, "Добро пожаловать в Sensum Staff OS.");
  }
  return NextResponse.json({ ok: true });
}
