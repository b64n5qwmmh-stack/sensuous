"use client";

import { useEffect, useState } from "react";

type Person = { id: string; name: string; branchId: string | null; kpi: number | null; branchKpi: number | null; eligible: boolean; yearKpi: number | null; rank?: number };
type Team = { branches: { id: string; name: string; employees: Person[] }[]; leaderboard: { month: Person[]; year: Person[] }; canAward: boolean };
type Detail = { employee: Person; inspections: { id: string; title: string; type: string; inspector: string; score: number | null; date: string | null; status: string | null; answers: { question: string; result: string; score: number | null }[] }[]; canAward: boolean };

declare global { interface Window { Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void } } } }

export default function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mode, setMode] = useState<"branches" | "month" | "year">("branches");
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const initData = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";

  useEffect(() => {
    const app = window.Telegram?.WebApp; app?.ready(); app?.expand();
    if (!initData) { setMessage("Открой раздел через Telegram Mini App."); return; }
    fetch(`/api/overview?initData=${encodeURIComponent(initData)}`).then(async (response) => ({ ok: response.ok, body: await response.json() })).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setTeam(body); }).catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить команду."));
  }, [initData]);

  async function showEmployee(id: string) {
    const response = await fetch(`/api/overview?initData=${encodeURIComponent(initData)}&employeeId=${encodeURIComponent(id)}`);
    const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "Не удалось открыть сотрудника."); return; }
    setDetail(body); setOpenInspection(null);
  }

  async function award(period: "month" | "year") {
    if (!detail) return;
    const response = await fetch("/api/overview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData, employeeId: detail.employee.id, employeeName: detail.employee.name, branchId: detail.employee.branchId, period }) });
    const body = await response.json();
    setMessage(response.ok ? `${period === "month" ? "Сотрудник месяца" : "Сотрудник года"} сохранён в Notion.` : body.error ?? "Не удалось сохранить награду.");
  }

  const list = mode === "month" ? team?.leaderboard.month : team?.leaderboard.year;
  if (detail) return <main>
    <button className="back" onClick={() => setDetail(null)}>← Команда</button>
    <p className="eyebrow">КАРТОЧКА СОТРУДНИКА</p><h1>{detail.employee.name}</h1>
    <section className="card"><p><strong>Личный KPI: {detail.employee.kpi ?? "—"}%</strong><br />KPI филиала: {detail.employee.branchKpi ?? "—"}%<br />Допуск: {detail.employee.eligible ? "да" : "нет"}</p></section>
    {detail.canAward && <section className="actions compact"><button onClick={() => award("month")}>Выбрать сотрудником месяца</button><button onClick={() => award("year")}>Выбрать сотрудником года</button></section>}
    <h2 className="section-title">Проверки</h2>
    {detail.inspections.length ? detail.inspections.map((inspection) => <section className="card inspection" key={inspection.id}>
      <button className="inspection-head" onClick={() => setOpenInspection(openInspection === inspection.id ? null : inspection.id)}><strong>{inspection.type}</strong><span>{inspection.score ?? "—"}% · {inspection.date ? new Date(inspection.date).toLocaleDateString("ru-RU") : ""}</span></button>
      <p>Проверил: {inspection.inspector} · {inspection.status}</p>
      {openInspection === inspection.id && <div className="answers">{inspection.answers.map((answer, index) => <p key={`${inspection.id}-${index}`}><strong>{index + 1}. {answer.question}</strong><br />Оценка: {answer.result}{answer.score !== null ? ` (${answer.score}/5)` : ""}</p>)}</div>}
    </section>) : <section className="card">Проверок пока нет.</section>}
  </main>;

  return <main>
    <button className="back" onClick={() => { window.location.href = "/"; }}>← Главная</button>
    <p className="eyebrow">SENSUM STAFF OS</p><h1>Команда и рейтинг</h1>{message && <section className="card warning">{message}</section>}
    {!team ? <section className="card">Загружаем данные…</section> : <>
      <section className="tabs"><button className={mode === "branches" ? "selected" : ""} onClick={() => setMode("branches")}>Филиалы</button><button className={mode === "month" ? "selected" : ""} onClick={() => setMode("month")}>Месяц</button><button className={mode === "year" ? "selected" : ""} onClick={() => setMode("year")}>Год</button></section>
      {mode === "branches" ? team.branches.map((branch) => <section className="card team-branch" key={branch.id}><h2>{branch.name}</h2>{branch.employees.map((person) => <button className="person-row" onClick={() => showEmployee(person.id)} key={person.id}><span>{person.name}</span><strong>{person.kpi ?? "—"}%</strong></button>)}</section>) : <section className="card ranking"><h2>{mode === "month" ? "Рейтинг месяца" : "Рейтинг года"}</h2>{list?.length ? list.map((person) => <button className="person-row" onClick={() => showEmployee(person.id)} key={person.id}><span>#{person.rank} · {person.name}</span><strong>{mode === "month" ? person.kpi : person.yearKpi}%</strong></button>) : <p>Появится после первых рассчитанных KPI.</p>}</section>}
    </>}
  </main>;
}
