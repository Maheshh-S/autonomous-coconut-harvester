"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";

gsap.registerPlugin(ScrollTrigger);

const CHAPTERS = [
  {
    tag: "01 · The Challenge",
    title: ["Tall trees.", "Manual harvest."],
    body: "Coconut palms reach 25 metres. Climbing them by hand is slow, dangerous, and unscalable. The world's harvest depends on a vanishing skill.",
  },
  {
    tag: "02 · Aerial Survey",
    title: ["A drone maps", "every tree."],
    body: "An autonomous flight planner sweeps the plantation. Computer vision detects each palm and assigns a permanent Tree ID — no tree left uncounted.",
  },
  {
    tag: "03 · Digital Twin",
    title: ["The farm,", "rebuilt in silicon."],
    body: "Survey tiles assemble into a living Digital Twin. Every tree, its GPS, and its detection geometry become queryable, actionable intelligence.",
  },
  {
    tag: "04 · Ripeness Intelligence",
    title: ["AI reads", "each coconut."],
    body: "Close-up inspection classifies every fruit as mature, potential, or premature. An immutable inventory snapshot is written for the record.",
  },
  {
    tag: "05 · Mission Planning",
    title: ["Optimal routes,", "computed."],
    body: "The Harvest Planner builds a frozen, nearest-neighbour mission from the latest inventory — a precise, auditable work order for the field.",
  },
  {
    tag: "06 · The Robot",
    title: ["It climbs.", "It harvests."],
    body: "A tree-climbing harvester navigates the twin, ascends the trunk, and plucks only the mature coconuts — safely, repeatedly, autonomously.",
  },
  {
    tag: "07 · Mission Analytics",
    title: ["Every run,", "measured."],
    body: "Each mission closes with a scored analytics record: distance, battery economy, yield, and efficiency. The operation improves with every pass.",
  },
];

