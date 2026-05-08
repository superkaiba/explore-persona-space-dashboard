"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

function timeOfDay(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Greeting() {
  const { preset } = useTheme();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="invisible">.</span>;

  const day = WEEKDAYS[now.getDay()];
  const tod = timeOfDay(now);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  if (preset === "editorial") {
    return (
      <p className="serif mt-2 text-[18px] italic text-muted">
        {day} {tod.toLowerCase()} <span className="text-faint">— {time}</span>
      </p>
    );
  }

  if (preset === "terminal") {
    return (
      <p className="mt-2 font-mono text-[12px] text-muted">
        <span className="text-accent">$</span> session start{" "}
        <span className="text-fg">{day.toLowerCase()}</span>{" "}
        <span className="text-faint">@ {time}</span>
      </p>
    );
  }

  if (preset === "brutalist") {
    return (
      <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.2em] text-fg">
        {day} / {tod} / {time}
      </p>
    );
  }

  if (preset === "vaporwave") {
    return (
      <p className="serif mt-3 text-[14px] italic tracking-[0.4em] text-fg/80">
        ▼ {day.toUpperCase()} · {time} · A.D. {now.getFullYear()}
      </p>
    );
  }

  if (preset === "glitch") {
    return (
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg/70">
        <span style={{ color: "rgb(255 0 128)" }}>[link_established]</span>{" "}
        <span style={{ color: "rgb(0 255 200)" }}>node://{day.toLowerCase()}</span>{" "}
        <span className="text-faint">{`@ ${time}`}</span>
      </p>
    );
  }

  if (preset === "sumie") {
    return (
      <div className="serif mt-3 text-[15px] italic leading-tight text-muted">
        <p>{day}, {tod.toLowerCase()}.</p>
        <p>The hour is {time}.</p>
        <p className="text-faint">— quiet work ahead</p>
      </div>
    );
  }

  if (preset === "mission") {
    return (
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">[T+ {time}]</span>{" "}
        <span className="text-fg-soft">SHIFT_{day.slice(0, 3).toUpperCase()}</span>{" "}
        <span className="text-faint">{"// nominal"}</span>
      </p>
    );
  }

  if (preset === "noir") {
    return (
      <p className="mt-2 font-mono text-[11px] tracking-[0.04em] text-muted">
        {time}
      </p>
    );
  }

  if (preset === "newsprint") {
    const date = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return (
      <p className="serif mt-3 text-[14px] italic text-fg">
        {date} <span className="text-muted">— {time} hours, by the dashboard&apos;s reckoning.</span>
      </p>
    );
  }

  // Aurora
  return (
    <p className="mt-2 text-[13px] text-muted">
      <span className="live-dot mr-2 align-middle" /> {day} {tod.toLowerCase()},{" "}
      <span className="font-mono text-faint">{time}</span>
    </p>
  );
}
