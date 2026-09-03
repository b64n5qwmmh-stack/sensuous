import { NextRequest, NextResponse } from "next/server";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { buyItem, gamificationData } from "@/lib/gamification";
import { validateTelegramInitData } from "@/lib/telegram";

async function employee(initData: string) { const user = validateTelegramInitData(initData); const me = await findEmployeeByTelegramId(user.id); if (!me) throw new Error("Профиль не привязан к сотруднику."); return me; }
export async function GET(request: NextRequest) { try { return NextResponse.json(await gamificationData(await employee(request.nextUrl.searchParams.get("initData") ?? ""))); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить данные." }, { status: 400 }); } }
export async function POST(request: NextRequest) { try { const body = await request.json() as { initData: string; itemId: string }; const result = await buyItem(await employee(body.initData), body.itemId); return NextResponse.json({ ok: true, ...result }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось оформить заказ." }, { status: 400 }); } }
