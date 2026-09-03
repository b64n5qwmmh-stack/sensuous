import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import type { Employee } from "@/lib/notion";

const notion = new Client({ auth: env.NOTION_API_KEY });
const DB = {
  employees: env.NOTION_EMPLOYEES_DATA_SOURCE_ID!, achievements: "f135d8eb-659b-4603-ba0f-40a128c24c90", earned: "617baf1f-b695-4869-8231-aeb25eca730b",
  transactions: "8e789895-d5a7-4c23-9e24-4b1fc87ac56d", items: "cfe33501-9422-4ede-bf18-dff97f21a486", orders: "dfcab201-9ed1-4932-a746-9539cc82401b",
};
const title = (p: unknown) => ((p as { title?: { plain_text: string }[] })?.title ?? []).map((x) => x.plain_text).join("");
const text = (p: unknown) => ((p as { rich_text?: { plain_text: string }[] })?.rich_text ?? []).map((x) => x.plain_text).join("");
const relation = (p: unknown) => ((p as { relation?: { id: string }[] })?.relation ?? []).map((x) => x.id);
const number = (p: unknown) => (p as { number?: number | null })?.number ?? null;
const date = (p: unknown) => (p as { date?: { start?: string } | null })?.date?.start ?? null;

const ids: Record<string, string> = {
  arrival: "3d045c82-95cf-816c-9b69-f19e0380b9b7", standard90: "3d045c82-95cf-81ec-9063-facbb7257e9a", perfect: "3d045c82-95cf-8196-aa6d-e68cd0ecfbae",
  kpi80: "3d045c82-95cf-8186-9bbb-e84589ad068e", kpi90: "3d045c82-95cf-818a-9e19-c92dbe8c1da7", month: "3d045c82-95cf-81f8-b3e9-ff73a0e5dafd", year: "3d045c82-95cf-814f-b5c5-d0935fc57210",
};

function monthKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7); }

async function addBalance(input: { employeeId: string; employeeName: string; amount: number; xp: number; reason: string; achievementId?: string }) {
  const page = await notion.pages.retrieve({ page_id: input.employeeId });
  if (!("properties" in page)) throw new Error("Сотрудник не найден.");
  const balance = number(page.properties["Coin Balance"]) ?? 0;
  const xp = number(page.properties["Experience Points"]) ?? 0;
  if (balance + input.amount < 0) throw new Error("Недостаточно монет.");
  const nextXp = Math.max(0, xp + input.xp);
  const nextBalance = balance + input.amount;
  const level = Math.max(1, Math.floor(nextXp / 150) + 1);
  const now = new Date().toISOString();
  await notion.pages.create({ parent: { database_id: DB.transactions }, properties: {
    Transaction: { title: [{ text: { content: `${input.amount > 0 ? "+" : ""}${input.amount} — ${input.reason}` } }] }, Employee: { relation: [{ id: input.employeeId }] }, Amount: { number: input.amount },
    Type: { select: { name: input.amount >= 0 ? "Earned" : "Spent" } }, Reason: { rich_text: [{ text: { content: input.reason } }] }, Date: { date: { start: now } }, Achievement: { relation: input.achievementId ? [{ id: input.achievementId }] : [] },
  } });
  await notion.pages.update({ page_id: input.employeeId, properties: { "Coin Balance": { number: nextBalance }, "Experience Points": { number: nextXp }, Level: { number: level } } });
  return { balance: nextBalance, xp: nextXp, level };
}

async function awardAchievement(input: { employee: Employee; achievementId: string; name: string; coins: number; xp: number; monthly?: boolean }) {
  const earned = await notion.databases.query({ database_id: DB.earned, filter: { and: [
    { property: "Employee", relation: { contains: input.employee.id } }, { property: "Achievement", relation: { contains: input.achievementId } },
  ] }, page_size: 100 });
  const key = monthKey();
  const exists = earned.results.some((page) => "properties" in page && (!input.monthly || text(page.properties["Month Key"]) === key));
  if (exists) return null;
  await notion.pages.create({ parent: { database_id: DB.earned }, properties: {
    "Employee Achievement": { title: [{ text: { content: input.name } }] }, Employee: { relation: [{ id: input.employee.id }] }, Achievement: { relation: [{ id: input.achievementId }] },
    "Earned At": { date: { start: new Date().toISOString() } }, "Month Key": { rich_text: input.monthly ? [{ text: { content: key } }] : [] }, "Coins Awarded": { number: input.coins }, "XP Awarded": { number: input.xp },
  } });
  if (!input.coins && !input.xp) return null;
  return addBalance({ employeeId: input.employee.id, employeeName: input.employee.fullName, amount: input.coins, xp: input.xp, reason: input.name, achievementId: input.achievementId });
}

