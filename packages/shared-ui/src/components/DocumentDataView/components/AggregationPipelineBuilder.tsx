/**
 * AggregationPipelineBuilder
 *
 * Visual builder for MongoDB aggregation pipelines.
 * Supports common stages like $match, $group, $sort, $project, $limit, $skip.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Play,
  X,
  GripVertical,
  Filter,
  Layers,
  ArrowUpDown,
  Columns,
  Hash,
  SkipForward,
  Combine,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/primitives';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/primitives/Dialog';
import type { DocumentDbType } from '../types';

// Pipeline stage types
type StageType = '$match' | '$group' | '$sort' | '$project' | '$limit' | '$skip' | '$unwind' | '$lookup';

interface PipelineStage {
  id: string;
  type: StageType;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface AggregationPipelineBuilderProps {
  /** Whether the builder is open */
  open: boolean;
  /** Callback when builder closes */
  onClose: () => void;
  /** Database type (should be mongodb) */
  dbType: DocumentDbType;
  /** Known fields from documents */
  knownFields?: string[];
  /** Callback when pipeline is executed */
  onExecute: (pipeline: Record<string, unknown>[]) => Promise<void>;
  /** Whether pipeline is being executed */
  isExecuting?: boolean;
}

// Stage templates
const STAGE_TEMPLATES: Record<StageType, { label: string; icon: typeof Filter; defaultConfig: Record<string, unknown> }> = {
  '$match': {
    label: 'Match',
    icon: Filter,
    defaultConfig: {},
  },
  '$group': {
    label: 'Group',
    icon: Layers,
    defaultConfig: { _id: null },
  },
  '$sort': {
    label: 'Sort',
    icon: ArrowUpDown,
    defaultConfig: {},
  },
  '$project': {
    label: 'Project',
    icon: Columns,
    defaultConfig: {},
  },
  '$limit': {
    label: 'Limit',
    icon: Hash,
    defaultConfig: { value: 10 },
  },
  '$skip': {
    label: 'Skip',
    icon: SkipForward,
    defaultConfig: { value: 0 },
  },
  '$unwind': {
    label: 'Unwind',
    icon: Combine,
    defaultConfig: { path: '' },
  },
  '$lookup': {
    label: 'Lookup',
    icon: Combine,
    defaultConfig: { from: '', localField: '', foreignField: '', as: '' },
  },
};

