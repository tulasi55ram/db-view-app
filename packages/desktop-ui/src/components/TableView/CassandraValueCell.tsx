import { useState, useCallback, memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  List,
  Hash,
  Clock,
  Binary,
  Braces,
  Copy,
  Calendar,
  Timer,
  Globe,
  Key,
  Database,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

interface CassandraValueCellProps {
  value: unknown;
  columnName: string;
  columnType: string;
  isCompact?: boolean;
}

/**
 * CassandraValueCell - Rich rendering for Cassandra data types
 *
 * Handles:
 * - Collections: list, set, map with expandable views
 * - UDTs (User-Defined Types) with structured display
 * - UUID/TimeUUID with timestamp extraction
 * - Binary/Blob with hex preview
 * - Counter columns
 * - Inet addresses
 * - Duration with human-readable format
 * - Frozen type indicators
 */
export const CassandraValueCell = memo(function CassandraValueCell({
  value,
  columnName: _columnName,
  columnType,
  isCompact = true,
}: CassandraValueCellProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse the column type to understand the structure
  const typeInfo = parseColumnType(columnType);

  // Handle null values
  if (value === null || value === undefined) {
    return <span className="text-text-tertiary italic">NULL</span>;
  }

  // Render based on detected type
  switch (typeInfo.baseType) {
    case "list":
    case "set":
      return (
        <CollectionValue
          value={value}
          typeInfo={typeInfo}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          isCompact={isCompact}
        />
      );

    case "map":
      return (
        <MapValue
          value={value}
          typeInfo={typeInfo}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          isCompact={isCompact}
        />
      );

    case "udt":
      return (
        <UDTValue
          value={value}
          typeInfo={typeInfo}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          isCompact={isCompact}
        />
      );

    case "uuid":
    case "timeuuid":
      return <UUIDValue value={value} isTimeUUID={typeInfo.baseType === "timeuuid"} />;

    case "blob":
      return <BlobValue value={value} />;

    case "inet":
      return <InetValue value={value} />;

    case "duration":
      return <DurationValue value={value} />;

    case "counter":
      return <CounterValue value={value} />;

    case "timestamp":
    case "date":
    case "time":
      return <TemporalValue value={value} typeInfo={typeInfo} />;

    case "decimal":
    case "varint":
    case "bigint":
      return <NumericValue value={value} typeInfo={typeInfo} />;

    case "boolean":
      return <BooleanValue value={value} />;

    default:
      // For simple types, just render as text
      return <SimpleValue value={value} />;
  }
});

// ============================================
// Type Parser
// ============================================

interface TypeInfo {
  baseType: string;
  elementType?: string;
  keyType?: string;
  valueType?: string;
  isFrozen: boolean;
  udtName?: string;
  fields?: Array<{ name: string; type: string }>;
}

function parseColumnType(columnType: string): TypeInfo {
  const type = columnType.toLowerCase().trim();
  const isFrozen = type.includes("frozen");

  // Remove "frozen<" and trailing ">" for parsing
  let cleanType = type.replace(/frozen\s*<\s*/g, "").replace(/\s*>\s*$/g, "").trim();
  if (cleanType.endsWith("(frozen)")) {
    cleanType = cleanType.replace(/\s*\(frozen\)\s*$/, "").trim();
  }

  // List type: list<element_type>
  const listMatch = cleanType.match(/^list\s*<\s*(.+)\s*>$/);
  if (listMatch) {
    return { baseType: "list", elementType: listMatch[1], isFrozen };
  }

  // Set type: set<element_type>
  const setMatch = cleanType.match(/^set\s*<\s*(.+)\s*>$/);
  if (setMatch) {
    return { baseType: "set", elementType: setMatch[1], isFrozen };
  }

  // Map type: map<key_type, value_type>
  const mapMatch = cleanType.match(/^map\s*<\s*(.+?)\s*,\s*(.+)\s*>$/);
  if (mapMatch) {
    return { baseType: "map", keyType: mapMatch[1], valueType: mapMatch[2], isFrozen };
  }

  // Simple types
  if (cleanType === "uuid") return { baseType: "uuid", isFrozen };
  if (cleanType === "timeuuid") return { baseType: "timeuuid", isFrozen };
  if (cleanType === "blob") return { baseType: "blob", isFrozen };
  if (cleanType === "inet") return { baseType: "inet", isFrozen };
  if (cleanType === "duration") return { baseType: "duration", isFrozen };
  if (cleanType === "counter") return { baseType: "counter", isFrozen };
  if (cleanType === "timestamp") return { baseType: "timestamp", isFrozen };
  if (cleanType === "date") return { baseType: "date", isFrozen };
  if (cleanType === "time") return { baseType: "time", isFrozen };
  if (cleanType === "decimal" || cleanType === "varint") return { baseType: cleanType, isFrozen };
  if (cleanType === "bigint") return { baseType: "bigint", isFrozen };
  if (cleanType === "boolean") return { baseType: "boolean", isFrozen };
  if (cleanType.includes("int")) return { baseType: "int", isFrozen };
  if (cleanType === "float" || cleanType === "double") return { baseType: "float", isFrozen };

  // UDT (anything else that doesn't match standard types)
  // UDTs are identified by their custom names
  if (!["text", "varchar", "ascii", "int", "bigint", "smallint", "tinyint", "float", "double", "boolean"].includes(cleanType)) {
    // Check if it looks like a UDT (parsed JSON object)
    return { baseType: "udt", udtName: cleanType, isFrozen };
  }

  return { baseType: "text", isFrozen };
}

// ============================================
// Collection Value Renderer (List/Set)
// ============================================

interface CollectionValueProps {
  value: unknown;
  typeInfo: TypeInfo;
  isExpanded: boolean;
  onToggle: () => void;
  isCompact: boolean;
}

function CollectionValue({ value, typeInfo, isExpanded, onToggle, isCompact }: CollectionValueProps) {
  const items = Array.isArray(value) ? value : [];
  const isSet = typeInfo.baseType === "set";
  const Icon = isSet ? Hash : List;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    toast.success("Collection copied to clipboard");
  }, [items]);

  if (isCompact && !isExpanded) {
    return (
      <div className="flex items-center gap-1.5 group">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 transition-colors"
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="font-medium">
            {isSet ? "set" : "list"}[{items.length}]
          </span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
          title="Copy collection"
        >
          <Copy className="w-3 h-3 text-text-tertiary" />
        </button>
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10">frozen</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 transition-colors"
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">
          {isSet ? "set" : "list"}[{items.length}]
        </span>
        <ChevronDown className="w-3 h-3" />
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10 ml-1">frozen</span>
        )}
      </button>
      <div className="pl-3 border-l-2 border-purple-500/30 space-y-0.5 max-h-40 overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs py-0.5">
            <span className="text-text-tertiary w-4 text-right">{idx}:</span>
            <span className="text-text-primary truncate">
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <span className="text-text-tertiary italic text-xs">empty</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Map Value Renderer
// ============================================

