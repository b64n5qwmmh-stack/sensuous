"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "@/components/language";

type Achievement = { id: string; name: string; description: string; coins: number; earned: boolean };
type Data = { balance: number; level: number; xp: number; achievements: Achievement[]; transactions: { id: string; amount: number; reason: string }[] };
const az: Record<string, [string, string]> = {
  "Точный старт": ["Dəqiq başlanğıc", "GPS ilə vaxtında işə gəlin."], "Стандарт Sensum": ["Sensum standartı", "İlk yoxlamada 90% və ya daha yüksək nəticə."], "Идеальный стандарт": ["Mükəmməl standart", "İlk yoxlamada 100% nəticə."], "KPI 80+": ["KPI 80+", "Şəxsi aylıq KPI 80%-dən aşağı deyil."], "KPI 90+": ["KPI 90+", "Şəxsi aylıq KPI 90%-dən aşağı deyil."], "Сотрудник месяца": ["Ayın əməkdaşı", "Reytinq üzrə Coffee Department Head tərəfindən seçilir."], "Сотрудник года": ["İlin əməkdaşı", "Sensum-un əsas illik mükafatı."], "Командный результат": ["Komanda nəticəsi", "Filial aylıq 80%+ KPI əldə edib."], "Идея работает": ["İdeya işləyir", "Əməkdaşın ideyası işə tətbiq olunub."],
};

export default function AchievementsPage() {
  const { lang, setLang, t } = useLanguage();
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState("");
  const init = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
  useEffect(() => { if (!init) { setError(t("openTelegram")); return; } fetch(`/api/gamification?initData=${encodeURIComponent(init)}`).then(async r => ({ ok: r.ok, body: await r.json() })).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setData(body); }).catch(e => setError(e instanceof Error ? e.message : "Ошибка")); }, [init, lang]);
  const xpProgress = data ? Math.min(100, (data.xp % 150) / 1.5) : 0;
  return <main className="achievements-page">
    <button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button>
    <p className="eyebrow">{t("gamification")}</p><h1>{t("achievements")}</h1>
    {error && <section className="card warning">{error}</section>}
    {!data ? <section className="card">{t("loading")}</section> : <>
      <section className="wallet"><div className="owl-large">🦉</div><div><span>{t("coins")}</span><strong>{data.balance}</strong><small>SENSUM Coins</small></div><div className="level-pill"><small>{t("level")}</small><strong>{data.level}</strong></div></section>
      <section className="xp-card"><div><span>{t("experience")}</span><strong>{data.xp} XP</strong></div><div className="xp-track"><i style={{ width: `${xpProgress}%` }} /></div><small>{Math.round(xpProgress)}% · 150 XP</small></section>
      <div className="section-row"><h2>{t("allAchievements")}</h2><span>{data.achievements.filter(a => a.earned).length}/{data.achievements.length}</span></div>
      <section className="achievement-list">{data.achievements.map(a => { const tr = lang === "az" ? az[a.name] : undefined; return <article className={`achievement-card ${a.earned ? "earned" : ""}`} key={a.id}><div className="achievement-icon">{a.earned ? "🏅" : "🔒"}</div><div className="achievement-body"><div><h3>{tr?.[0] ?? a.name}</h3><span className="achievement-status">{a.earned ? t("received") : t("locked")}</span></div><p>{tr?.[1] ?? a.description}</p><strong>+{a.coins} 🦉</strong></div></article>; })}</section>
      <section className="card details"><h2>{t("recentOperations")}</h2>{data.transactions.length ? data.transactions.map(tx => <p key={tx.id}><strong className={tx.amount >= 0 ? "positive" : "negative"}>{tx.amount >= 0 ? "+" : ""}{tx.amount} 🦉</strong><br /><span>{tx.reason}</span></p>) : <p>—</p>}</section>
    </>}
    <LanguageSwitch lang={lang} setLang={setLang} label={t("language")} />
  </main>;
}
