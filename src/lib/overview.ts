import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { grantRecognition } from "@/lib/gamification";

const notion = new Client({ auth: env.NOTION_API_KEY });
const DB = {
  employees: env.NOTION_EMPLOYEES_DATA_SOURCE_ID!,
  branches: "69e4891d-e5fe-4f4b-94ee-a48561a167fd",
  inspections: "d016fcc6-1184-4054-b196-a78cbb33e9cb",
  answers: "1140339a-e577-4247-bf28-12dfd31ffa57",
  kpi: env.NOTION_KPI_RESULTS_DATA_SOURCE_ID ?? "26371f8e-c442-4614-9207-1170933f6200",
  recognitions: "64b53a24-aa30-4f3a-888f-99c3e2913dfa",
};

const title = (property: unknown) => ((property as { title?: { plain_text: string }[] })?.title ?? []).map((item) => item.plain_text).join("");
const text = (property: unknown) => ((property as { rich_text?: { plain_text: string }[] })?.rich_text ?? []).map((item) => item.plain_text).join("");
const relation = (property: unknown) => ((property as { relation?: { id: string }[] })?.relation ?? []).map((item) => item.id);
const number = (property: unknown) => (property as { number?: number | null })?.number ?? null;
const date = (property: unknown) => (property as { date?: { start?: string } | null })?.date?.start ?? null;
const select = (property: unknown) => (property as { select?: { name?: string } | null })?.select?.name ?? null;

type Staff = { id: string; name: string; branchId: string | null; kpi: number | null; branchKpi: number | null; eligible: boolean; yearKpi: number | null };

function yearStart() {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric" }).format(new Date());
  return `${year}-01-01T00:00:00+04:00`;
}

export async function canAward(roleId: string | null) {
  if (!roleId) return false;
  const role = await notion.pages.retrieve({ page_id: roleId });
  return "properties" in role && title(role.properties["Role Name"]) === "Coffee Department Head";
}

export async function teamOverview() {
  const [employees, branches, results] = await Promise.all([
    notion.databases.query({ database_id: DB.employees, filter: { property: "Status", select: { equals: "Active" } }, page_size: 100 }),
    notion.databases.query({ database_id: DB.branches, page_size: 100 }),
    notion.databases.query({ database_id: DB.kpi, filter: { property: "Period", date: { on_or_after: yearStart() } }, page_size: 100 }),
  ]);
  const annual = new Map<string, number[]>();
  for (const page of results.results) {
    if (!("properties" in page)) continue;
    const employeeId = relation(page.properties.Employee)[0];
    const score = number(page.properties["KPI Score"]);
    if (employeeId && score !== null) annual.set(employeeId, [...(annual.get(employeeId) ?? []), score]);
  }
  const staff: Staff[] = employees.results.flatMap((page) => {
    if (!("properties" in page)) return [];
    const values = annual.get(page.id) ?? [];
    return [{
      id: page.id, name: title(page.properties["Full Name"]), branchId: relation(page.properties["Primary Branch"])[0] ?? null,
      kpi: number(page.properties["Current KPI Score"]), branchKpi: number(page.properties["Current Branch KPI"]),
      eligible: (page.properties["KPI Eligible"] as { checkbox?: boolean })?.checkbox ?? false,
      yearKpi: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    }];
  });
  const branchRows = branches.results.flatMap((page) => "properties" in page ? [{ id: page.id, name: title(page.properties["Branch Name"]) }] : []);
  const grouped = branchRows.map((branch) => ({ ...branch, employees: staff.filter((person) => person.branchId === branch.id).sort((a, b) => a.name.localeCompare(b.name, "ru")) })).filter((branch) => branch.employees.length);
  const backoffice = staff.filter((person) => !person.branchId);
  if (backoffice.length) grouped.push({ id: "backoffice", name: "Backoffice", employees: backoffice });
  const ranked = (key: "kpi" | "yearKpi") => staff.filter((person) => person[key] !== null).sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).map((person, index) => ({ ...person, rank: index + 1 }));
  return { branches: grouped, leaderboard: { month: ranked("kpi"), year: ranked("yearKpi") } };
}

export async function employeeDetails(employeeId: string) {
  const employee = await notion.pages.retrieve({ page_id: employeeId });
  if (!("properties" in employee)) throw new Error("Сотрудник не найден.");
  const properties = employee.properties;
  const inspections = await notion.databases.query({ database_id: DB.inspections, filter: { property: "Employee Checked", relation: { contains: employeeId } }, sorts: [{ property: "Date", direction: "descending" }], page_size: 20 });
  const data = await Promise.all(inspections.results.filter((page): page is typeof page & { properties: Record<string, unknown> } => "properties" in page).map(async (inspection) => {
    const typeId = relation(inspection.properties["Check Type"])[0];
    const inspectorId = relation(inspection.properties.Inspector)[0];
    const [typePage, inspectorPage, answers] = await Promise.all([
      typeId ? notion.pages.retrieve({ page_id: typeId }) : null,
      inspectorId ? notion.pages.retrieve({ page_id: inspectorId }) : null,
      notion.databases.query({ database_id: DB.answers, filter: { property: "Inspection", relation: { contains: inspection.id } }, page_size: 100 }),
    ]);
    const answerRows = await Promise.all(answers.results.filter((page): page is typeof page & { properties: Record<string, unknown> } => "properties" in page).map(async (answer) => {
      const questionId = relation(answer.properties.Question)[0];
      const question = questionId ? await notion.pages.retrieve({ page_id: questionId }) : null;
      const questionProperties = question && "properties" in question ? question.properties as Record<string, unknown> : null;
      return { question: questionProperties ? title(questionProperties.Question) : "Пункт чек-листа", result: select(answer.properties.Result) ?? title(answer.properties.Answer), score: number(answer.properties["Awarded Score"]) };
    }));
    return {
      id: inspection.id, title: title(inspection.properties.Inspection), score: number(inspection.properties["Score (%)"]), date: date(inspection.properties.Date), status: select(inspection.properties.Status),
      type: typePage && "properties" in typePage ? title(typePage.properties["Check Name"]) : "Проверка",
      inspector: inspectorPage && "properties" in inspectorPage ? title(inspectorPage.properties["Full Name"]) : "—", answers: answerRows,
    };
  }));
  return { employee: { id: employee.id, name: title(properties["Full Name"]), kpi: number(properties["Current KPI Score"]), branchKpi: number(properties["Current Branch KPI"]), eligible: (properties["KPI Eligible"] as { checkbox?: boolean })?.checkbox ?? false }, inspections: data };
}

export async function createRecognition(input: { employeeId: string; employeeName: string; branchId: string | null; givenBy: string; period: "month" | "year" }) {
  const label = input.period === "month" ? "Сотрудник месяца" : "Сотрудник года";
  await notion.pages.create({ parent: { database_id: DB.recognitions }, properties: {
    Recognition: { title: [{ text: { content: `${label} — ${input.employeeName}` } }] }, Employee: { relation: [{ id: input.employeeId }] },
    "Given By": { relation: [{ id: input.givenBy }] }, Branch: { relation: input.branchId ? [{ id: input.branchId }] : [] }, Date: { date: { start: new Date().toISOString() } },
    Type: { select: { name: "Award" } }, Points: { number: input.period === "month" ? 1 : 12 }, Reason: { rich_text: [{ text: { content: label } }] },
  } });
  await grantRecognition({ id: input.employeeId, fullName: input.employeeName, telegramId: null, status: null, role: null, primaryBranch: input.branchId, coinBalance: 0, experiencePoints: 0, level: 1 }, input.period);
}
