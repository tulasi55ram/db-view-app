/**
 * DeleteDocumentDialog
 *
 * Confirmation dialog for deleting a document.
 */

import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/primitives/Dialog';
import { Button } from '@/primitives';
import type { DocumentDbType } from '../types';
import { DB_LABELS } from '../types';

interface DeleteDocumentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Document ID to delete (or count string for bulk delete) */
  documentId: string;
  /** Database type for terminology */
  dbType: DocumentDbType;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
  /** Whether this is a bulk delete operation */
  isBulkDelete?: boolean;
}

export function DeleteDocumentDialog({
  open,
  onOpenChange,
  documentId,
  dbType,
  onConfirm,
  isDeleting = false,
  isBulkDelete = false,
}: DeleteDocumentDialogProps) {
  const labels = DB_LABELS[dbType];

  const handleConfirm = () => {
    onConfirm();
  };

  const title = isBulkDelete
    ? `Delete ${documentId}?`
    : `Delete ${labels.itemLabel}?`;

  const description = isBulkDelete
    ? `This action cannot be undone. This will permanently delete these ${labels.itemLabelPlural.toLowerCase()} from the database.`
    : `This action cannot be undone. This will permanently delete this ${labels.itemLabel.toLowerCase()} from the database.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        className="max-w-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/20">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-secondary">
              {description}
            </p>

            {!isBulkDelete && (
              <div className="mt-4 rounded border border-border bg-bg-tertiary p-3">
                <p className="text-xs text-text-tertiary mb-1">
                  {labels.itemLabel} ID:
                </p>
                <p className="text-sm font-mono text-text-primary break-all">
                  {documentId}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-error hover:bg-error/90"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteDocumentDialog;
