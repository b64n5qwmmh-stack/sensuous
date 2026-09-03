import { Client } from "@notionhq/client";
import type { Employee } from "@/lib/notion";

const notion = process.env.NOTION_API_KEY ? new Client({ auth: process.env.NOTION_API_KEY }) : null;

const text = (property: unknown) => {
  const value = property as { title?: { plain_text: string }[]; rich_text?: { plain_text: string }[] };
  return value?.title?.map((item) => item.plain_text).join("") ?? value?.rich_text?.map((item) => item.plain_text).join("") ?? "";
};
const number = (property: unknown) => (property as { number?: number | null })?.number ?? null;
const date = (property: unknown) => (property as { date?: { start?: string } | null })?.date?.start ?? null;
const status = (property: unknown) => (property as { select?: { name: string } | null })?.select?.name ?? "Без статуса";

export async function getDashboard(employee: Employee) {
  if (!notion) return { attendance: [], inspections: [], kpi: null };

  const [attendance, inspections, kpi] = await Promise.all([
    process.env.NOTION_ATTENDANCE_DATA_SOURCE_ID
      ? notion.databases.query({
          database_id: process.env.NOTION_ATTENDANCE_DATA_SOURCE_ID,
          filter: { property: "Employee", relation: { contains: employee.id } },
          sorts: [{ property: "Check-in Time", direction: "descending" }],
          page_size: 7,
        })
      : Promise.resolve({ results: [] }),
    process.env.NOTION_INSPECTIONS_DATA_SOURCE_ID
      ? notion.databases.query({
          database_id: process.env.NOTION_INSPECTIONS_DATA_SOURCE_ID,
          filter: { property: "Employee Checked", relation: { contains: employee.id } },
          sorts: [{ property: "Date", direction: "descending" }],
          page_size: 10,
        })
      : Promise.resolve({ results: [] }),
    process.env.NOTION_KPI_RESULTS_DATA_SOURCE_ID
      ? notion.databases.query({
          database_id: process.env.NOTION_KPI_RESULTS_DATA_SOURCE_ID,
          filter: { property: "Employee", relation: { contains: employee.id } },
          sorts: [{ property: "Period", direction: "descending" }],
          page_size: 1,
        })
      : Promise.resolve({ results: [] }),
  ]);

  return {
    attendance: attendance.results.flatMap((page) => {
      if (!("properties" in page)) return [];
      const p = page.properties as Record<string, unknown>;
      const checkInTime = date(p["Check-in Time"]);
      return checkInTime ? [{ id: page.id, checkInTime, distanceMeters: number(p["Distance from Branch (m)"]) ?? 0, status: status(p["Check-in Status"])}] : [];
    }),
    inspections: inspections.results.flatMap((page) => {
      if (!("properties" in page)) return [];
      const p = page.properties as Record<string, unknown>;
      return [{ id: page.id, title: text(p.Inspection) || "Проверка", status: status(p.Status), score: number(p["Score (%)"]), date: date(p.Date) }];
    }),
    kpi: kpi.results[0] && "properties" in kpi.results[0]
      ? (() => { const p = kpi.results[0].properties as Record<string, unknown>; return { score: number(p["KPI Score"]), status: status(p.Status), period: date(p.Period) }; })()
      : null,
  };
}
