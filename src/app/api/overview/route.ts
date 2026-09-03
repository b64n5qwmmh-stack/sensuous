import { NextRequest, NextResponse } from "next/server";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { canAward, createRecognition, employeeDetails, teamOverview } from "@/lib/overview";
import { validateTelegramInitData } from "@/lib/telegram";

async function viewer(initData: string) {
  const user = validateTelegramInitData(initData);
  const employee = await findEmployeeByTelegramId(user.id);
  if (!employee) throw new Error("Профиль не привязан к сотруднику.");
  return employee;
}

export async function GET(request: NextRequest) {
  try {
    const me = await viewer(request.nextUrl.searchParams.get("initData") ?? "");
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    if (employeeId) return NextResponse.json({ ...(await employeeDetails(employeeId)), canAward: await canAward(me.role) });
    return NextResponse.json({ ...(await teamOverview()), canAward: await canAward(me.role) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить команду." }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { initData: string; employeeId: string; employeeName: string; branchId: string | null; period: "month" | "year" };
    const me = await viewer(body.initData);
    if (!(await canAward(me.role))) return NextResponse.json({ error: "Только Coffee Department Head может выбрать сотрудника месяца или года." }, { status: 403 });
    if (body.period !== "month" && body.period !== "year") return NextResponse.json({ error: "Неверный период." }, { status: 400 });
    await createRecognition({ employeeId: body.employeeId, employeeName: body.employeeName, branchId: body.branchId, givenBy: me.id, period: body.period });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить награду." }, { status: 400 }); }
}
