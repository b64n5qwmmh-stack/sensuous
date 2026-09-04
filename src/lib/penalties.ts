import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import type { Employee } from "@/lib/notion";

const notion = new Client({ auth: env.NOTION_API_KEY });
const EMPLOYEES = env.NOTION_EMPLOYEES_DATA_SOURCE_ID!;
const VIOLATIONS = "ee35a70e-67dc-4e20-93b4-a10a772c7e3e";

const title = (p: unknown) => ((p as { title?: { plain_text: string }[] })?.title ?? []).map((x) => x.plain_text).join("");
const relation = (p: unknown) => ((p as { relation?: { id: string }[] })?.relation ?? []).map((x) => x.id);

async function roleInfo(roleId: string | null) {
  if (!roleId) return { name: "", canAdd: false };
  const page = await notion.pages.retrieve({ page_id: roleId });
  if (!("properties" in page)) return { name: "", canAdd: false };
  return {
    name: title(page.properties["Role Name"]),
    canAdd: (page.properties["Can Add Violation"] as { checkbox?: boolean })?.checkbox ?? false,
  };
}

export async function canManagePenalties(employee: Employee) {
  const role = await roleInfo(employee.role);
  return role.canAdd;
}

export async function penaltyTargets(manager: Employee) {
  const role = await roleInfo(manager.role);
  if (!role.canAdd) return [];
  const response = await notion.databases.query({
    database_id: EMPLOYEES,
    filter: { property: "Status", select: { equals: "Active" } },
    page_size: 100,
  });
  return response.results.flatMap((page) => {
    if (!("properties" in page) || page.id === manager.id) return [];
    const branch = relation(page.properties["Primary Branch"])[0] ?? null;
    if (role.name !== "Coffee Department Head" && manager.primaryBranch && branch !== manager.primaryBranch) return [];
    return [{ id: page.id, name: title(page.properties["Full Name"]), branchId: branch }];
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function createPenalty(input: { manager: Employee; employeeId: string; employeeName: string; branchId: string | null; deduction: number; reason: string; severity: "Minor" | "Major" | "Critical" }) {
  const now = new Date().toISOString();
  await notion.pages.create({ parent: { database_id: VIOLATIONS }, properties: {
    Violation: { title: [{ text: { content: `KPI −${input.deduction}% — ${input.employeeName}` } }] },
    Employee: { relation: [{ id: input.employeeId }] },
    "Reported By": { relation: [{ id: input.manager.id }] },
    Branch: { relation: input.branchId ? [{ id: input.branchId }] : [] },
    Date: { date: { start: now } },
    Severity: { select: { name: input.severity } },
    Status: { select: { name: "Open" } },
    "KPI Deduction": { number: input.deduction },
    Description: { rich_text: [{ text: { content: input.reason } }] },
  } });
}
