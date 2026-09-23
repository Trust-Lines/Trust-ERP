'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

// Same stage → label/progress mapping the old company-wide dashboard used for its project list
// (now removed) — kept identical so the same stage always shows the same wording and bar fill
// everywhere in the app, not a second invented scale.
const STAGE_LABELS: Record<string, string> = {
  closed_deal:     'Finalization',
  finalization:    'Finalization',
  client_approval: 'Construction Documents',
  production:      'Production',
  delivered:       'Delivery',
};
const STAGE_PROGRESS: Record<string, number> = {
  closed_deal: 15,
  client_approval: 55,
  production: 75,
  finalization: 85,
  delivered: 100,
};

interface ProjectSummary {
  id: string; code: string; name: string; site_location: string | null;
  current_stage: string; est_delivery_date: string | null; closed_deal_date: string | null;
}
interface DocumentRow {
  id: string; doc_type: string; version: number | null; status: string;
  file_name: string | null; dropbox_path: string | null; uploaded_at: string;
  uploader: { full_name: string | null } | null;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return y && m && day ? `${m}/${day}/${y}` : d;
}

export function ProjectQuickView({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const [project, setProject] = React.useState<ProjectSummary | null>(null);
  const [documents, setDocuments] = React.useState<DocumentRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setProject(null);
    setDocuments(null);
    setError(null);

    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/documents`).then(r => r.json()),
    ]).then(([projectRes, docsRes]) => {
      if (cancelled) return;
      if (projectRes.error) { setError(projectRes.error); return; }
      setProject(projectRes.project);
      setDocuments(docsRes.documents ?? []);
    }).catch(() => {
      if (!cancelled) setError('Could not load this project.');
    });

    return () => { cancelled = true; };
  }, [projectId]);

  const loading = projectId != null && project == null && !error;
  const progress = project ? (STAGE_PROGRESS[project.current_stage] ?? 50) : 0;

  return (
    <Sheet open={projectId != null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{project ? `${project.code} — ${project.name}` : 'Project'}</SheetTitle>
          {project && <SheetDescription>{project.site_location ?? 'No site address on file'}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {error && <p className="py-8 text-sm text-red-600">{error}</p>}

          {project && (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-600">
                  <span>{STAGE_LABELS[project.current_stage] ?? project.current_stage}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-[#2c2c2c] transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>Closed {fmtDate(project.closed_deal_date)}</span>
                  <span>Due {fmtDate(project.est_delivery_date)}</span>
                </div>
              </div>

              {/* Files */}
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Files {documents ? `(${documents.length})` : ''}
              </div>
              {documents == null ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading files…
                </div>
              ) : documents.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
                  {documents.map(doc => (
                    <li key={doc.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-neutral-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-neutral-800">
                          {doc.file_name ?? doc.doc_type}{doc.version ? ` v${doc.version}` : ''}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {doc.status} · {doc.uploader?.full_name ?? 'Unknown'} · {fmtDate(doc.uploaded_at.slice(0, 10))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={`/projects/${project.id}`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#2c2c2c] hover:underline"
              >
                Open full project <ExternalLink className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
