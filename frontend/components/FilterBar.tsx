"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Building2, Layers } from "lucide-react";

interface FilterBarProps {
  companies: string[];
  currentCompany: string;
  currentType: string;
  currentSearch: string;
}

const QUESTION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "DSA", label: "DSA" },
  { value: "SYSTEM_DESIGN", label: "System Design" },
  { value: "BEHAVIORAL", label: "Behavioral" },
];

export function FilterBar({
  companies,
  currentCompany,
  currentType,
  currentSearch,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // Reset page on filter change
      router.push(`/recent-questions?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id="search-input"
          placeholder="Search questions…"
          defaultValue={currentSearch}
          className="pl-9 bg-card/50 border-border/60 focus:border-primary/50 transition-colors"
          onChange={(e) => {
            const val = e.target.value;
            const timeout = setTimeout(() => updateParam("search", val), 400);
            return () => clearTimeout(timeout);
          }}
        />
      </div>

      {/* Company Filter */}
      <div className="relative">
        <Select
          value={currentCompany || "all"}
          onValueChange={(val) => updateParam("company", val)}
        >
          <SelectTrigger
            id="company-filter"
            className="w-full sm:w-48 bg-card/50 border-border/60 gap-2"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type Filter */}
      <div className="relative">
        <Select
          value={currentType || "all"}
          onValueChange={(val) => updateParam("type", val)}
        >
          <SelectTrigger
            id="type-filter"
            className="w-full sm:w-44 bg-card/50 border-border/60 gap-2"
          >
            <Layers className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
