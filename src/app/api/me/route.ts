import { NextRequest, NextResponse } from "next/server";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { validateTelegramInitData } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const { initData } = (await request.json()) as { initData?: string };
    if (!initData) return NextResponse.json({ error: "Open this panel from Telegram." }, { status: 401 });
    const telegramUser = validateTelegramInitData(initData);
    const employee = await findEmployeeByTelegramId(telegramUser.id);
    if (!employee) return NextResponse.json({ status: "unlinked", telegramId: telegramUser.id });
    return NextResponse.json({ status: "active", employee });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authorization failed." }, { status: 401 });
  }
}
