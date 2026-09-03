import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import type { Employee } from "@/lib/notion";

const notion = new Client({ auth: env.NOTION_API_KEY });
const DB = {
  employees: env.NOTION_EMPLOYEES_DATA_SOURCE_ID!,
  rules: "8b03887e-3a01-4187-a09a-d0c12d962e15",
  types: "7c7ada44-6e22-4ef8-8150-f65fe9d31f83",
  questions: "2ef63d22-d32d-4d6f-a564-71b351c015c5",
  inspections: "d016fcc6-1184-4054-b196-a78cbb33e9cb",
  answers: "1140339a-e577-4247-bf28-12dfd31ffa57",
};
const title = (p: unknown) => ((p as { title?: { plain_text: string }[] })?.title ?? []).map((x) => x.plain_text).join("");
const relation = (p: unknown) => ((p as { relation?: { id: string }[] })?.relation ?? []).map((x) => x.id);

export async function inspectionOptions(inspector: Employee) {
  if (!inspector.role) return [];
  const rolePage = await notion.pages.retrieve({ page_id: inspector.role });
  if (!("properties" in rolePage) || !(rolePage.properties["Can Inspect Employees"] as { checkbox?: boolean })?.checkbox) return [];
  const roleName = title(rolePage.properties["Role Name"]);
  const rules = await notion.databases.query({ database_id: DB.rules, filter: { and: [
    { property: "Inspector Role", relation: { contains: inspector.role } },
    { property: "Active", checkbox: { equals: true } },
  ] }, page_size: 50 });
  const all: { typeId: string; targetRoleId: string; typeName: string }[] = [];
  for (const rule of rules.results) {
    if (!("properties" in rule)) continue;
    const typeId = relation(rule.properties["Check Type"])[0];
    const targetRoleId = relation(rule.properties["Target Role"])[0];
    if (!typeId || !targetRoleId) continue;
    const typePage = await notion.pages.retrieve({ page_id: typeId });
    all.push({ typeId, targetRoleId, typeName: "properties" in typePage ? title(typePage.properties["Check Name"]) : "Проверка" });
  }
  const employees = await notion.databases.query({ database_id: DB.employees, page_size: 100 });
  return all.map((rule) => ({ ...rule, employees: employees.results.flatMap((page) => {
    if (!("properties" in page) || page.id === inspector.id || !relation(page.properties.Role).includes(rule.targetRoleId)) return [];
    if (roleName === "Manager" && (!inspector.primaryBranch || !relation(page.properties["Primary Branch"]).includes(inspector.primaryBranch))) return [];
    return [{ id: page.id, name: title(page.properties["Full Name"]) }];
  }) })).filter((rule) => rule.employees.length);
}

export async function questions(typeId: string) {
  const result = await notion.databases.query({ database_id: DB.questions, filter: { and: [
    { property: "Check Type", relation: { contains: typeId } }, { property: "Active", checkbox: { equals: true } },
  ] }, sorts: [{ property: "Order", direction: "ascending" }], page_size: 100 });
  return result.results.flatMap((page) => "properties" in page ? [{ id: page.id, text: title(page.properties.Question) }] : []);
}
