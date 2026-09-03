"use client";

import { useEffect, useState } from "react";

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; name: string; status: string }
  | { kind: "unlinked"; telegramId: number }
  | { kind: "error"; message: string };

type CheckIn = { id?: string; checkInTime: string; distanceMeters: number; status: string; branch?: string; alreadyCheckedIn?: boolean };
type Dashboard = {
  attendance: CheckIn[];
  inspections: { id: string; title: string; status: string; score: number | null; date: string | null }[];
  kpi: { score: number | null; status: string; period: string | null } | null;
};
type ActivePanel = "attendance" | "inspections" | "kpi" | null;

declare global {
  interface Window {
    Telegram?: { WebApp?: { ready(): void; expand(): void; initData: string } };
  }
}

export default function HomePage() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready(); app?.expand();
    if (!app?.initData) return setState({ kind: "error", message: "Открой панель через Telegram-бота." });

    (async () => {
      const me = await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
      const meBody = await me.json();
      if (!me.ok) throw new Error(meBody.error ?? "Не удалось открыть профиль.");
      if (meBody.status === "unlinked") return setState({ kind: "unlinked", telegramId: meBody.telegramId });
      setState({ kind: "ready", name: meBody.employee.fullName, status: meBody.employee.status });
      const data = await fetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
      if (data.ok) setDashboard(await data.json());
    })().catch((error) => setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось открыть профиль." }));
  }, []);

  async function handleCheckIn() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !navigator.geolocation) return setState({ kind: "error", message: "GPS недоступен. Открой панель через Telegram на телефоне." });
    setCheckingIn(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/attendance/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Не удалось сохранить отметку.");
        setCheckIn({ ...body.record, branch: body.branch, alreadyCheckedIn: body.alreadyCheckedIn });
      } catch (error) {
        setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось сохранить отметку." });
      } finally { setCheckingIn(false); }
    }, (error) => { setCheckingIn(false); setState({ kind: "error", message: `Не удалось получить GPS: ${error.message}` }); }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  }

  const toggle = (panel: ActivePanel) => setActivePanel(activePanel === panel ? null : panel);
  const format = (value: string) => new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return <main>
    <section className="hero"><p className="eyebrow">SENSUM STAFF OS</p><h1>Рабочая панель</h1><p>Отметки, проверки и KPI — в одном месте.</p></section>
    {state.kind === "loading" && <section className="card">Проверяем доступ…</section>}
    {state.kind === "error" && <section className="card warning">{state.message}</section>}
    {state.kind === "unlinked" && <section className="card warning"><h2>Профиль ещё не привязан</h2><p>Твой Telegram ID: <code>{state.telegramId}</code></p><p>Передай этот ID администратору.</p></section>}
    {state.kind === "ready" && <>
      <section className="card"><p className="eyebrow">{state.status}</p><h2>{state.name}</h2><p>Отметься по GPS после прихода на филиал.</p></section>
      {checkIn && <section className="card success"><p className="eyebrow">{checkIn.alreadyCheckedIn ? "УЖЕ ОТМЕЧЕН" : "ОТМЕТКА СОХРАНЕНА"}</p><h2>{format(checkIn.checkInTime)}</h2><p>{checkIn.branch ? `${checkIn.branch} · ` : ""}{Math.round(checkIn.distanceMeters)} м от точки · {checkIn.status}</p></section>}
      <section className="actions">
        <button onClick={handleCheckIn} disabled={checkingIn || Boolean(checkIn)}>{checkingIn ? "Определяем GPS…" : checkIn ? "Я уже на работе" : "Я на работе"}</button>
        <button onClick={() => toggle("attendance")}>Мой журнал прихода</button>
        <button onClick={() => toggle("inspections")}>Мои проверки</button>
        <button onClick={() => toggle("kpi")}>Мой KPI</button>
      </section>
      {activePanel === "attendance" && <section className="card success"><h2>Последние отметки</h2>{dashboard?.attendance.length ? dashboard.attendance.map((item, index) => <p key={item.id ?? index}>{format(item.checkInTime)} · {item.status} · {Math.round(item.distanceMeters)} м</p>) : <p>Отметок пока нет.</p>}</section>}
      {activePanel === "inspections" && <section className="card success"><h2>Мои проверки</h2>{dashboard?.inspections.length ? dashboard.inspections.map((item) => <p key={item.id}><strong>{item.title}</strong><br />{item.status}{item.score !== null ? ` · ${item.score}%` : ""}{item.date ? ` · ${format(item.date)}` : ""}</p>) : <p>Проверок пока нет.</p>}</section>}
      {activePanel === "kpi" && <section className="card success"><h2>Мой KPI</h2>{dashboard?.kpi ? <p><strong>{dashboard.kpi.score ?? "—"}%</strong><br />{dashboard.kpi.status}{dashboard.kpi.period ? ` · ${format(dashboard.kpi.period)}` : ""}</p> : <p>KPI за период ещё не рассчитан.</p>}</section>}
    </>}
  </main>;
}