export async function grantTimelyArrival(employee: Employee) {
  await addBalance({ employeeId: employee.id, employeeName: employee.fullName, amount: 5, xp: 5, reason: "Точный старт", achievementId: ids.arrival });
  await awardAchievement({ employee, achievementId: ids.arrival, name: "Точный старт", coins: 0, xp: 0 });
}

export async function grantInspectionRewards(employee: Employee, score: number, kpi: { personalScore: number }) {
  if (score >= 90) await awardAchievement({ employee, achievementId: ids.standard90, name: "Стандарт Sensum", coins: 25, xp: 25 });
  if (score === 100) await awardAchievement({ employee, achievementId: ids.perfect, name: "Идеальный стандарт", coins: 60, xp: 60 });
  if (kpi.personalScore >= 80) await awardAchievement({ employee, achievementId: ids.kpi80, name: "KPI 80+", coins: 50, xp: 50, monthly: true });
  if (kpi.personalScore >= 90) await awardAchievement({ employee, achievementId: ids.kpi90, name: "KPI 90+", coins: 100, xp: 100, monthly: true });
}

export async function grantRecognition(employee: Employee, period: "month" | "year") {
  const achievementId = period === "month" ? ids.month : ids.year;
  return awardAchievement({ employee, achievementId, name: period === "month" ? "Сотрудник месяца" : "Сотрудник года", coins: period === "month" ? 150 : 500, xp: period === "month" ? 150 : 500 });
}

export async function gamificationData(employee: Employee) {
  const [earned, transactions, catalog, items] = await Promise.all([
    notion.databases.query({ database_id: DB.earned, filter: { property: "Employee", relation: { contains: employee.id } }, sorts: [{ property: "Earned At", direction: "descending" }], page_size: 50 }),
    notion.databases.query({ database_id: DB.transactions, filter: { property: "Employee", relation: { contains: employee.id } }, sorts: [{ property: "Date", direction: "descending" }], page_size: 20 }),
    notion.databases.query({ database_id: DB.achievements, filter: { property: "Active", checkbox: { equals: true } }, page_size: 100 }),
    notion.databases.query({ database_id: DB.items, filter: { property: "Active", checkbox: { equals: true } }, page_size: 100 }),
  ]);
  const earnedIds = new Set(earned.results.flatMap((page) => "properties" in page ? relation(page.properties.Achievement) : []));
  return {
    balance: employee.coinBalance, level: employee.level, xp: employee.experiencePoints,
    achievements: catalog.results.flatMap((page) => "properties" in page ? [{ id: page.id, name: title(page.properties.Achievement), description: text(page.properties.Description), coins: number(page.properties["Coin Reward"]) ?? 0, earned: earnedIds.has(page.id) }] : []),
    transactions: transactions.results.flatMap((page) => "properties" in page ? [{ id: page.id, title: title(page.properties.Transaction), amount: number(page.properties.Amount) ?? 0, reason: text(page.properties.Reason), date: date(page.properties.Date) }] : []),
    items: items.results.flatMap((page) => "properties" in page ? [{ id: page.id, name: title(page.properties.Item), description: text(page.properties.Description), price: number(page.properties["Price Coins"]) ?? 0, stock: number(page.properties.Stock) ?? 0 }] : []),
  };
}

export async function buyItem(employee: Employee, itemId: string) {
  const item = await notion.pages.retrieve({ page_id: itemId });
  if (!("properties" in item)) throw new Error("Товар не найден.");
  const price = number(item.properties["Price Coins"]) ?? 0;
  const stock = number(item.properties.Stock) ?? 0;
  const active = (item.properties.Active as { checkbox?: boolean })?.checkbox ?? false;
  if (!active || stock < 1) throw new Error("Товар временно недоступен.");
  const name = title(item.properties.Item);
  const balance = await addBalance({ employeeId: employee.id, employeeName: employee.fullName, amount: -price, xp: 0, reason: `Покупка: ${name}` });
  await notion.pages.create({ parent: { database_id: DB.orders }, properties: { Order: { title: [{ text: { content: `${employee.fullName} — ${name}` } }] }, Employee: { relation: [{ id: employee.id }] }, Item: { relation: [{ id: itemId }] }, "Price Paid": { number: price }, Status: { select: { name: "Pending" } }, "Order Date": { date: { start: new Date().toISOString() } } } });
  await notion.pages.update({ page_id: itemId, properties: { Stock: { number: stock - 1 } } });
  return balance;
}
