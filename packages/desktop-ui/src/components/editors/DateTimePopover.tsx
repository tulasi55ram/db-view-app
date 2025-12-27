import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  setHours,
  setMinutes,
  setSeconds,
  getHours,
  getMinutes,
  getSeconds,
  getYear,
  getMonth,
  setYear,
  setMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { Clock, ChevronLeft, ChevronRight, X, Check, RotateCcw, Pencil, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/primitives/Popover";
import { cn } from "@/utils/cn";

// Generate year options (100 years back and 50 years forward)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 151 }, (_, i) => currentYear - 100 + i);
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface DateTimePopoverProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  columnName: string;
  columnType: string; // e.g., "timestamp", "date", "time", "timestamptz"
  anchorRect?: DOMRect | null; // Position to anchor the popover
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateTimePopover({
  open,
  onClose,
  value,
  onChange,
  columnName,
  columnType,
  anchorRect,
}: DateTimePopoverProps) {
  const lowerType = columnType.toLowerCase();
  const isDateOnly = lowerType === "date";
  const isTimeOnly = lowerType.includes("time") && !lowerType.includes("timestamp");
  const hasTimezone = lowerType.includes("tz") || lowerType.includes("timezone");

  // Virtual anchor element for positioning
  const anchorRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  const parseInitialDate = useCallback((): Date => {
    if (!value || value.toUpperCase() === "NULL") {
      return new Date();
    }

    // Try various formats
    const formats = [
      "yyyy-MM-dd'T'HH:mm:ss.SSSX",
      "yyyy-MM-dd'T'HH:mm:ss.SSS",
      "yyyy-MM-dd'T'HH:mm:ssX",
      "yyyy-MM-dd'T'HH:mm:ss",
      "yyyy-MM-dd HH:mm:ss.SSSX",
      "yyyy-MM-dd HH:mm:ss.SSS",
      "yyyy-MM-dd HH:mm:ssX",
      "yyyy-MM-dd HH:mm:ss",
      "yyyy-MM-dd",
      "HH:mm:ss",
      "HH:mm",
    ];

    for (const fmt of formats) {
      try {
        const parsed = parse(value, fmt, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      } catch {
        // Try next format
      }
    }

    // Fallback to native Date parsing
    const nativeParsed = new Date(value);
    if (isValid(nativeParsed)) {
      return nativeParsed;
    }

    return new Date();
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitialDate);
  const [viewMonth, setViewMonth] = useState<Date>(parseInitialDate);
  const [isNull, setIsNull] = useState(value?.toUpperCase() === "NULL");

  // Time state
  const [hours, setHoursState] = useState(getHours(parseInitialDate()));
  const [minutes, setMinutesState] = useState(getMinutes(parseInitialDate()));
  const [seconds, setSecondsState] = useState(getSeconds(parseInitialDate()));

  // Direct text input mode
  const [isTextMode, setIsTextMode] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Reset state when value changes
  useEffect(() => {
    if (open) {
      const initialDate = parseInitialDate();
      setSelectedDate(initialDate);
      setViewMonth(initialDate);
      setIsNull(value?.toUpperCase() === "NULL");
      setHoursState(getHours(initialDate));
      setMinutesState(getMinutes(initialDate));
      setSecondsState(getSeconds(initialDate));
      setIsTextMode(false);
      setTextValue(value || "");
      setTextError(null);
    }
  }, [open, value, parseInitialDate]);

  // Focus text input when text mode is enabled
  useEffect(() => {
    if (isTextMode && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isTextMode]);

  // Handle year change from dropdown
  const handleYearChange = useCallback((year: number) => {
    setViewMonth((prev) => setYear(prev, year));
    setSelectedDate((prev) => setYear(prev, year));
  }, []);

  // Handle month change from dropdown
  const handleMonthChange = useCallback((month: number) => {
    setViewMonth((prev) => setMonth(prev, month));
    setSelectedDate((prev) => setMonth(prev, month));
  }, []);

  // Switch back to calendar mode and sync values from text
  const switchToCalendarMode = useCallback(() => {
    if (textValue && textValue.toUpperCase() !== "NULL") {
      const parsed = parseTextInput(textValue);
      if (parsed) {
        setSelectedDate(parsed);
        setViewMonth(parsed);
        setHoursState(getHours(parsed));
        setMinutesState(getMinutes(parsed));
        setSecondsState(getSeconds(parsed));
        setTextError(null);
      }
    }
    setIsTextMode(false);
  }, [textValue]);

  // Parse text input into Date
  const parseTextInput = (input: string): Date | null => {
    if (!input || input.toUpperCase() === "NULL") return null;

    const formats = [
      "yyyy-MM-dd'T'HH:mm:ss.SSSX",
      "yyyy-MM-dd'T'HH:mm:ss.SSS",
      "yyyy-MM-dd'T'HH:mm:ssX",
      "yyyy-MM-dd'T'HH:mm:ss",
      "yyyy-MM-dd HH:mm:ss.SSSX",
      "yyyy-MM-dd HH:mm:ss.SSS",
      "yyyy-MM-dd HH:mm:ssX",
      "yyyy-MM-dd HH:mm:ss",
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd/MM/yyyy",
      "HH:mm:ss",
      "HH:mm",
    ];

    for (const fmt of formats) {
      try {
        const parsed = parse(input, fmt, new Date());
        if (isValid(parsed)) return parsed;
      } catch {
        // Try next format
      }
    }

    // Try native Date parsing
    const nativeParsed = new Date(input);
    if (isValid(nativeParsed)) return nativeParsed;

    return null;
  };

  // Handle text input change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTextValue(newValue);

    // Validate as user types
    if (newValue && newValue.toUpperCase() !== "NULL") {
      const parsed = parseTextInput(newValue);
      if (!parsed) {
        setTextError("Invalid date format");
      } else {
        setTextError(null);
        // Update selection to match
        setSelectedDate(parsed);
        setViewMonth(parsed);
        if (!isDateOnly) {
          setHoursState(getHours(parsed));
          setMinutesState(getMinutes(parsed));
          setSecondsState(getSeconds(parsed));
        }
      }
    } else {
      setTextError(null);
    }
  }, [isDateOnly]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [viewMonth]);

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setIsNull(false);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setViewMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleSetNow = useCallback(() => {
    const now = new Date();
    setSelectedDate(now);
    setViewMonth(now);
    setHoursState(getHours(now));
    setMinutesState(getMinutes(now));
    setSecondsState(getSeconds(now));
    setIsNull(false);
  }, []);

  const handleSave = useCallback(() => {
    if (isNull) {
      onChange("NULL");
      onClose();
      return;
    }

    // In text mode, use the text value if it's valid
    if (isTextMode) {
      if (textValue.toUpperCase() === "NULL") {
        onChange("NULL");
        onClose();
        return;
      }

      const parsed = parseTextInput(textValue);
      if (parsed) {
        let formatted: string;
        if (isDateOnly) {
          formatted = format(parsed, "yyyy-MM-dd");
        } else if (isTimeOnly) {
          formatted = format(parsed, "HH:mm:ss");
        } else if (hasTimezone) {
          formatted = format(parsed, "yyyy-MM-dd'T'HH:mm:ssxxx");
        } else {
          formatted = format(parsed, "yyyy-MM-dd'T'HH:mm:ss");
        }
        onChange(formatted);
        onClose();
        return;
      } else if (textError) {
        // Don't save if there's an error
        return;
      }
    }

    let finalDate = selectedDate;
    if (!isDateOnly) {
      finalDate = setHours(finalDate, hours);
      finalDate = setMinutes(finalDate, minutes);
      finalDate = setSeconds(finalDate, seconds);
    }

    let formatted: string;
    if (isDateOnly) {
      formatted = format(finalDate, "yyyy-MM-dd");
    } else if (isTimeOnly) {
      formatted = format(finalDate, "HH:mm:ss");
    } else if (hasTimezone) {
      formatted = format(finalDate, "yyyy-MM-dd'T'HH:mm:ssxxx");
    } else {
      formatted = format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
    }

    onChange(formatted);
    onClose();
  }, [isNull, isTextMode, textValue, textError, selectedDate, hours, minutes, seconds, isDateOnly, isTimeOnly, hasTimezone, onChange, onClose]);

  const today = new Date();

  // Format preview value
  const getPreviewValue = () => {
    if (isNull) return "NULL";

    let finalDate = selectedDate;
    if (!isDateOnly) {
      finalDate = setHours(finalDate, hours);
      finalDate = setMinutes(finalDate, minutes);
      finalDate = setSeconds(finalDate, seconds);
    }

    if (isDateOnly) {
      return format(finalDate, "yyyy-MM-dd");
    } else if (isTimeOnly) {
      return format(finalDate, "HH:mm:ss");
    } else if (hasTimezone) {
      return format(finalDate, "yyyy-MM-dd'T'HH:mm:ssxxx");
    } else {
      return format(finalDate, "yyyy-MM-dd'T'HH:mm:ss");
    }
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {/* Virtual anchor positioned at the cell location */}
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          style={{
            position: "fixed",
            left: anchorRect ? anchorRect.left + anchorRect.width / 2 : "50%",
            top: anchorRect ? anchorRect.bottom : "50%",
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-[320px] p-0"
        side={anchorRect ? "bottom" : "bottom"}
        align="center"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary rounded-t-lg">
          <div>
            <div className="text-sm font-medium text-text-primary">{columnName}</div>
            <div className="text-xs text-text-tertiary">{columnType}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* NULL Toggle */}
          <div className="flex items-center justify-between p-2 bg-bg-tertiary rounded border border-border">
            <span className="text-xs text-text-primary">Set as NULL</span>
            <button
              onClick={() => setIsNull(!isNull)}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                isNull ? "bg-accent" : "bg-bg-hover border border-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                  isNull ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {!isNull && (
            <>
              {/* Mode Toggle */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Input mode:</span>
                <div className="flex items-center gap-1 bg-bg-tertiary rounded p-0.5 border border-border">
                  <button
                    onClick={switchToCalendarMode}
                    className={cn(
                      "p-1.5 rounded text-xs flex items-center gap-1 transition-colors",
                      !isTextMode ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
                    )}
                    title="Calendar picker"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTextValue(getPreviewValue());
                      setIsTextMode(true);
                    }}
                    className={cn(
                      "p-1.5 rounded text-xs flex items-center gap-1 transition-colors",
                      isTextMode ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
                    )}
                    title="Type manually"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Input Mode */}
              {isTextMode && (
                <div className="space-y-2">
                  <div>
                    <input
                      ref={textInputRef}
                      type="text"
                      value={textValue}
                      onChange={handleTextChange}
                      placeholder={isDateOnly ? "yyyy-MM-dd" : isTimeOnly ? "HH:mm:ss" : "yyyy-MM-dd HH:mm:ss"}
                      className={cn(
                        "w-full px-3 py-2 bg-bg-primary border rounded text-sm font-mono text-text-primary",
                        "placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent",
                        textError ? "border-error" : "border-border"
                      )}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSave();
                        }
                      }}
                    />
                    {textError && (
                      <p className="mt-1 text-xs text-error">{textError}</p>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    <p>Supported formats:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {!isTimeOnly && <li>yyyy-MM-dd (e.g., 2024-12-25)</li>}
                      {!isTimeOnly && !isDateOnly && <li>yyyy-MM-dd HH:mm:ss</li>}
                      {!isDateOnly && <li>HH:mm:ss (e.g., 14:30:00)</li>}
                    </ul>
                  </div>
                </div>
              )}

              {/* Calendar (for date types) */}
              {!isTimeOnly && !isTextMode && (
                <div className="bg-bg-tertiary rounded border border-border p-2">
                  {/* Month/Year Selectors */}
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded hover:bg-bg-hover transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Month Dropdown */}
                      <select
                        value={getMonth(viewMonth)}
                        onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                        className="px-1.5 py-0.5 text-xs font-medium bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={month} value={idx}>{month}</option>
                        ))}
                      </select>

                      {/* Year Dropdown */}
                      <select
                        value={getYear(viewMonth)}
                        onChange={(e) => handleYearChange(parseInt(e.target.value))}
                        className="px-1.5 py-0.5 text-xs font-medium bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                      >
                        {YEARS.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded hover:bg-bg-hover transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAYS.map((day) => (
                      <div
                        key={day}
                        className="h-6 flex items-center justify-center text-[10px] font-medium text-text-tertiary"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, viewMonth);
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, today);

                      return (
                        <button
                          key={idx}
                          onClick={() => handleDayClick(day)}
                          className={cn(
                            "h-7 w-7 rounded text-[11px] font-medium transition-all",
                            "flex items-center justify-center",
                            !isCurrentMonth && "text-text-tertiary opacity-40",
                            isCurrentMonth && !isSelected && "text-text-primary hover:bg-bg-hover",
                            isSelected && "bg-accent text-white",
                            isToday && !isSelected && "ring-1 ring-accent ring-inset"
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time Picker (for time types) */}
              {!isDateOnly && !isTextMode && (
                <div className="bg-bg-tertiary rounded border border-border p-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-text-secondary" />
                    <span className="text-xs font-medium text-text-primary">Time</span>
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    {/* Hours */}
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-text-tertiary mb-0.5">HH</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={hours.toString().padStart(2, "0")}
                        onChange={(e) => setHoursState(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-10 h-8 text-center text-sm font-mono bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    <span className="text-lg text-text-tertiary font-mono mt-4">:</span>

                    {/* Minutes */}
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-text-tertiary mb-0.5">MM</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={minutes.toString().padStart(2, "0")}
                        onChange={(e) => setMinutesState(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-10 h-8 text-center text-sm font-mono bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    <span className="text-lg text-text-tertiary font-mono mt-4">:</span>

                    {/* Seconds */}
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-text-tertiary mb-0.5">SS</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={seconds.toString().padStart(2, "0")}
                        onChange={(e) => setSecondsState(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-10 h-8 text-center text-sm font-mono bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Quick Time Presets */}
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {["00:00:00", "12:00:00", "23:59:59"].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          const [h, m, s] = preset.split(":").map(Number);
                          setHoursState(h);
                          setMinutesState(m);
                          setSecondsState(s);
                        }}
                        className="px-2 py-1 text-[10px] bg-bg-primary hover:bg-bg-hover border border-border rounded transition-colors text-text-secondary"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview (only in calendar mode) */}
              {!isTextMode && (
                <div className="font-mono text-xs text-accent bg-bg-primary px-2 py-1.5 rounded border border-border text-center">
                  {getPreviewValue()}
                </div>
              )}
            </>
          )}

          {isNull && (
            <div className="flex items-center justify-center py-4 text-text-tertiary">
              <span className="text-xs italic">Value will be set to NULL</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-bg-tertiary rounded-b-lg">
          <button
            onClick={handleSetNow}
            className="px-2 py-1 rounded bg-bg-primary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1 border border-border"
          >
            <RotateCcw className="w-3 h-3" />
            Now
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-2 py-1 rounded bg-bg-primary hover:bg-bg-hover text-text-primary text-xs transition-colors flex items-center gap-1 border border-border"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-2 py-1 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
