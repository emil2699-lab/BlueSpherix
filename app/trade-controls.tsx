"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DEMO_TRADES } from "./demo-data";
const latestTradeDate = DEMO_TRADES[0].openedAt.slice(0, 10);

export function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusOption = (index: number) => requestAnimationFrame(() => {
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('.filter-select-menu [role="option"]');
    buttons?.[Math.max(0, Math.min(index, buttons.length - 1))]?.focus();
  });
  const openWithKeyboard = (index: number) => {
    setOpen(true);
    focusOption(index);
  };
  const handleOptionKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>(".filter-select-control")?.focus();
      return;
    }
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? Math.min(options.length - 1, index + 1) : Math.max(0, index - 1);
    focusOption(nextIndex);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`filter-field filter-select ${open ? "open" : ""}`} ref={rootRef}>
    <span>{label}</span>
    <button className="filter-select-control" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openWithKeyboard(event.key === "ArrowDown" ? Math.max(0, options.indexOf(value)) : options.length - 1); } }}><span>{value}</span><ChevronDown size={13} /></button>
    {open && <div className="filter-select-menu" role="listbox" aria-label={label}>
      {options.map((option, index) => <button type="button" role="option" aria-selected={value === option} key={option} onKeyDown={(event) => handleOptionKey(event, index)} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{value === option && <Check size={12} />}</button>)}
    </div>}
  </div>;
}

const dateToIso = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const dateFromIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export function DateFilterPicker({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = dateFromIso(value || latestTradeDate);
    return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const year = viewMonth.getUTCFullYear();
  const month = viewMonth.getUTCMonth();
  const firstWeekday = (viewMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const visibleValue = value ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(dateFromIso(value)).replace(".", "") : "Seleziona data";
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(viewMonth);
  const moveMonth = (amount: number) => setViewMonth(new Date(Date.UTC(year, month + amount, 1)));
  const focusCalendarDay = (preferredIndex?: number) => requestAnimationFrame(() => {
    const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>(".date-days button") ?? [])];
    const enabled = buttons.filter((button) => !button.disabled);
    if (!enabled.length) return;
    const selected = buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
    const target = preferredIndex ?? (selected >= 0 ? selected : buttons.indexOf(enabled[0]));
    const available = buttons.map((button, index) => ({ button, index })).filter(item => !item.button.disabled);
    available.reduce((closest, item) => Math.abs(item.index - target) < Math.abs(closest.index - target) ? item : closest).button.focus();
  });
  const handleDayKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>(".date-days button") ?? [])];
    const index = buttons.indexOf(event.currentTarget);
    const movement = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (movement !== undefined || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusCalendarDay(event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (movement ?? 0))));
    }
  };
  const toggleCalendar = () => {
    if (!open) {
      const anchor = dateFromIso(value || latestTradeDate);
      setViewMonth(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)));
    }
    setOpen((current) => !current);
  };
  const chooseDay = (day: number) => {
    onChange(dateToIso(new Date(Date.UTC(year, month, day))));
    setOpen(false);
  };

  return <div className={`filter-field date-picker ${open ? "open" : ""}`} ref={rootRef}>
    <span><CalendarDays size={11} /> {label}</span>
    <button className="date-picker-control" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggleCalendar} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); if (!open) toggleCalendar(); focusCalendarDay(); } }}><span className={value ? "" : "placeholder"}>{visibleValue}</span><CalendarDays size={13} /></button>
    {open && <div className="date-picker-menu" role="dialog" aria-label={`Calendario ${label}`}>
      <div className="date-picker-head"><button type="button" aria-label="Mese precedente" onClick={() => moveMonth(-1)}><ChevronLeft size={14} /></button><strong>{monthLabel}</strong><button type="button" aria-label="Mese successivo" onClick={() => moveMonth(1)}><ChevronRight size={14} /></button></div>
      <div className="date-weekdays" aria-hidden="true">{["L", "M", "M", "G", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="date-days">
        {calendarCells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const iso = dateToIso(new Date(Date.UTC(year, month, day)));
          const disabled = Boolean((min && iso < min) || (max && iso > max));
          return <button type="button" key={iso} disabled={disabled} aria-pressed={value === iso} onKeyDown={handleDayKey} onClick={() => chooseDay(day)}>{day}</button>;
        })}
      </div>
      <div className="date-picker-foot"><button type="button" disabled={!value} onClick={() => { onChange(""); setOpen(false); }}>Rimuovi data</button></div>
    </div>}
  </div>;
}

