import { NextRequest, NextResponse } from "next/server";
import {
  findEmployeeByTelegramId,
  getEmployeeInspections,
  getEmployeePenalties,
  getLatestKpi,
  getRecentCheckIns,
  getYearKpi,
} from "@/lib/notion";
import { validateTelegramInitData } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const { initData } = (await request.json()) as { initData?: string };
    if (!initData) return NextResponse.json({ error: "Open this panel from Telegram." }, { status: 401 });

    const telegramUser = validateTelegramInitData(initData);
    const employee = await findEmployeeByTelegramId(telegramUser.id);
    if (!employee) return NextResponse.json({ error: "Your Telegram ID is not linked to an employee." }, { status: 403 });

    const [attendance, inspections, penalties, kpi, yearKpi] = await Promise.all([
      getRecentCheckIns(employee.id),
      getEmployeeInspections(employee.id),
      getEmployeePenalties(employee.id),
      getLatestKpi(employee.id),
      getYearKpi(employee.id),
    ]);
    return NextResponse.json({ attendance, inspections, penalties, kpi, yearKpi });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load dashboard." }, { status: 400 });
  }
}
