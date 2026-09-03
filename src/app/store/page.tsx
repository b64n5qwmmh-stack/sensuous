"use client";
import { LanguageSwitch, useLanguage } from "@/components/language";
export default function StorePage() { const {lang,setLang,t}=useLanguage(); return <main><button className="back" onClick={() => { window.location.href = "/"; }}>{t("backHome")}</button><p className="eyebrow">{t("rewards")}</p><h1>{t("store")}</h1><section className="card"><h2>{t("storeSoon")}</h2><p>{t("storeText")}</p></section><LanguageSwitch lang={lang} setLang={setLang} label={t("language")} /></main>; }
