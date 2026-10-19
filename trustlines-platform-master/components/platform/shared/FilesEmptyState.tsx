'use client';

import { FolderOpen, Upload } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

// "No files here yet" — Figma "Feedback patterns › Empty state / first use".
// Shows the upload button only when the viewer may upload (onUpload given).
export function FilesEmptyState({
  onUpload,
  uploadLabel = 'Upload first file',
  description = 'Keep proposals, drawings and delivery files together in one place.',
  hint,
  className,
}: {
  onUpload?: () => void;
  uploadLabel?: string;
  description?: string;
  /** Accepted types / size, e.g. "PDF, DWG, DXF and images". Must match the real upload rules. */
  hint?: string;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon={<FolderOpen />}
      title="No files here yet"
      description={description}
      action={onUpload && (
        <Button onClick={onUpload}>
          <Upload /> {uploadLabel}
        </Button>
      )}
      hint={onUpload ? hint : undefined}
    />
  );
}
