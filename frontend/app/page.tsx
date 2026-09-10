"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const reveal = useReveal();
  const t = useTranslations("landing");
  const tn = useTranslations("nav");

  // V5.0: chapter + stat copy lives in the landing dictionary (ch1..ch7, st1..st4).
  const CHAPTERS = [
    { tag: t("ch1tag"), title: [t("ch1t1"), t("ch1t2")], body: t("ch1body") },
    { tag: t("ch2tag"), title: [t("ch2t1"), t("ch2t2")], body: t("ch2body") },
    { tag: t("ch3tag"), title: [t("ch3t1"), t("ch3t2")], body: t("ch3body") },
    { tag: t("ch4tag"), title: [t("ch4t1"), t("ch4t2")], body: t("ch4body") },
    { tag: t("ch5tag"), title: [t("ch5t1"), t("ch5t2")], body: t("ch5body") },
    { tag: t("ch6tag"), title: [t("ch6t1"), t("ch6t2")], body: t("ch6body") },
    { tag: t("ch7tag"), title: [t("ch7t1"), t("ch7t2")], body: t("ch7body") },
  ];

  const STATS = [
    { n: "243", l: t("st1") },
    { n: "100%", l: t("st2") },
    { n: "3", l: t("st3") },
    { n: "∞", l: t("st4") },
  ];

  const CAPS = [
    { tk: "capSurveyTitle", dk: "capSurveyDesc", f: true },
    { tk: "capIntelTitle", dk: "capIntelDesc" },
    { tk: "capTwinTitle", dk: "capTwinDesc" },
    { tk: "capRipenessTitle", dk: "capRipenessDesc" },
    { tk: "capPlanTitle", dk: "capPlanDesc" },
    { tk: "capRobotTitle", dk: "capRobotDesc", f: true },
    { tk: "capControlTitle", dk: "capControlDesc" },
    { tk: "capAnalyticsTitle", dk: "capAnalyticsDesc" },
  ] as const;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = gsap.context(() => {
      // Hero film: visible at rest (headline + clip are the first thing a
      // visitor sees); scrolling settles the clip and gives the caption a
      // gentle parallax drift — reveal enhances, never gates.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: ".film", start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      tl.fromTo(".film-hero", { scale: 1.08 }, { scale: 1, ease: "none" }, 0)
        .to(".film-cap-inner", { yPercent: -12, ease: "none" }, 0)
        .to(".film-hero", { yPercent: -4, ease: "none" }, 0);

      // Chapter beats: glide in from the beat's own alignment side, once.
      gsap.utils.toArray<HTMLElement>(".chapter").forEach((ch, i) => {
        const fromRight = i % 2 === 1;
        gsap.fromTo(
          ch.querySelector(".chapter-inner"),
          { opacity: 0, x: fromRight ? 48 : -48 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: ch, start: "top 80%" },
          }
        );
      });

      // Stat count-up
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const target = el.dataset.count!;
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target === "∞" ? 1 : parseInt(target, 10),
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            el.textContent = target === "∞" ? "∞" : Math.round(obj.v).toString();
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={(r) => { root.current = r; reveal(r); }}>
      {/* ══════════ HERO FILM ══════════ */}
      <section className="film" aria-label={t("filmAria")}>
        <div className="film-stage">
          <div className="film-hero depth-3" aria-hidden="true">
            <video
              className="film-video"
              src="/clips/1.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>
          <div className="film-scrim" aria-hidden="true" />

          <div className="film-cap cap-open">
            <div className="film-cap-inner">
              <p className="kicker">{t("heroKicker")}</p>
              <h1 className="font-display tracking-tightest">
                {t("heroTitleA")} <span className="lede-accent">{t("heroTitleB")}</span>
              </h1>
              <p className="film-sub">
                {t("heroSub")}
              </p>
              <div className="film-cta">
                <Link href="/dashboard" className="btn btn-glass btn-glass-primary">{t("ctaControl")}</Link>
                <Link href="#story" className="btn btn-glass">{t("ctaStory")}</Link>
              </div>
            </div>
          </div>

          <div className="scroll-cue" aria-hidden="true">{t("scrollCue")}</div>
        </div>
      </section>

      {/* ══════════ CHAPTER BEATS ══════════ */}
      <section className="beats" aria-label={t("beatsAria")}>
        {CHAPTERS.map((c, i) => (
          <div className="chapter" key={i}>
            <div className="chapter-inner">
              <span className="chapter-idx font-mono">{c.tag}</span>
              <h2 className="font-display tracking-tightest">
                {c.title.map((t, j) => (
                  <span key={j}>
                    {t}
                    <br />
                  </span>
                ))}
              </h2>
              <p className="chapter-body">{c.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ══════════ STATS STRIP ══════════ */}
      <section className="stats" data-reveal>
        <div className="stats-grid">
          {STATS.map((s) => (
            <div className="stat" key={s.l}>
              <div className="stat-n font-display" data-count={s.n}>0</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ STORY / MANIFESTO ══════════ */}
      <section className="manifesto" id="story" data-reveal>
        <p className="kicker">{t("manifestoKicker")}</p>
        <h2 className="font-display tracking-tightest">
          {t("manifestoTitleA")} <span className="lede-accent">{t("manifestoTitleB")}</span>
        </h2>
        <p className="manifesto-sub">
          {t("manifestoSub")}
        </p>
      </section>

      {/* ══════════ CAPABILITY GRID ══════════ */}
      <section className="caps" aria-label={t("capsAria")}>
        <div className="caps-head" data-reveal>
          <p className="kicker">{t("capsKicker")}</p>
          <h2 className="font-display tracking-tightest">{t("capsTitle")}</h2>
        </div>
        <div className="caps-grid">
          {CAPS.map((c) => (
            <div className={"cap panel-2" + ("f" in c && c.f ? " cap-f" : "")} key={c.tk} data-reveal>
              <h3 className="cap-t">{t(c.tk)}</h3>
              <p className="cap-d">{t(c.dk)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ CLOSING CTA ══════════ */}
      <section className="closer" data-reveal>
        <h2 className="font-display tracking-tightest">
          {t("closerTitleA")} <span className="lede-accent">{t("closerTitleB")}</span>
        </h2>
        <p className="closer-sub">{t("closerSub")}</p>
        <div className="closer-cta">
          <Link href="/survey" className="btn btn-glass btn-glass-primary">{t("closerSurvey")}</Link>
          <Link href="/map" className="btn btn-glass">{t("closerTwin")}</Link>
        </div>
      </section>

      <footer className="land-foot">
        <div className="land-foot-in">
          <span className="land-foot-mark font-display">Veraxis</span>
          <span className="land-foot-tag">{t("footTag")}</span>
        </div>
        <div className="land-foot-links">
          <Link href="/dashboard">{tn("missionControl")}</Link>
          <Link href="/survey">{tn("survey")}</Link>
          <Link href="/map">{tn("digitalTwin")}</Link>
          <Link href="/robot">{tn("robotOps")}</Link>
          <Link href="/robot/history">{tn("history")}</Link>
        </div>
        <p className="land-foot-fine">{t("footFine")}</p>
      </footer>

      <style jsx>{`
        .film {
          height: 220vh;
          position: relative;
        }
        .film-stage {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          display: grid;
          place-items: center;
        }
        .depth-3 {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }
        .film-hero {
          z-index: 1;
        }
        .film-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.62;
        }
        /* Cinematic scrim: keeps caption legible without a neon bloom */
        .film-scrim {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(58% 50% at 50% 48%, rgba(14, 18, 13, 0.28) 0%, rgba(14, 18, 13, 0.62) 100%),
            linear-gradient(180deg, rgba(14, 18, 13, 0.58) 0%, rgba(14, 18, 13, 0.22) 32%, rgba(14, 18, 13, 0.82) 100%);
        }
        .film-cap {
          position: absolute;
          z-index: 5;
          text-align: center;
          padding: 0 24px;
          max-width: 880px;
          color: #f3f6ee;
        }
        .film-cap .kicker {
          color: rgba(232, 240, 224, 0.94);
        }
        .film-cap h1 {
          color: #ffffff;
          text-shadow: 0 1px 30px rgba(14, 18, 13, 0.45);
        }
        .cap-open h1 {
          font-size: clamp(40px, 7vw, 96px);
          font-weight: 700;
          line-height: 1.0;
          margin-top: 14px;
        }
        .film-sub {
          margin: 22px auto 0;
          max-width: 540px;
          color: rgba(240, 245, 234, 0.96);
          font-size: clamp(15px, 1.5vw, 19px);
          line-height: 1.6;
          text-shadow: 0 1px 16px rgba(14, 18, 13, 0.5);
        }
        .film-cta {
          margin-top: 34px;
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .scroll-cue {
          position: absolute;
          bottom: 5vh;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: var(--color-text-faint);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .scroll-cue::after {
          content: "";
          width: 1px;
          height: 34px;
          background: linear-gradient(var(--color-husk), transparent);
          animation: cue 1.8s ease-in-out infinite;
        }
        @keyframes cue {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(8px); opacity: 0.3; }
        }

        .beats {
          position: relative;
          z-index: 2;
          padding: 8vh 7vw;
          max-width: 1100px;
          margin: 0 auto;
        }
        /* Living backdrop: a soft sage wash + faint field-grid, on-palette,
           so the beats read as a surface rather than a blank slab. */
        .beats::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(120% 50% at 100% 0%, var(--color-accent-glow) 0%, transparent 55%),
            radial-gradient(120% 50% at 0% 100%, rgba(169, 130, 74, 0.08) 0%, transparent 55%),
            linear-gradient(var(--color-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-line) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 64px 64px, 64px 64px;
          -webkit-mask-image: radial-gradient(80% 80% at 50% 50%, #000 40%, transparent 100%);
          mask-image: radial-gradient(80% 80% at 50% 50%, #000 40%, transparent 100%);
          opacity: 0.5;
        }
        .chapter {
          min-height: 46vh;
          display: flex;
          align-items: center;
        }
        .chapter:nth-child(even) {
          justify-content: flex-end;
          text-align: right;
        }
        .chapter-inner {
          max-width: 540px;
        }
        .chapter-idx {
          font-size: 12px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--color-husk);
        }
        .chapter h2 {
          font-size: clamp(32px, 5vw, 68px);
          font-weight: 700;
          line-height: 1.02;
          margin: 16px 0 18px;
        }
        .chapter-body {
          color: var(--color-text-dim);
          font-size: clamp(15px, 1.4vw, 18px);
          line-height: 1.7;
        }

        .stats {
          padding: 8vh 7vw 4vh;
        }
        .stats-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 5vw;
          max-width: 1100px;
          margin: 0 auto;
          text-align: center;
        }
        .stat-n {
          font-size: clamp(44px, 6vw, 84px);
          font-weight: 700;
          line-height: 1;
        }
        .stat-l {
          margin-top: 10px;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }

        .manifesto {
          text-align: center;
          padding: 18vh 7vw;
          max-width: 1000px;
          margin: 0 auto;
        }
        .manifesto h2 {
          font-size: clamp(30px, 4.6vw, 64px);
          font-weight: 700;
          line-height: 1.08;
          margin-top: 18px;
        }
        .manifesto-sub {
          margin: 26px auto 0;
          max-width: 620px;
          color: var(--color-text-dim);
          font-size: clamp(15px, 1.4vw, 18px);
          line-height: 1.7;
        }

        .caps {
          padding: 8vh 7vw 12vh;
          max-width: 1300px;
          margin: 0 auto;
        }
        .caps-head {
          margin-bottom: 40px;
          max-width: 640px;
        }
        .caps-head h2 {
          font-size: clamp(28px, 4vw, 56px);
          font-weight: 700;
          line-height: 1.05;
          margin-top: 14px;
        }
        .caps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .cap {
          padding: 26px 22px;
          transition: transform 0.3s var(--ease-out), border-color 0.3s;
        }
        /* Bento rhythm: two featured cells carry the two hero capabilities. */
        @media (min-width: 900px) {
          .cap-f { grid-column: span 2; }
        }
        .cap-f {
          background: var(--color-accent-weak);
          border: 1px solid var(--color-accent-dim);
        }
        .cap-f .cap-t { font-size: 20px; }
        .cap:hover {
          transform: translateY(-3px);
          border-color: var(--color-accent-dim);
        }
        .cap-t {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--color-text);
        }
        .cap-d {
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--color-text-dim);
        }

        .closer {
          position: relative;
          text-align: center;
          padding: 16vh 7vw;
          margin: 0 auto;
          max-width: 1200px;
          border-radius: var(--radius-xl);
          overflow: hidden;
          background:
            radial-gradient(90% 120% at 50% 0%, rgba(63, 125, 52, 0.5) 0%, transparent 60%),
            linear-gradient(160deg, #1d261b 0%, #0e120d 100%);
          color: #f3f6ee;
        }
        .closer h2 {
          font-size: clamp(34px, 5.5vw, 80px);
          font-weight: 700;
          line-height: 1.02;
          color: #f6f8f2;
        }
        .closer h2 :global(.lede-accent) {
          color: var(--color-accent-dim);
        }
        .closer-sub {
          margin: 22px auto 34px;
          color: rgba(226, 234, 218, 0.82);
          font-size: 17px;
        }
        .closer-cta {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .land-foot {
          border-top: 1px solid var(--color-line);
          padding: 8vh 7vw 6vh;
        }
        .land-foot-in {
          display: flex;
          align-items: baseline;
          gap: 16px;
          flex-wrap: wrap;
          max-width: 1300px;
          margin: 0 auto;
        }
        .land-foot-mark {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: var(--color-accent);
        }
        .land-foot-tag {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }
        .land-foot-links {
          display: flex;
          gap: 26px;
          flex-wrap: wrap;
          margin: 28px auto 0;
          max-width: 1300px;
        }
        .land-foot-links a {
          color: var(--color-text-dim);
          text-decoration: none;
          font-size: 14px;
        }
        .land-foot-links a:hover {
          color: var(--color-accent);
        }
        .land-foot-fine {
          margin: 30px auto 0;
          max-width: 1300px;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }

        @media (max-width: 1000px) {
          .caps-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 620px) {
          .caps-grid { grid-template-columns: 1fr; }
          .film { height: 180vh; }
          .beats { padding: 5vh 22px; }
          .stats { padding: 5vh 22px 3vh; }
          .manifesto { padding: 9vh 22px; }
          .caps { padding: 5vh 22px 7vh; }
          .closer { padding: 9vh 22px; }
          .land-foot { padding: 6vh 22px 5vh; }
          .cap { padding: 20px 18px; }
          .chapter { min-height: 40vh; }
          .chapter h2 { font-size: clamp(28px, 8vw, 44px); }
        }
      `}</style>
    </div>
  );
}
