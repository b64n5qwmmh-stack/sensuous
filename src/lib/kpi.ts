import { Client } from "@notionhq/client";
import { env } from "@/lib/env";

const notion = new Client({ auth: env.NOTION_API_KEY });
const INSPECTIONS = "d016fcc6-1184-4054-b196-a78cbb33e9cb";
const KPI_RESULTS = env.NOTION_KPI_RESULTS_DATA_SOURCE_ID ?? "26371f8e-c442-4614-9207-1170933f6200";

const relation = (property: unknown) => ((property as { relation?: { id: string }[] })?.relation ?? []).map((item) => item.id);
const number = (property: unknown) => (property as { number?: number | null })?.number ?? null;

function periodBounds() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const next = new Date(Date.UTC(year, month, 1));
  return {
    label: `${year}-${String(month).padStart(2, "0")}`,
    start: `${year}-${String(month).padStart(2, "0")}-01T00:00:00+04:00`,
    end: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00+04:00`,
  };
}

export async function refreshMonthlyKpi(input: { employeeId: string; employeeName: string; branchId: string | null }) {
  const period = periodBounds();
  const inspections = await notion.databases.query({
    database_id: INSPECTIONS,
    filter: { and: [
      { property: "Employee Checked", relation: { contains: input.employeeId } },
      { property: "Status", select: { equals: "Submitted" } },
      { property: "Date", date: { on_or_after: period.start } },
      { property: "Date", date: { before: period.end } },
    ] },
    page_size: 100,
  });
  const scores = inspections.results.flatMap((page) => "properties" in page ? [number(page.properties["Score (%)"])] : []).filter((value): value is number => value !== null);
  const personalScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;

  const currentResults = await notion.databases.query({
    database_id: KPI_RESULTS,
    filter: { and: [
      { property: "Period", date: { on_or_after: period.start } },
      { property: "Period", date: { before: period.end } },
    ] },
    page_size: 100,
  });
  const existing = currentResults.results.find((page) => "properties" in page && relation(page.properties.Employee).includes(input.employeeId));
  const ownProperties = {
    "KPI Result": { title: [{ text: { content: `${input.employeeName} — KPI ${period.label}` } }] },
    Employee: { relation: [{ id: input.employeeId }] },
    Branch: { relation: input.branchId ? [{ id: input.branchId }] : [] },
    Period: { date: { start: period.start } },
    "Quality Score": { number: personalScore },
    "KPI Score": { number: personalScore },
    Status: { select: { name: "Draft" } },
  };
  if (existing) await notion.pages.update({ page_id: existing.id, properties: ownProperties });
  else await notion.pages.create({ parent: { database_id: KPI_RESULTS }, properties: ownProperties });

  const refreshed = await notion.databases.query({
    database_id: KPI_RESULTS,
    filter: { and: [
      { property: "Period", date: { on_or_after: period.start } },
      { property: "Period", date: { before: period.end } },
    ] },
    page_size: 100,
  });
  const group = refreshed.results.filter((page) => "properties" in page && (() => {
    const branches = relation(page.properties.Branch);
    return input.branchId ? branches.includes(input.branchId) : branches.length === 0;
  })());
  const branchScore = Math.round(group.reduce((sum, page) => sum + ("properties" in page ? number(page.properties["KPI Score"]) ?? 0 : 0), 0) / Math.max(group.length, 1));
  const now = new Date().toISOString();

  await Promise.all(group.map(async (page) => {
    if (!("properties" in page)) return;
    const employeeId = relation(page.properties.Employee)[0];
    const score = number(page.properties["KPI Score"]) ?? 0;
    const eligible = score >= 80 && branchScore >= 80;
    await notion.pages.update({ page_id: page.id, properties: {
      "Branch KPI Score": { number: branchScore },
      "KPI Eligible": { checkbox: eligible },
      Comment: { rich_text: [{ text: { content: `Личный KPI: ${score}%. KPI ${input.branchId ? "филиала" : "Backoffice"}: ${branchScore}%. Допуск к KPI: ${eligible ? "да" : "нет"}.` } }] },
    } });
    if (employeeId) await notion.pages.update({ page_id: employeeId, properties: {
      "Current KPI Score": { number: score },
      "Current Branch KPI": { number: branchScore },
      "KPI Eligible": { checkbox: eligible },
      "KPI Updated At": { date: { start: now } },
    } });
  }));

  return { personalScore, branchScore, eligible: personalScore >= 80 && branchScore >= 80 };
}