function generateId(): string {
  return `stage-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Stage Editor Components
function MatchStageEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  knownFields: string[];
}) {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setJsonValue(value);
    try {
      const parsed = JSON.parse(value);
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={jsonValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder='{ "field": "value" }'
        rows={3}
        className={cn(
          'w-full px-3 py-2 bg-bg-primary border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none',
          error ? 'border-error' : 'border-border'
        )}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

function GroupStageEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setJsonValue(value);
    try {
      const parsed = JSON.parse(value);
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        Define _id for grouping and accumulators like $sum, $avg, $count
      </p>
      <textarea
        value={jsonValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder='{ "_id": "$field", "count": { "$sum": 1 } }'
        rows={4}
        className={cn(
          'w-full px-3 py-2 bg-bg-primary border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none',
          error ? 'border-error' : 'border-border'
        )}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

function SortStageEditor({
  config,
  onChange,
  knownFields,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  knownFields: string[];
}) {
  const [fields, setFields] = useState<Array<{ field: string; direction: 1 | -1 }>>(
    Object.entries(config).map(([field, dir]) => ({
      field,
      direction: dir === -1 ? -1 : 1,
    }))
  );

  const handleUpdate = (newFields: typeof fields) => {
    setFields(newFields);
    const newConfig: Record<string, number> = {};
    newFields.forEach(({ field, direction }) => {
      if (field.trim()) {
        newConfig[field.trim()] = direction;
      }
    });
    onChange(newConfig);
  };

  return (
    <div className="space-y-2">
      {fields.map((f, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={f.field}
            onChange={(e) => {
              const updated = [...fields];
              updated[idx] = { ...f, field: e.target.value };
              handleUpdate(updated);
            }}
            placeholder="Field name"
            list="sort-fields"
            className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <select
            value={f.direction}
            onChange={(e) => {
              const updated = [...fields];
              updated[idx] = { ...f, direction: parseInt(e.target.value) as 1 | -1 };
              handleUpdate(updated);
            }}
            className="px-2 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={1}>ASC</option>
            <option value={-1}>DESC</option>
          </select>
          <button
            onClick={() => handleUpdate(fields.filter((_, i) => i !== idx))}
            className="p-1.5 rounded hover:bg-error/10 text-text-tertiary hover:text-error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <datalist id="sort-fields">
        {knownFields.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <button
        onClick={() => handleUpdate([...fields, { field: '', direction: 1 }])}
        className="text-xs text-accent hover:underline"
      >
        + Add sort field
      </button>
    </div>
  );
}

function ProjectStageEditor({
  config,
  onChange,
  knownFields,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  knownFields: string[];
}) {
  const [fields, setFields] = useState<Array<{ field: string; include: boolean }>>(
    Object.entries(config).map(([field, value]) => ({
      field,
      include: value !== 0,
    }))
  );

  const handleUpdate = (newFields: typeof fields) => {
    setFields(newFields);
    const newConfig: Record<string, number> = {};
    newFields.forEach(({ field, include }) => {
      if (field.trim()) {
        newConfig[field.trim()] = include ? 1 : 0;
      }
    });
    onChange(newConfig);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        Select fields to include or exclude
      </p>
      {fields.map((f, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={f.field}
            onChange={(e) => {
              const updated = [...fields];
              updated[idx] = { ...f, field: e.target.value };
              handleUpdate(updated);
            }}
            placeholder="Field name"
            list="project-fields"
            className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={f.include}
              onChange={(e) => {
                const updated = [...fields];
                updated[idx] = { ...f, include: e.target.checked };
                handleUpdate(updated);
              }}
              className="accent-accent"
            />
            <span className="text-xs text-text-secondary">Include</span>
          </label>
          <button
            onClick={() => handleUpdate(fields.filter((_, i) => i !== idx))}
            className="p-1.5 rounded hover:bg-error/10 text-text-tertiary hover:text-error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <datalist id="project-fields">
        {knownFields.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <button
        onClick={() => handleUpdate([...fields, { field: '', include: true }])}
        className="text-xs text-accent hover:underline"
      >
        + Add field
      </button>
    </div>
  );
}

function LimitSkipStageEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  type: '$limit' | '$skip';
}) {
  const value = (config.value as number) || 0;

  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange({ value: parseInt(e.target.value) || 0 })}
        min={0}
        className="w-32 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

function UnwindStageEditor({
  config,
  onChange,
  knownFields,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  knownFields: string[];
}) {
  const path = (config.path as string) || '';

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        Array field to unwind (prefix with $)
      </p>
      <input
        type="text"
        value={path}
        onChange={(e) => onChange({ path: e.target.value })}
        placeholder="$arrayField"
        list="unwind-fields"
        className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <datalist id="unwind-fields">
        {knownFields.map((f) => (
          <option key={f} value={`$${f}`} />
        ))}
      </datalist>
    </div>
  );
}

function LookupStageEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-text-tertiary">From collection</label>
          <input
            type="text"
            value={(config.from as string) || ''}
            onChange={(e) => onChange({ ...config, from: e.target.value })}
            placeholder="collection"
            className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary">As (output field)</label>
          <input
            type="text"
            value={(config.as as string) || ''}
            onChange={(e) => onChange({ ...config, as: e.target.value })}
            placeholder="joinedData"
            className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary">Local field</label>
          <input
            type="text"
            value={(config.localField as string) || ''}
            onChange={(e) => onChange({ ...config, localField: e.target.value })}
            placeholder="fieldName"
            className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary">Foreign field</label>
          <input
            type="text"
            value={(config.foreignField as string) || ''}
            onChange={(e) => onChange({ ...config, foreignField: e.target.value })}
            placeholder="_id"
            className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>
    </div>
  );
}

// Stage component
function PipelineStageCard({
  stage,
  index,
  onUpdate,
  onRemove,
  onMove,
  knownFields,
  isFirst,
  isLast,
}: {
  stage: PipelineStage;
  index: number;
  onUpdate: (updates: Partial<PipelineStage>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  knownFields: string[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const template = STAGE_TEMPLATES[stage.type];
  const Icon = template.icon;

  const renderEditor = () => {
    switch (stage.type) {
      case '$match':
        return (
          <MatchStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
            knownFields={knownFields}
          />
        );
      case '$group':
        return (
          <GroupStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
          />
        );
      case '$sort':
        return (
          <SortStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
            knownFields={knownFields}
          />
        );
      case '$project':
        return (
          <ProjectStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
            knownFields={knownFields}
          />
        );
      case '$limit':
      case '$skip':
        return (
          <LimitSkipStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
            type={stage.type}
          />
        );
      case '$unwind':
        return (
          <UnwindStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
            knownFields={knownFields}
          />
        );
      case '$lookup':
        return (
          <LookupStageEditor
            config={stage.config}
            onChange={(config) => onUpdate({ config })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        stage.enabled
          ? 'border-border bg-bg-secondary'
          : 'border-border/50 bg-bg-tertiary/50 opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2">
        <GripVertical className="w-4 h-4 text-text-tertiary cursor-grab" />

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-bg-hover text-text-tertiary"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <Icon className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">
            {template.label}
          </span>
          <span className="text-xs text-text-tertiary">
            Stage {index + 1}
          </span>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={stage.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            className="accent-accent"
          />
          <span className="text-xs text-text-secondary">Enabled</span>
        </label>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={isFirst}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={isLast}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-error/10 text-text-tertiary hover:text-error"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1">
          {renderEditor()}
        </div>
      )}
    </div>
  );
}

export function AggregationPipelineBuilder({
  open,
  onClose,
  dbType: _dbType,
  knownFields = [],
  onExecute,
  isExecuting = false,
}: AggregationPipelineBuilderProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [showAddStage, setShowAddStage] = useState(false);
  const [pipelinePreview, setPipelinePreview] = useState<string>('');

  // Build pipeline from stages
  const buildPipeline = useCallback((): Record<string, unknown>[] => {
    return stages
      .filter((s) => s.enabled)
      .map((s) => {
        if (s.type === '$limit' || s.type === '$skip') {
          return { [s.type]: (s.config.value as number) || 0 };
        }
        if (s.type === '$unwind') {
          return { [s.type]: s.config.path };
        }
        return { [s.type]: s.config };
      });
  }, [stages]);

  // Update preview when stages change
  useMemo(() => {
    const pipeline = buildPipeline();
    setPipelinePreview(JSON.stringify(pipeline, null, 2));
  }, [buildPipeline]);

  // Add new stage
  const handleAddStage = useCallback((type: StageType) => {
    const template = STAGE_TEMPLATES[type];
    setStages((prev) => [
      ...prev,
      {
        id: generateId(),
        type,
        config: { ...template.defaultConfig },
        enabled: true,
      },
    ]);
    setShowAddStage(false);
  }, []);

  // Update stage
  const handleUpdateStage = useCallback((id: string, updates: Partial<PipelineStage>) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  // Remove stage
  const handleRemoveStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Move stage
  const handleMoveStage = useCallback((id: string, direction: 'up' | 'down') => {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;

      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      const newStages = [...prev];
      [newStages[idx], newStages[newIdx]] = [newStages[newIdx], newStages[idx]];
      return newStages;
    });
  }, []);

  // Execute pipeline
  const handleExecute = useCallback(async () => {
    const pipeline = buildPipeline();
    await onExecute(pipeline);
  }, [buildPipeline, onExecute]);

  // Clear all stages
  const handleClear = useCallback(() => {
    setStages([]);
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="absolute top-full left-0 right-0 z-50 mt-1 mx-4 bg-bg-primary border border-border rounded-lg shadow-xl max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-text-primary">Aggregation Pipeline</h3>
            <span className="text-xs text-text-tertiary">
              {stages.length} stage{stages.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stages */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {stages.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No stages in pipeline</p>
              <p className="text-xs mt-1">Add stages to build your aggregation</p>
            </div>
          ) : (
            stages.map((stage, idx) => (
              <PipelineStageCard
                key={stage.id}
                stage={stage}
                index={idx}
                onUpdate={(updates) => handleUpdateStage(stage.id, updates)}
                onRemove={() => handleRemoveStage(stage.id)}
                onMove={(dir) => handleMoveStage(stage.id, dir)}
                knownFields={knownFields}
                isFirst={idx === 0}
                isLast={idx === stages.length - 1}
              />
            ))
          )}

          {/* Add stage button */}
          <button
            onClick={() => setShowAddStage(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border hover:border-accent hover:bg-accent/5 text-text-secondary hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
        </div>

        {/* Preview */}
        {stages.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-bg-secondary">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-tertiary">Pipeline Preview</span>
            </div>
            <pre className="text-xs font-mono text-text-secondary bg-bg-primary p-2 rounded overflow-x-auto max-h-24">
              {pipelinePreview}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-bg-secondary">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={stages.length === 0}
          >
            Clear all
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting || stages.filter((s) => s.enabled).length === 0}
            >
              {isExecuting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5" />
                  Run Pipeline
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent title="Add Pipeline Stage" className="max-w-sm">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(STAGE_TEMPLATES) as [StageType, typeof STAGE_TEMPLATES['$match']][]).map(([type, template]) => {
              const Icon = template.icon;
              return (
                <button
                  key={type}
                  onClick={() => handleAddStage(type)}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 text-left transition-colors"
                >
                  <Icon className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{template.label}</p>
                    <p className="text-xs text-text-tertiary font-mono">{type}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AggregationPipelineBuilder;
