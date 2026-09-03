import { Client } from "@notionhq/client";
import { env } from "@/lib/env";

const notion = env.NOTION_API_KEY ? new Client({ auth: env.NOTION_API_KEY }) : null;

function requiredSetting(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export type Employee = {
  id: string;
  fullName: string;
  telegramId: string | null;
  status: string | null;
  role: string | null;
  primaryBranch: string | null;
};

export type Branch = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function text(property: unknown): string | null {
  const value = property as { title?: { plain_text: string }[]; rich_text?: { plain_text: string }[] };
  return value?.title?.map((item) => item.plain_text).join("") ?? value?.rich_text?.map((item) => item.plain_text).join("") ?? null;
}

export async function findEmployeeByTelegramId(telegramId: number): Promise<Employee | null> {
  if (!notion) return null;

  const employeesDataSourceId = requiredSetting(
    env.NOTION_EMPLOYEES_DATA_SOURCE_ID,
    "NOTION_EMPLOYEES_DATA_SOURCE_ID"
  );

  const response = await notion.databases.query({
    database_id: employeesDataSourceId,
    filter: { property: "Telegram ID", rich_text: { equals: String(telegramId) } },
    page_size: 1,
  });
  const page = response.results[0];
  if (!page || !("properties" in page)) return null;
  const properties = page.properties as Record<string, unknown>;
  const select = properties.Status as { select?: { name: string } | null };
  const role = properties.Role as { relation?: { id: string }[] };
  const branch = properties["Primary Branch"] as { relation?: { id: string }[] };

  return {
    id: page.id,
    fullName: text(properties["Full Name"]) ?? "Unknown employee",
    telegramId: text(properties["Telegram ID"]),
    status: select?.select?.name ?? null,
    role: role?.relation?.[0]?.id ?? null,
    primaryBranch: branch?.relation?.[0]?.id ?? null,
  };
}

function number(property: unknown): number | null {
  const value = property as { number?: number | null };
  return value?.number ?? null;
}

export async function getBranch(branchId: string): Promise<Branch> {
  if (!notion) throw new Error("Notion is not configured.");
  const page = await notion.pages.retrieve({ page_id: branchId });
  if (!("properties" in page)) throw new Error("Branch was not found.");
  const properties = page.properties as Record<string, unknown>;
  const latitude = number(properties.Latitude);
  const longitude = number(properties.Longitude);
  const radiusMeters = number(properties["Check-in Radius (m)"]);
  if (latitude === null || longitude === null || radiusMeters === null) {
    throw new Error("This branch has incomplete GPS settings.");
  }
  return { id: page.id, name: text(properties["Branch Name"]) ?? "Unknown branch", latitude, longitude, radiusMeters };
}

export type CheckInRecord = { id: string; checkInTime: string; distanceMeters: number; status: string };

function dateStart(property: unknown): string | null {
  const value = property as { date?: { start?: string } | null };
  return value?.date?.start ?? null;
}

export async function getTodayCheckIn(employeeId: string): Promise<CheckInRecord | null> {
  if (!notion) throw new Error("Notion is not configured.");
  const attendanceDataSourceId = requiredSetting(
    env.NOTION_ATTENDANCE_DATA_SOURCE_ID,
    "NOTION_ATTENDANCE_DATA_SOURCE_ID"
  );
  const bakuDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const startOfBakuDay = new Date(`${bakuDate}T00:00:00+04:00`);
  const response = await notion.databases.query({
    database_id: attendanceDataSourceId,
    filter: {
      and: [
        { property: "Employee", relation: { contains: employeeId } },
        { property: "Check-in Time", date: { on_or_after: startOfBakuDay.toISOString() } },
      ],
    },
    page_size: 1,
  });
  const page = response.results[0];
  if (!page || !("properties" in page)) return null;
  const properties = page.properties as Record<string, unknown>;
  const checkInTime = dateStart(properties["Check-in Time"]);
  if (!checkInTime) return null;
  const select = properties["Check-in Status"] as { select?: { name: string } | null };
  return { id: page.id, checkInTime, distanceMeters: number(properties["Distance from Branch (m)"]) ?? 0, status: select?.select?.name ?? "Unknown" };
}

export async function createCheckIn(input: {
  employee: Employee;
  branch: Branch;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  insideRadius: boolean;
}): Promise<CheckInRecord> {
  if (!notion) throw new Error("Notion is not configured.");
  const attendanceDataSourceId = requiredSetting(
    env.NOTION_ATTENDANCE_DATA_SOURCE_ID,
    "NOTION_ATTENDANCE_DATA_SOURCE_ID"
  );
  const now = new Date().toISOString();
  const bakuTime = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Baku",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  const title = `${input.employee.fullName} — ${now.slice(0, 10)}`;
  const page = await notion.pages.create({
    parent: { database_id: attendanceDataSourceId },
    properties: {
      "Attendance Record": { title: [{ text: { content: title } }] },
      Employee: { relation: [{ id: input.employee.id }] },
      Branch: { relation: [{ id: input.branch.id }] },
      "Check-in Time": { date: { start: now } },
      "Check-in Time (Baku)": { rich_text: [{ text: { content: bakuTime } }] },
      "Check-in Latitude": { number: input.latitude },
      "Check-in Longitude": { number: input.longitude },
      "Distance from Branch (m)": { number: Math.round(input.distanceMeters) },
      "Check-in Status": { select: { name: input.insideRadius ? "On time" : "Outside radius" } },
    },
  });
  return { id: page.id, checkInTime: now, distanceMeters: Math.round(input.distanceMeters), status: input.insideRadius ? "On time" : "Outside radius" };
}
