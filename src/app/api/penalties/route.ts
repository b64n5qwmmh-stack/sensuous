import { NextRequest, NextResponse } from "next/server";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { canManagePenalties, createPenalty, penaltyTargets } from "@/lib/penalties";
import { refreshMonthlyKpi } from "@/lib/kpi";
import { validateTelegramInitData } from "@/lib/telegram";

async function manager(initData: string) {
  const user = validateTelegramInitData(initData);
  const employee = await findEmployeeByTelegramId(user.id);
  if (!employee) throw new Error("Профиль не привязан к сотруднику.");
  if (!(await canManagePenalties(employee))) throw new Error("У вас нет права назначать KPI-штрафы.");
  return employee;
}

export async function GET(request: NextRequest) {
  try {
    const me = await manager(request.nextUrl.searchParams.get("initData") ?? "");
    return NextResponse.json({ employees: await penaltyTargets(me) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить сотрудников." }, { status: 403 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { initData?: string; employeeId?: string; deduction?: number; reason?: string; severity?: "Minor" | "Major" | "Critical" };
    const me = await manager(body.initData ?? "");
    const deduction = Number(body.deduction);
    const reason = body.reason?.trim() ?? "";
    if (!body.employeeId || !Number.isFinite(deduction) || deduction <= 0 || deduction > 100 || !reason) return NextResponse.json({ error: "Выберите сотрудника, укажите причину и штраф от 1 до 100%." }, { status: 400 });
    const targets = await penaltyTargets(me);
    const target = targets.find((person) => person.id === body.employeeId);
    if (!target) return NextResponse.json({ error: "У вас нет права назначить штраф этому сотруднику." }, { status: 403 });
    const severity = body.severity === "Critical" || body.severity === "Major" ? body.severity : "Minor";
    await createPenalty({ manager: me, employeeId: target.id, employeeName: target.name, branchId: target.branchId, deduction: Math.round(deduction), reason, severity });
    const kpi = await refreshMonthlyKpi({ employeeId: target.id, employeeName: target.name, branchId: target.branchId });
    return NextResponse.json({ ok: true, kpi });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось назначить штраф." }, { status: 400 }); }
}
