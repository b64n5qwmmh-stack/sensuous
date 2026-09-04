"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "@/components/language";

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; name: string; status: string; coins: number; level: number; role: string | null }
  | { kind: "unlinked"; telegramId: number }
  | { kind: "error"; message: string };
type CheckIn = { id?: string; checkInTime: string; distanceMeters: number; status: string; branch?: string; alreadyCheckedIn?: boolean };
type Dashboard = { attendance: CheckIn[]; inspections: { id: string; title: string; status: string; score: number | null; date: string | null }[]; penalties: { id: string; title: string; deduction: number; reason: string; date: string | null; severity: string }[]; kpi: { score: number | null; branchScore: number | null; eligible: boolean; status: string; period: string | null } | null; yearKpi: number | null };
type Panel = "attendance" | "inspections" | "kpi" | "penalties" | null;

declare global { interface Window { Telegram?: { WebApp?: { ready(): void; expand(): void; initData: string } } } }

const menu = [
  ["📍", "onWork", "checkin"], ["🕒", "journal", "attendance"], ["📝", "myChecks", "inspections"],
  ["📈", "myKpi", "kpi"], ["✅", "inspect", "/check"], ["🏆", "team", "/team"],
  ["🎖️", "achievements", "/achievements"], ["🛍️", "store", "/store"],
] as const;

export default function HomePage() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const app = window.Telegram?.WebApp; app?.ready(); app?.expand();
    if (!app?.initData) { setState({ kind: "error", message: "Открой панель через Telegram-бота." }); return; }
    fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error ?? "Не удалось открыть профиль.");
        if (body.status === "unlinked") { setState({ kind: "unlinked", telegramId: body.telegramId }); return; }
        setState({ kind: "ready", name: body.employee.fullName, status: body.employee.status, coins: body.employee.coinBalance, level: body.employee.level, role: body.employee.role });
        return fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
      })
      .then(async (response) => { if (!response) return; const body = await response.json(); if (response.ok) setDashboard(body); })
      .catch((error) => setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось открыть профиль." }));
  }, []);

  async function handleCheckIn() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !navigator.geolocation) { setState({ kind: "error", message: "GPS недоступен. Открой панель через Telegram на телефоне." }); return; }
    setCheckingIn(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/attendance/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Не удалось сохранить отметку.");
        setCheckIn({ ...body.record, branch: body.branch, alreadyCheckedIn: body.alreadyCheckedIn });
      } catch (error) { setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось сохранить отметку." }); } finally { setCheckingIn(false); }
    }, (error) => { setCheckingIn(false); setState({ kind: "error", message: `Не удалось получить GPS: ${error.message}` }); }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  }

  function choose(action: string) {
    if (action === "checkin") handleCheckIn();
    else if (action === "attendance" || action === "inspections" || action === "kpi" || action === "penalties") setPanel(panel === action ? null : action);
    else window.location.href = action;
  }

  return <main className="home">
    {state.kind === "loading" && <section className="card">{t("loading")}</section>}
    {state.kind === "error" && <section className="card warning">{state.message}</section>}
    {state.kind === "unlinked" && <section className="card warning"><h2>{t("unlinked")}</h2><p>Telegram ID: <code>{state.telegramId}</code></p></section>}
    {state.kind === "ready" && <>
      <header className="game-header"><div className="owl-coins">🦉 <strong>{state.coins}</strong></div><div className="user-status"><strong>{state.name}</strong><span>● {state.status}</span></div></header>
      <section className="stats-card"><div><span>{t("currentKpi")}</span><strong>{dashboard?.kpi?.score ?? "—"}%</strong></div><div><span>{t("yearKpi")}</span><strong>{dashboard?.yearKpi ?? "—"}%</strong></div><div><span>{t("level")}</span><strong>{state.level}</strong></div></section>
      {checkIn && <section className="card success"><p className="eyebrow">{checkIn.alreadyCheckedIn ? "УЖЕ ОТМЕЧЕН" : "ОТМЕТКА СОХРАНЕНА"}</p><h2>{new Date(checkIn.checkInTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</h2><p>{checkIn.branch ? `${checkIn.branch} · ` : ""}{Math.round(checkIn.distanceMeters)} м от точки филиала</p></section>}
      <section className="menu-grid">{menu.map(([icon, label, action]) => <button className="menu-tile" key={label} onClick={() => choose(action)} disabled={action === "checkin" && (checkingIn || Boolean(checkIn))}><span>{action === "checkin" && checkingIn ? "⌛" : icon}</span><small>{action === "checkin" && checkIn ? t("alreadyWork") : t(label)}</small></button>)}{state.role === "3d045c82-95cf-81df-a96f-f6ee6648a28a" && <button className="menu-tile penalty-tile" onClick={() => choose("/penalties")}><span>⚠️</span><small>{t("penalties")}</small></button>}</section>
      <LanguageSwitch lang={lang} setLang={setLang} label={t("language")} />
      {panel === "attendance" && <section className="card details"><h2>{t("recentAttendance")}</h2>{dashboard?.attendance.length ? dashboard.attendance.map((item, index) => <p key={item.id ?? index}>{new Date(item.checkInTime).toLocaleString(lang === "az" ? "az-AZ" : "ru-RU", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {item.status} · {Math.round(item.distanceMeters)} m</p>) : <p>{t("noAttendance")}</p>}</section>}
      {panel === "inspections" && <section className="card details"><h2>{t("myChecks")}</h2>{dashboard?.inspections.length ? dashboard.inspections.map((item) => <p key={item.id}><strong>{item.title}</strong><br />{item.status}{item.score !== null ? ` · ${item.score}%` : ""}{item.date ? ` · ${new Date(item.date).toLocaleDateString(lang === "az" ? "az-AZ" : "ru-RU")}` : ""}</p>) : <p>{t("noChecks")}</p>}</section>}
      {panel === "kpi" && <section className="card details"><h2>{t("myKpi")}</h2>{dashboard?.kpi ? <p><strong>{dashboard.kpi.score ?? "—"}%</strong><br />{t("branchKpi")}: {dashboard.kpi.branchScore ?? "—"}%<br />{t("eligible")}: {dashboard.kpi.eligible ? t("yes") : t("no")}</p> : <p>KPI —</p>}</section>}
      {panel === "penalties" && <section className="card details"><h2>{t("penalties")}</h2>{dashboard?.penalties.length ? dashboard.penalties.map((item) => <p key={item.id}><strong>−{item.deduction}% · {item.title}</strong><br />{item.reason}{item.date ? ` · ${new Date(item.date).toLocaleDateString(lang === "az" ? "az-AZ" : "ru-RU")}` : ""}</p>) : <p>{t("noPenalties")}</p>}</section>}
    </>}
  </main>;
}
