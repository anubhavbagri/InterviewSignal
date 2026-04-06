"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
  companies: string[];
  selected: string;
  onSelect: (company: string) => void;
}

export function CompanySelector({ companies, selected, onSelect }: CompanySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = companies.filter((c) => c.toLowerCase().includes(search.toLowerCase()));

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (company: string) => {
    onSelect(company);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-64">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl",
          "bg-card border border-border/60 text-sm font-medium",
          "hover:border-primary/50 transition-colors text-left",
          open && "border-primary/60 ring-2 ring-primary/20"
        )}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected || "Select Company"}
        </span>
        <div className="flex items-center gap-1">
          {selected && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border/40">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No company found
              </div>
            ) : (
              filtered.map((company) => (
                <button
                  key={company}
                  onClick={() => handleSelect(company)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm",
                    "hover:bg-primary/10 transition-colors text-left",
                    selected === company && "bg-primary/10 text-primary"
                  )}
                >
                  <span>{company}</span>
                  {selected === company && <Check className="h-3.5 w-3.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
