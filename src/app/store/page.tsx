"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "@/components/language";
type Item = { id: string; name: string; description: string; price: number; stock: number };
type Data = { balance: number; items: Item[] };
const azItems: Record<string, [string, string]> = {
  "Напиток на выбор": ["İstədiyiniz içki", "Standart menyudan istənilən içki."],
  "Десерт или сэндвич": ["Desert və ya sendviç", "Vitrindən bir desert və ya sendviç."],
  "Фирменный мерч": ["Brend məhsulu", "Sensum-dan kiçik hədiyyə."],
  "Удобный выходной": ["Rahat istirahət günü", "Menecerlə razılaşdırılmış əlavə istirahət günü."],
};
export default function StorePage() {
  const { lang, setLang, t } = useLanguage(); const [data, setData] = useState<Data | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState("");
  const init = typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
  function load() { if (!init) { setMessage(t("openTelegram")); return; } fetch(`/api/gamification?initData=${encodeURIComponent(init)}`).then(async r => ({ ok: r.ok, body: await r.json() })).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setData(body); }).catch(e => setMessage(e instanceof Error ? e.message : "Ошибка")); }
  useEffect(load, [init, lang]);
  async function buy(item: Item) { if (!confirm(`${item.name} — ${item.price} 🦉?`)) return; setBusy(item.id); const r = await fetch("/api/gamification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: init, itemId: item.id }) }); const b = await r.json(); setBusy(""); setMessage(r.ok ? (lang === "az" ? "Sifariş yaradıldı." : "Заказ создан.") : b.error); if (r.ok) load(); }
  return <main><button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button><p className="eyebrow">{t("rewards")}</p><h1>{t("store")}</h1>{data && <section className="coin-banner">🦉 {data.balance} {t("coins")}</section>}{message && <section className="card warning">{message}</section>}{data ? <section className="store-grid">{data.items.map(item => { const translated = lang === "az" ? azItems[item.name] : undefined; return <section className="store-item" key={item.id}><span>🎁</span><h2>{translated?.[0] ?? item.name}</h2><p>{translated?.[1] ?? item.description}</p><strong>{item.price} 🦉</strong><button onClick={() => buy(item)} disabled={busy === item.id || item.stock < 1 || data.balance < item.price}>{busy === item.id ? t("saving") : lang === "az" ? "Al" : "Купить"}</button></section>; })}</section> : <section className="card">{t("loading")}</section>}<LanguageSwitch lang={lang} setLang={setLang} label={t("language")} /></main>;
}
