import { type FC, useState } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { REDIS_COMMANDS, REDIS_COMMAND_CATEGORIES } from "../constants";

interface RedisReferencePanelProps {
  onInsertCommand: (command: string) => void;
}

export const RedisReferencePanel: FC<RedisReferencePanelProps> = ({
  onInsertCommand
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('strings');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopy = async (example: string, cmd: string) => {
    await navigator.clipboard.writeText(example);
    setCopiedItem(cmd);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleInsert = (example: string) => {
    onInsertCommand(example);
  };

  return (
    <div className="h-full flex flex-col bg-vscode-sidebar overflow-hidden">
      <div className="px-3 py-2 border-b border-vscode-border">
        <h3 className="text-xs font-medium text-vscode-text-muted uppercase tracking-wide">
          Redis Commands
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {REDIS_COMMAND_CATEGORIES.map(({ key, label }) => {
          const items = REDIS_COMMANDS[key] || [];
          const isExpanded = expandedCategory === key;

          return (
            <div key={key} className="border-b border-vscode-border last:border-b-0">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : key)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-vscode-list-hover text-left"
              >
                <ChevronRight
                  className={`h-3 w-3 text-vscode-text-muted transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-xs font-medium text-vscode-text">
                  {label}
                </span>
                <span className="text-xs text-vscode-text-muted ml-auto">
                  {items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {items.map((item) => (
                    <div
                      key={item.cmd}
                      className="mx-2 mb-1 rounded bg-vscode-input border border-vscode-border"
                    >
                      <div className="px-2 py-1.5 flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-medium text-red-500">
                            {item.cmd}
                          </div>
                          <div className="text-xs text-vscode-text-muted font-mono mt-0.5">
                            {item.args}
                          </div>
                          <div className="text-xs text-vscode-text-muted mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleCopy(item.example, item.cmd)}
                            className="p-1 rounded hover:bg-vscode-list-hover text-vscode-text-muted hover:text-vscode-text"
                            title="Copy to clipboard"
                          >
                            {copiedItem === item.cmd ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleInsert(item.example)}
                            className="px-1.5 py-0.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                            title="Insert into editor"
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
