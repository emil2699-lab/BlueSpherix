"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type Group = { id: string; name: string };

export default function PortfolioGroupPicker({ value, groups, onChange }: {
  value: string;
  groups: readonly Group[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ query: "", time: 0 });
  const options = [{ id: "", name: "Tutti i gruppi" }, ...groups];
  const visibleValue = options.find(option => option.id === value)?.name ?? options[0].name;

  useEffect(() => {
    if (!open) return;
    search.current = { query: "", time: 0 };
    menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function close() {
    trigger.current?.focus();
    setOpen(false);
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const current = buttons.findIndex(button => button === document.activeElement);
    if (event.key === "Escape" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      close();
      return;
    }
    const target = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      buttons[Math.max(0, Math.min(buttons.length - 1, target))]?.focus();
    } else if (event.key.length === 1 && event.key !== " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = performance.now();
      const char = event.key.toLocaleLowerCase("it");
      const prefix = now - search.current.time < 650 ? search.current.query : "";
      const query = prefix && [...prefix].every(letter => letter === char) ? char : prefix + char;
      search.current = { query, time: now };
      const ordered = [...buttons.slice(current + 1), ...buttons.slice(0, current + 1)];
      const match = ordered.find(button => button.textContent?.trim().toLocaleLowerCase("it").startsWith(query));
      if (match) { event.preventDefault(); match.focus(); }
    }
  }

  return <div className="portfolio-group-picker" ref={root} data-open={open} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span id={`${id}-label`}>Gruppo di conti</span>
    <button ref={trigger} type="button" className="portfolio-group-trigger" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined} aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => setOpen(current => !current)} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
        if (open && event.key === "Escape") close();
      }}>
      <span id={`${id}-value`}>{visibleValue}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className="portfolio-group-menu" ref={menu} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} onKeyDown={moveFocus}>
      {options.map(option => <button key={option.id} type="button" role="option" tabIndex={-1} aria-selected={value === option.id} onClick={() => {
        onChange(option.id);
        close();
      }}><span>{option.name}</span>{value === option.id && <Check size={15} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