interface MapValueProps {
  value: unknown;
  typeInfo: TypeInfo;
  isExpanded: boolean;
  onToggle: () => void;
  isCompact: boolean;
}

function MapValue({ value, typeInfo, isExpanded, onToggle, isCompact }: MapValueProps) {
  // Parse the map value - could be object or Map
  let entries: Array<[string, unknown]> = [];
  if (value instanceof Map) {
    entries = Array.from(value.entries()).map(([k, v]) => [String(k), v]);
  } else if (typeof value === "object" && value !== null) {
    entries = Object.entries(value);
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null) {
        entries = Object.entries(parsed);
      }
    } catch {
      // Not valid JSON
    }
  }

  const handleCopy = useCallback(() => {
    const obj = Object.fromEntries(entries);
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast.success("Map copied to clipboard");
  }, [entries]);

  if (isCompact && !isExpanded) {
    return (
      <div className="flex items-center gap-1.5 group">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 transition-colors"
        >
          <Braces className="w-3.5 h-3.5" />
          <span className="font-medium">map[{entries.length}]</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
          title="Copy map"
        >
          <Copy className="w-3 h-3 text-text-tertiary" />
        </button>
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10">frozen</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 transition-colors"
      >
        <Braces className="w-3.5 h-3.5" />
        <span className="font-medium">map[{entries.length}]</span>
        <ChevronDown className="w-3 h-3" />
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10 ml-1">frozen</span>
        )}
      </button>
      <div className="pl-3 border-l-2 border-orange-500/30 space-y-0.5 max-h-40 overflow-y-auto">
        {entries.map(([key, val], idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs py-0.5">
            <span className="text-cyan-400 font-medium truncate max-w-[80px]">{key}:</span>
            <span className="text-text-primary truncate">
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <span className="text-text-tertiary italic text-xs">empty</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// UDT Value Renderer
// ============================================

interface UDTValueProps {
  value: unknown;
  typeInfo: TypeInfo;
  isExpanded: boolean;
  onToggle: () => void;
  isCompact: boolean;
}

function UDTValue({ value, typeInfo, isExpanded, onToggle, isCompact }: UDTValueProps) {
  // Parse UDT - usually comes as JSON string or object
  let fields: Array<[string, unknown]> = [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null) {
        fields = Object.entries(parsed);
      }
    } catch {
      // Not valid JSON, show as is
      return <SimpleValue value={value} />;
    }
  } else if (typeof value === "object" && value !== null) {
    fields = Object.entries(value);
  }

  const handleCopy = useCallback(() => {
    const obj = Object.fromEntries(fields);
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast.success("UDT copied to clipboard");
  }, [fields]);

  if (isCompact && !isExpanded) {
    return (
      <div className="flex items-center gap-1.5 group">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="font-medium">
            {typeInfo.udtName || "udt"}
          </span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
          title="Copy UDT"
        >
          <Copy className="w-3 h-3 text-text-tertiary" />
        </button>
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10">frozen</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors"
      >
        <Database className="w-3.5 h-3.5" />
        <span className="font-medium">{typeInfo.udtName || "udt"}</span>
        <ChevronDown className="w-3 h-3" />
        {typeInfo.isFrozen && (
          <span className="text-[10px] text-blue-400 px-1 py-0.5 rounded bg-blue-500/10 ml-1">frozen</span>
        )}
      </button>
      <div className="pl-3 border-l-2 border-green-500/30 space-y-0.5 max-h-40 overflow-y-auto bg-green-500/5 rounded-r py-1">
        {fields.map(([key, val], idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs py-0.5 px-1">
            <span className="text-green-400 font-medium">{key}:</span>
            <span className="text-text-primary truncate">
              {val === null ? (
                <span className="text-text-tertiary italic">null</span>
              ) : typeof val === "object" ? (
                JSON.stringify(val)
              ) : (
                String(val)
              )}
            </span>
          </div>
        ))}
        {fields.length === 0 && (
          <span className="text-text-tertiary italic text-xs px-1">empty</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// UUID Value Renderer
// ============================================

interface UUIDValueProps {
  value: unknown;
  isTimeUUID: boolean;
}

function UUIDValue({ value, isTimeUUID }: UUIDValueProps) {
  const uuidStr = String(value);

  // Extract timestamp from TimeUUID (version 1 UUID)
  const extractedDate = isTimeUUID ? extractTimeFromUUID(uuidStr) : null;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(uuidStr);
    toast.success("UUID copied to clipboard");
  }, [uuidStr]);

  return (
    <div className="flex items-center gap-1.5 group">
      <Key className="w-3 h-3 text-yellow-500 flex-shrink-0" />
      <span className="font-mono text-xs text-yellow-500/90 truncate">
        {uuidStr.substring(0, 8)}...{uuidStr.substring(uuidStr.length - 4)}
      </span>
      {isTimeUUID && extractedDate && (
        <span className="text-[10px] text-text-tertiary" title={extractedDate.toISOString()}>
          ({formatRelativeTime(extractedDate)})
        </span>
      )}
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy UUID"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

function extractTimeFromUUID(uuid: string): Date | null {
  try {
    // TimeUUID (Version 1) structure:
    // time_low-time_mid-time_hi_and_version-clock_seq-node
    const parts = uuid.split("-");
    if (parts.length !== 5) return null;

    const timeLow = parts[0];
    const timeMid = parts[1];
    const timeHi = parts[2].substring(1); // Remove version nibble

    // Reconstruct 60-bit timestamp
    const timestampHex = timeHi + timeMid + timeLow;
    const timestamp = parseInt(timestampHex, 16);

    // UUID timestamp is 100-nanosecond intervals since Oct 15, 1582
    // Convert to Unix epoch (milliseconds since Jan 1, 1970)
    const epochDiff = 122192928000000000n; // 100ns intervals between Oct 15, 1582 and Jan 1, 1970
    const unixNs = BigInt(timestamp) - epochDiff;
    const unixMs = Number(unixNs / 10000n);

    return new Date(unixMs);
  } catch {
    return null;
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// ============================================
// Blob/Binary Value Renderer
// ============================================

interface BlobValueProps {
  value: unknown;
}

function BlobValue({ value }: BlobValueProps) {
  const strValue = String(value);

  // Check if it's our placeholder format
  const binaryMatch = strValue.match(/\[binary:\s*(\d+)\s*bytes?\]/i);
  const byteCount = binaryMatch ? parseInt(binaryMatch[1], 10) : 0;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(strValue);
    toast.success("Binary info copied to clipboard");
  }, [strValue]);

  return (
    <div className="flex items-center gap-1.5 group">
      <Binary className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
      <span className="text-xs text-pink-500/90">
        {byteCount > 0 ? (
          <>
            {formatBytes(byteCount)}
            <span className="text-text-tertiary ml-1">({byteCount.toLocaleString()} bytes)</span>
          </>
        ) : (
          strValue
        )}
      </span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy binary info"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================
// Inet Address Value Renderer
// ============================================

interface InetValueProps {
  value: unknown;
}

function InetValue({ value }: InetValueProps) {
  const ipStr = String(value);
  const isIPv6 = ipStr.includes(":");

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(ipStr);
    toast.success("IP address copied to clipboard");
  }, [ipStr]);

  return (
    <div className="flex items-center gap-1.5 group">
      <Globe className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
      <span className="font-mono text-xs text-cyan-500/90">{ipStr}</span>
      <span className="text-[10px] text-text-tertiary">
        {isIPv6 ? "IPv6" : "IPv4"}
      </span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy IP address"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

// ============================================
// Duration Value Renderer
// ============================================

interface DurationValueProps {
  value: unknown;
}

function DurationValue({ value }: DurationValueProps) {
  const durStr = String(value);
  const humanReadable = formatDuration(durStr);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(durStr);
    toast.success("Duration copied to clipboard");
  }, [durStr]);

  return (
    <div className="flex items-center gap-1.5 group">
      <Timer className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
      <span className="text-xs text-violet-500/90">{humanReadable}</span>
      {humanReadable !== durStr && (
        <span className="text-[10px] text-text-tertiary">({durStr})</span>
      )}
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy duration"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

function formatDuration(duration: string): string {
  // Cassandra duration format: XmoXdXnsXusXmsXsXmXh or ISO 8601 duration
  // Try to parse common formats

  // ISO 8601: P[n]Y[n]M[n]DT[n]H[n]M[n]S
  const isoMatch = duration.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (isoMatch) {
    const parts: string[] = [];
    if (isoMatch[1]) parts.push(`${isoMatch[1]}y`);
    if (isoMatch[2]) parts.push(`${isoMatch[2]}mo`);
    if (isoMatch[3]) parts.push(`${isoMatch[3]}d`);
    if (isoMatch[4]) parts.push(`${isoMatch[4]}h`);
    if (isoMatch[5]) parts.push(`${isoMatch[5]}m`);
    if (isoMatch[6]) parts.push(`${isoMatch[6]}s`);
    if (parts.length > 0) return parts.join(" ");
  }

  // Cassandra native format: 1mo2d3h4m5s
  const nativeMatch = duration.match(/(?:(\d+)mo)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (nativeMatch) {
    const parts: string[] = [];
    if (nativeMatch[1]) parts.push(`${nativeMatch[1]} months`);
    if (nativeMatch[2]) parts.push(`${nativeMatch[2]} days`);
    if (nativeMatch[3]) parts.push(`${nativeMatch[3]} hours`);
    if (nativeMatch[4]) parts.push(`${nativeMatch[4]} mins`);
    if (nativeMatch[5]) parts.push(`${nativeMatch[5]} secs`);
    if (parts.length > 0) return parts.join(" ");
  }

  return duration;
}

// ============================================
// Counter Value Renderer
// ============================================

interface CounterValueProps {
  value: unknown;
}

function CounterValue({ value }: CounterValueProps) {
  const num = Number(value);

  return (
    <div className="flex items-center gap-1.5">
      <Hash className="w-3 h-3 text-amber-500 flex-shrink-0" />
      <span className="font-mono text-xs text-amber-500 font-medium">
        {num.toLocaleString()}
      </span>
      <span className="text-[10px] text-text-tertiary">counter</span>
    </div>
  );
}

// ============================================
// Temporal Value Renderer
// ============================================

interface TemporalValueProps {
  value: unknown;
  typeInfo: TypeInfo;
}

function TemporalValue({ value, typeInfo }: TemporalValueProps) {
  const strValue = String(value);
  let displayValue = strValue;
  let icon = Calendar;

  if (typeInfo.baseType === "time") {
    icon = Clock;
  } else if (typeInfo.baseType === "timestamp") {
    icon = Clock;
    // Try to format timestamp nicely
    try {
      const date = new Date(strValue);
      if (!isNaN(date.getTime())) {
        displayValue = date.toLocaleString();
      }
    } catch {
      // Keep original
    }
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(strValue);
    toast.success("Value copied to clipboard");
  }, [strValue]);

  const Icon = icon;

  return (
    <div className="flex items-center gap-1.5 group">
      <Icon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      <span className="text-xs text-text-primary">{displayValue}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy value"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

// ============================================
// Numeric Value Renderer
// ============================================

interface NumericValueProps {
  value: unknown;
  typeInfo: TypeInfo;
}

function NumericValue({ value, typeInfo }: NumericValueProps) {
  const strValue = String(value);
  const isLargeNumber = typeInfo.baseType === "bigint" || typeInfo.baseType === "varint";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(strValue);
    toast.success("Number copied to clipboard");
  }, [strValue]);

  return (
    <div className="flex items-center gap-1.5 group">
      <span className={cn(
        "font-mono text-xs",
        isLargeNumber ? "text-emerald-500" : "text-text-primary"
      )}>
        {strValue}
      </span>
      {isLargeNumber && (
        <span className="text-[10px] text-text-tertiary">{typeInfo.baseType}</span>
      )}
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        title="Copy number"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

// ============================================
// Boolean Value Renderer
// ============================================

interface BooleanValueProps {
  value: unknown;
}

function BooleanValue({ value }: BooleanValueProps) {
  const boolVal = Boolean(value);

  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded text-xs font-medium",
      boolVal
        ? "bg-green-500/15 text-green-500"
        : "bg-red-500/15 text-red-500"
    )}>
      {boolVal ? "true" : "false"}
    </span>
  );
}

// ============================================
// Simple Value Renderer (fallback)
// ============================================

interface SimpleValueProps {
  value: unknown;
}

function SimpleValue({ value }: SimpleValueProps) {
  const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(strValue);
    toast.success("Value copied to clipboard");
  }, [strValue]);

  return (
    <div className="flex items-center gap-1 group truncate">
      <span className="text-text-primary truncate">{strValue}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity flex-shrink-0"
        title="Copy value"
      >
        <Copy className="w-3 h-3 text-text-tertiary" />
      </button>
    </div>
  );
}

export default CassandraValueCell;