const STATS = [
  { n: "243", l: "Trees surveyed / mission" },
  { n: "100%", l: "Autonomous routing" },
  { n: "3", l: "Maturity classes detected" },
  { n: "∞", l: "Missions, replayed & scored" },
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const reveal = useReveal();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = gsap.context(() => {
      // Hero film: settle the clip + rise the caption (no neon, no scrubbed grid)
      const stage = root.current!.querySelector(".film-stage");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: ".film", start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      tl.fromTo(".film-hero", { scale: 1.12, opacity: 0.0 }, { scale: 1, opacity: 1, ease: "none" }, 0)
        .fromTo(".film-cap-inner", { y: 26, opacity: 0 }, { y: 0, opacity: 1, ease: "none" }, 0)
        .to(".film-hero", { yPercent: -4, ease: "none" }, 0);

      // Chapter captions: pin + crossfade each beat
      gsap.utils.toArray<HTMLElement>(".chapter").forEach((ch) => {
        gsap.fromTo(
          ch,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ch,
              start: "top 78%",
              end: "top 38%",
              scrub: 0.5,
            },
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
      <section className="film" aria-label="Product film">
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
              <p className="kicker">Areca · Autonomous Coconut Harvesting</p>
              <h1 className="font-display tracking-tightest">
                The farm that <span className="lede-accent">harvests itself.</span>
              </h1>
              <p className="film-sub">
                Drone intelligence, a living Digital Twin, and a tree-climbing robot —
                one precision-agriculture operating system.
              </p>
              <div className="film-cta">
                <Link href="/dashboard" className="btn btn-primary">Enter Mission Control</Link>
                <Link href="#story" className="btn btn-ghost">See the system</Link>
              </div>
            </div>
          </div>

          <div className="scroll-cue" aria-hidden="true">Scroll</div>
        </div>
      </section>

      {/* ══════════ CHAPTER BEATS ══════════ */}
      <section className="beats" aria-label="How it works">
        {CHAPTERS.map((c, i) => (
          <div className="chapter" key={i} data-reveal>
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
        <p className="kicker">The belief</p>
        <h2 className="font-display tracking-tightest">
          Precision agriculture should be <span className="lede-accent">autonomous, observable, and accountable.</span>
        </h2>
        <p className="manifesto-sub">
          Areca turns a dangerous, manual craft into a measured, repeatable system —
          without losing the intelligence of the people who know the land.
        </p>
      </section>

      {/* ══════════ CAPABILITY GRID ══════════ */}
      <section className="caps" aria-label="Capabilities">
        <div className="caps-head" data-reveal>
          <p className="kicker">One platform</p>
          <h2 className="font-display tracking-tightest">Every layer of the harvest, engineered.</h2>
        </div>
        <div className="caps-grid">
          {[
            { t: "Drone Survey", d: "Autonomous flight planning and tile capture across the whole plantation." },
            { t: "Tree Intelligence", d: "Permanent Tree IDs from GPS + computer-vision matching across surveys." },
            { t: "Digital Twin", d: "A seamless mosaic of the farm with live YOLO detection overlays." },
            { t: "Ripeness AI", d: "Per-coconut maturity classification: mature, potential, premature." },
            { t: "Harvest Planning", d: "Frozen, nearest-neighbour missions built from the latest inventory." },
            { t: "Robot Execution", d: "A climbing harvester navigates, ascends, and harvests autonomously." },
            { t: "Mission Control", d: "Live state, battery, and position streamed over a real-time channel." },
            { t: "Analytics", d: "Every run scored on yield, battery economy, and efficiency." },
          ].map((c) => (
            <div className="cap panel-2" key={c.t} data-reveal>
              <h3 className="cap-t">{c.t}</h3>
              <p className="cap-d">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ CLOSING CTA ══════════ */}
      <section className="closer" data-reveal>
        <h2 className="font-display tracking-tightest">
          Open the <span className="lede-accent">Control Center.</span>
        </h2>
        <p className="closer-sub">Survey a plantation, watch the twin build, and send the robot to work.</p>
        <div className="closer-cta">
          <Link href="/survey" className="btn btn-primary">Start a Survey</Link>
          <Link href="/map" className="btn btn-ghost">View the Digital Twin</Link>
        </div>
      </section>

      <footer className="land-foot">
        <div className="land-foot-in">
          <span className="land-foot-mark font-display">ARECA</span>
          <span className="land-foot-tag">Autonomous Coconut Harvesting Platform · Control Build v3.8</span>
        </div>
        <div className="land-foot-links">
          <Link href="/dashboard">Mission Control</Link>
          <Link href="/survey">Survey</Link>
          <Link href="/map">Digital Twin</Link>
          <Link href="/robot">Robot Ops</Link>
          <Link href="/robot/history">History</Link>
        </div>
        <p className="land-foot-fine">A precision-agriculture concept. All system imagery procedurally generated.</p>
      </footer>

      <style jsx>{`
        .film {
          height: 320vh;
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
            radial-gradient(60% 55% at 50% 50%, transparent 20%, rgba(14, 18, 13, 0.55) 100%),
            linear-gradient(180deg, rgba(14, 18, 13, 0.5) 0%, transparent 30%, rgba(14, 18, 13, 0.72) 100%);
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
          color: rgba(220, 230, 210, 0.82);
        }
        .film-cap h1 {
          color: #f6f8f2;
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
          color: rgba(226, 234, 218, 0.9);
          font-size: clamp(15px, 1.5vw, 19px);
          line-height: 1.6;
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
          padding: 12vh 7vw;
          max-width: 1100px;
          margin: 0 auto;
        }
        .chapter {
          min-height: 78vh;
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
          text-align: center;
          padding: 16vh 7vw;
        }
        .closer h2 {
          font-size: clamp(34px, 5.5vw, 80px);
          font-weight: 700;
          line-height: 1.02;
        }
        .closer-sub {
          margin: 22px auto 34px;
          color: var(--color-text-dim);
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
          .film { height: 240vh; }
          .beats { padding: 7vh 22px; }
          .stats { padding: 5vh 22px 3vh; }
          .manifesto { padding: 9vh 22px; }
          .caps { padding: 5vh 22px 7vh; }
          .closer { padding: 9vh 22px; }
          .land-foot { padding: 6vh 22px 5vh; }
          .cap { padding: 20px 18px; }
          .chapter { min-height: 64vh; }
          .chapter h2 { font-size: clamp(28px, 8vw, 44px); }
        }
      `}</style>
    </div>
  );
}
