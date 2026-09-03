"use client";

import { useEffect, useState } from "react";

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; name: string; status: string; coins: number; level: number }
  | { kind: "unlinked"; telegramId: number }
  | { kind: "error"; message: string };
type CheckIn = { id?: string; checkInTime: string; distanceMeters: number; status: string; branch?: string; alreadyCheckedIn?: boolean };
type Dashboard = { attendance: CheckIn[]; inspections: { id: string; title: string; status: string; score: number | null; date: string | null }[]; kpi: { score: number | null; branchScore: number | null; eligible: boolean; status: string; period: string | null } | null; yearKpi: number | null };
type Panel = "attendance" | "inspections" | "kpi" | null;

declare global { interface Window { Telegram?: { WebApp?: { ready(): void; expand(): void; initData: string } } } }

const menu = [
  ["📍", "Я на работе", "checkin"], ["🕒", "Мой журнал", "attendance"], ["📝", "Мои проверки", "inspections"],
  ["📈", "Мой KPI", "kpi"], ["✅", "Провести проверку", "/check"], ["🏆", "Команда и рейтинг", "/team"],
  ["🎖️", "Достижения", "/achievements"], ["🛍️", "SENSUM Магазин", "/store"],
] as const;

export default function HomePage() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  useEffect(() => {
    const app = window.Telegram?.WebApp; app?.ready(); app?.expand();
    if (!app?.initData) { setState({ kind: "error", message: "Открой панель через Telegram-бота." }); return; }
    fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error ?? "Не удалось открыть профиль.");
        if (body.status === "unlinked") { setState({ kind: "unlinked", telegramId: body.telegramId }); return; }
        setState({ kind: "ready", name: body.employee.fullName, status: body.employee.status, coins: body.employee.coinBalance, level: body.employee.level });
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
    else if (action === "attendance" || action === "inspections" || action === "kpi") setPanel(panel === action ? null : action);
    else window.location.href = action;
  }

  return <main className="home">
    {state.kind === "loading" && <section className="card">Проверяем доступ…</section>}
    {state.kind === "error" && <section className="card warning">{state.message}</section>}
    {state.kind === "unlinked" && <section className="card warning"><h2>Профиль ещё не привязан</h2><p>Твой Telegram ID: <code>{state.telegramId}</code></p></section>}
    {state.kind === "ready" && <>
      <header className="game-header"><div className="owl-coins">🦉 <strong>{state.coins}</strong></div><div className="user-status"><strong>{state.name}</strong><span>● {state.status}</span></div></header>
      <section className="stats-card"><div><span>Текущий KPI</span><strong>{dashboard?.kpi?.score ?? "—"}%</strong></div><div><span>Годовой KPI</span><strong>{dashboard?.yearKpi ?? "—"}%</strong></div><div><span>Уровень</span><strong>{state.level}</strong></div></section>
      {checkIn && <section className="card success"><p className="eyebrow">{checkIn.alreadyCheckedIn ? "УЖЕ ОТМЕЧЕН" : "ОТМЕТКА СОХРАНЕНА"}</p><h2>{new Date(checkIn.checkInTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</h2><p>{checkIn.branch ? `${checkIn.branch} · ` : ""}{Math.round(checkIn.distanceMeters)} м от точки филиала</p></section>}
      <section className="menu-grid">{menu.map(([icon, label, action]) => <button className="menu-tile" key={label} onClick={() => choose(action)} disabled={action === "checkin" && (checkingIn || Boolean(checkIn))}><span>{action === "checkin" && checkingIn ? "⌛" : icon}</span><small>{action === "checkin" && checkIn ? "Вы уже на работе" : label}</small></button>)}</section>
      {panel === "attendance" && <section className="card details"><h2>Последние отметки</h2>{dashboard?.attendance.length ? dashboard.attendance.map((item, index) => <p key={item.id ?? index}>{new Date(item.checkInTime).toLocaleString("ru-RU", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {item.status} · {Math.round(item.distanceMeters)} м</p>) : <p>Отметок пока нет.</p>}</section>}
      {panel === "inspections" && <section className="card details"><h2>Мои проверки</h2>{dashboard?.inspections.length ? dashboard.inspections.map((item) => <p key={item.id}><strong>{item.title}</strong><br />{item.status}{item.score !== null ? ` · ${item.score}%` : ""}{item.date ? ` · ${new Date(item.date).toLocaleDateString("ru-RU")}` : ""}</p>) : <p>Проверок пока нет.</p>}</section>}
      {panel === "kpi" && <section className="card details"><h2>Мой KPI</h2>{dashboard?.kpi ? <p><strong>{dashboard.kpi.score ?? "—"}%</strong><br />KPI филиала: {dashboard.kpi.branchScore ?? "—"}%<br />Допуск к KPI: {dashboard.kpi.eligible ? "да" : "нет"}</p> : <p>KPI за период ещё не рассчитан.</p>}</section>}
    </>}
  </main>;
}
