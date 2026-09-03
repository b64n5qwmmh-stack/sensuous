import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { validateTelegramInitData } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const { initData } = (await request.json()) as { initData?: string };
    if (!initData) return NextResponse.json({ error: "Open this panel from Telegram." }, { status: 401 });
    const user = validateTelegramInitData(initData);
    const employee = await findEmployeeByTelegramId(user.id);
    if (!employee) return NextResponse.json({ error: "Your Telegram ID is not linked to an employee." }, { status: 403 });
    return NextResponse.json(await getDashboard(employee));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load dashboard." }, { status: 400 });
  }
}
