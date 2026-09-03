"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "@/components/language";

type Data = { balance: number; level: number; xp: number; achievements: { id: string; name: string; description: string; coins: number; earned: boolean }[]; transactions: { id: string; amount: number; reason: string }[] };
export default function AchievementsPage() {
  const { lang, setLang, t } = useLanguage(); const [data, setData] = useState<Data | null>(null); const [error, setError] = useState("");
  const init = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
  useEffect(() => { if (!init) { setError(t("openTelegram")); return; } fetch(`/api/gamification?initData=${encodeURIComponent(init)}`).then(async r => ({ ok: r.ok, body: await r.json() })).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setData(body); }).catch(e => setError(e instanceof Error ? e.message : "Ошибка")); }, [init, lang]);
  return <main><button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button><p className="eyebrow">{t("gamification")}</p><h1>{t("achievements")}</h1>{error && <section className="card warning">{error}</section>}{data ? <><section className="stats-card"><div><span>🦉 Coins</span><strong>{data.balance}</strong></div><div><span>XP</span><strong>{data.xp}</strong></div><div><span>{t("level")}</span><strong>{data.level}</strong></div></section><section className="achievement-grid">{data.achievements.map(a => <section className={`achievement ${a.earned ? "earned" : ""}`} key={a.id}><span>{a.earned ? "🏅" : "🔒"}</span><strong>{a.name}</strong><p>{a.description}</p><small>+{a.coins} 🦉</small></section>)}</section><section className="card details"><h2>{lang === "az" ? "Son əməliyyatlar" : "Последние операции"}</h2>{data.transactions.length ? data.transactions.map(tx => <p key={tx.id}><strong className={tx.amount >= 0 ? "positive" : "negative"}>{tx.amount >= 0 ? "+" : ""}{tx.amount} 🦉</strong> · {tx.reason}</p>) : <p>—</p>}</section></> : <section className="card">{t("loading")}</section>}<LanguageSwitch lang={lang} setLang={setLang} label={t("language")} /></main>;
}
