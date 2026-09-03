"use client";
import { LanguageSwitch, useLanguage } from "@/components/language";
export default function AchievementsPage() { const {lang,setLang,t}=useLanguage(); return <main><button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button><p className="eyebrow">{t("gamification")}</p><h1>{t("achievements")}</h1><section className="card"><h2>{t("achievementsSoon")}</h2><p>{t("achievementsText")}</p></section><LanguageSwitch lang={lang} setLang={setLang} label={t("language")} /></main>; }
