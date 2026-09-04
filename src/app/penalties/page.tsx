"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "@/components/language";

type Employee = { id: string; name: string };
export default function PenaltiesPage() {
  const { lang, setLang, t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]); const [employeeId, setEmployeeId] = useState("");
  const [deduction, setDeduction] = useState("5"); const [reason, setReason] = useState(""); const [severity, setSeverity] = useState<"Minor" | "Major" | "Critical">("Minor");
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const initData = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
  useEffect(() => { if (!initData) { setMessage(t("openTelegram")); return; } fetch(`/api/penalties?initData=${encodeURIComponent(initData)}`).then(async r => ({ ok: r.ok, body: await r.json() })).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setEmployees(body.employees); }).catch(e => setMessage(e instanceof Error ? e.message : "Ошибка доступа")); }, [initData, t]);
  async function submit() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/penalties", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData, employeeId, deduction: Number(deduction), reason, severity }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(body.error ?? "Не удалось назначить штраф."); return; }
    setMessage(lang === "az" ? `Cərimə qeydə alındı. Yeni KPI: ${body.kpi.personalScore}%.` : `Штраф сохранён. Новый KPI сотрудника: ${body.kpi.personalScore}%.`);
    setReason(""); setEmployeeId("");
  }
  return <main><button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button><p className="eyebrow">KPI CONTROL</p><h1>{t("penalties")}</h1><p className="hint">{t("penaltyHint")}</p>{message && <section className="card warning">{message}</section>}<section className="card penalty-form"><label>{t("employee")}<select value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">{t("chooseEmployee")}</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>{t("deduction")}<input type="number" min="1" max="100" value={deduction} onChange={e => setDeduction(e.target.value)} /></label><label>{t("severity")}<select value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}><option value="Minor">{t("minor")}</option><option value="Major">{t("major")}</option><option value="Critical">{t("critical")}</option></select></label><label>{t("penaltyReason")}<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t("penaltyPlaceholder")} /></label><button onClick={submit} disabled={saving || !employeeId || !reason.trim()}>{saving ? t("saving") : t("applyPenalty")}</button></section><LanguageSwitch lang={lang} setLang={setLang} label={t("language")} /></main>;
}
