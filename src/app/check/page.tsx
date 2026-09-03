"use client";

import { useEffect, useState } from "react";

type Option = { typeId: string; typeName: string; employees: { id: string; name: string }[] };
type Question = { id: string; text: string };

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void } };
  }
}

export default function CheckPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [pick, setPick] = useState("");
  const [target, setTarget] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initData = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
  const option = options.find((item) => item.typeId === pick);

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready();
    app?.expand();
    if (!initData) {
      setMessage("Открой эту страницу из Mini App Telegram-бота.");
      setLoading(false);
      return;
    }
    fetch(`/api/inspection?initData=${encodeURIComponent(initData)}`)
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error ?? "Не удалось загрузить доступ.");
        setOptions(body.options ?? []);
        if (!(body.options ?? []).length) setMessage("Для вашей роли пока нет доступных проверок.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить проверки."))
      .finally(() => setLoading(false));
  }, [initData]);

  async function openChecklist() {
    if (!pick || !target) return;
    setMessage("");
    const response = await fetch(`/api/inspection?initData=${encodeURIComponent(initData)}&typeId=${encodeURIComponent(pick)}`);
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Не удалось открыть чек-лист.");
      return;
    }
    const loaded = body.questions as Question[];
    setQuestions(loaded);
    setAnswers(Object.fromEntries(loaded.map((question) => [question.id, ""])));
  }

  async function submit() {
    if (questions.some((question) => !answers[question.id])) {
      setMessage("Оцените каждый пункт или выберите Skip.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/inspection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData, targetId: target, typeId: pick, answers }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Не удалось сохранить проверку.");
      return;
    }
    setMessage(`Проверка сохранена: ${body.percent}%. Личный KPI: ${body.kpi.personalScore}%, KPI филиала: ${body.kpi.branchScore}%. Допуск: ${body.kpi.eligible ? "да" : "нет"}.`);
    setQuestions([]);
    setAnswers({});
    setTarget("");
  }

  return <main>
    <p className="eyebrow">SENSUM STAFF OS</p>
    <h1>Провести проверку</h1>
    {message && <section className="card warning">{message}</section>}
    {loading ? <section className="card">Загружаем доступные проверки…</section> : <section className="card">
      <label>Чек-лист
        <select value={pick} onChange={(event) => { setPick(event.target.value); setTarget(""); setQuestions([]); setAnswers({}); }}>
          <option value="">Выберите чек-лист</option>
          {options.map((item) => <option key={item.typeId} value={item.typeId}>{item.typeName}</option>)}
        </select>
      </label>
      {option && <label>Сотрудник
        <select value={target} onChange={(event) => { setTarget(event.target.value); setQuestions([]); setAnswers({}); }}>
          <option value="">Выберите сотрудника</option>
          {option.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
      </label>}
      <button onClick={openChecklist} disabled={!pick || !target}>Открыть чек-лист</button>
      {questions.map((question, index) => <div className="question" key={question.id}>
        <p><strong>{index + 1}. {question.text}</strong></p>
        <div className="scores">{["1", "2", "3", "4", "5", "Skip"].map((score) => <button className={answers[question.id] === score ? "selected" : ""} key={score} onClick={() => setAnswers({ ...answers, [question.id]: score })}>{score}</button>)}</div>
      </div>)}
      {questions.length > 0 && <button onClick={submit} disabled={saving}>{saving ? "Сохраняем…" : "Завершить проверку"}</button>}
    </section>}
  </main>;
}
