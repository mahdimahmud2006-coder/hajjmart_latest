"use client";

import { AdminSelect } from "@/components/admin/admin-ui";
import { useAdminLanguage } from "@/context/admin-language-context";

export type ReportRangePreset = "today" | "7" | "30" | "month" | "custom";

export function isoDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function resolveReportRange(preset: ReportRangePreset, customFrom: string, customTo: string) {
  const end = customTo ? new Date(`${customTo}T12:00:00`) : new Date();
  let start = customFrom ? new Date(`${customFrom}T12:00:00`) : new Date(end);
  if (preset === "today") start = new Date(end);
  if (preset === "7") start.setDate(end.getDate() - 6);
  if (preset === "30") start.setDate(end.getDate() - 29);
  if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1, 12);
  return { from: isoDate(start), to: isoDate(end) };
}

export function ReportFilters({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  preset: ReportRangePreset;
  onPresetChange: (value: ReportRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}) {
  const { t } = useAdminLanguage();
  return <div className="admin-report-filters">
    <AdminSelect value={preset} onChange={(value) => onPresetChange(value as ReportRangePreset)} label={t("reports.period")}>
      <option value="today">{t("reports.periodToday")}</option>
      <option value="7">{t("reports.period7")}</option>
      <option value="30">{t("reports.period30")}</option>
      <option value="month">{t("reports.periodMonth")}</option>
      <option value="custom">{t("reports.periodCustom")}</option>
    </AdminSelect>
    {preset === "custom" && <>
      <label className="admin-date-control"><span>{t("reports.from")}</span><input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => onCustomFromChange(event.target.value)}/></label>
      <label className="admin-date-control"><span>{t("reports.to")}</span><input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => onCustomToChange(event.target.value)}/></label>
    </>}
  </div>;
}
