import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { findEmployeeByTelegramId } from "@/lib/notion";
import { inspectionOptions, questions } from "@/lib/inspection";
import { validateTelegramInitData } from "@/lib/telegram";
import { env } from "@/lib/env";

const notion = new Client({ auth: env.NOTION_API_KEY });
const INSPECTIONS = "d016fcc6-1184-4054-b196-a78cbb33e9cb";
const ANSWERS = "1140339a-e577-4247-bf28-12dfd31ffa57";

async function inspector(initData: string) {
  const user = validateTelegramInitData(initData);
  const employee = await findEmployeeByTelegramId(user.id);
  if (!employee) throw new Error("Профиль не привязан к сотруднику.");
  return employee;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { initData: string; targetId: string; typeId: string; answers: Record<string, "1" | "2" | "3" | "4" | "5" | "Skip">; comment?: string };
    const me = await inspector(body.initData);
    const allowed = await inspectionOptions(me);
    const rule = allowed.find((item) => item.typeId === body.typeId && item.employees.some((person) => person.id === body.targetId));
    if (!rule) return NextResponse.json({ error: "У вас нет права проверять этого сотрудника по этому чек-листу." }, { status: 403 });
    const qs = await questions(body.typeId);
    if (!qs.length) return NextResponse.json({ error: "В чек-листе нет активных вопросов." }, { status: 409 });
    if (qs.some((question) => !body.answers[question.id])) return NextResponse.json({ error: "Оцените каждый пункт или выберите Skip." }, { status: 400 });
    const marks = qs.map((question) => body.answers[question.id]);
    const counted = marks.filter((mark) => mark !== "Skip");
    const percent = counted.length ? Math.round(counted.reduce((sum, mark) => sum + Number(mark), 0) / counted.length / 5 * 100) : 0;
    const page = await notion.pages.create({ parent: { database_id: INSPECTIONS }, properties: {
      Inspection: { title: [{ text: { content: `${rule.typeName} — ${new Date().toLocaleDateString("ru-RU")}` } }] },
      "Employee Checked": { relation: [{ id: body.targetId }] }, Inspector: { relation: [{ id: me.id }] },
      "Check Type": { relation: [{ id: body.typeId }] }, Date: { date: { start: new Date().toISOString() } },
      Score: { number: percent }, "Score (%)": { number: percent }, Status: { select: { name: "Submitted" } },
      Summary: { rich_text: body.comment ? [{ text: { content: body.comment } }] : [] },
    } });
    await Promise.all(qs.map((question) => notion.pages.create({ parent: { database_id: ANSWERS }, properties: {
      Answer: { title: [{ text: { content: body.answers[question.id] } }] }, Inspection: { relation: [{ id: page.id }] },
      Question: { relation: [{ id: question.id }] }, Result: { select: { name: body.answers[question.id] } },
      "Awarded Score": { number: body.answers[question.id] === "Skip" ? 0 : Number(body.answers[question.id]) },
    } })));
    return NextResponse.json({ ok: true, percent });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить проверку." }, { status: 400 }); }
}

export async function GET(request: NextRequest) {
  try {
    const me = await inspector(request.nextUrl.searchParams.get("initData") ?? "");
    const options = await inspectionOptions(me);
    const typeId = request.nextUrl.searchParams.get("typeId");
    if (!typeId) return NextResponse.json({ options });
    if (!options.some((item) => item.typeId === typeId)) {
      return NextResponse.json({ error: "Этот чек-лист вам недоступен." }, { status: 403 });
    }
    return NextResponse.json({ options, questions: await questions(typeId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить проверки." }, { status: 400 }); }
}
