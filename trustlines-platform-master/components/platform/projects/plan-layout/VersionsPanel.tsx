'use client';

import { FilePlus2, Pencil } from 'lucide-react';
import type { DocumentRow } from '../ProjectDetailClient';
import { DropboxSyncBtn } from '../ProjectWorkflow';
import { DocStatusBadge, DropboxIcon, type ILVer } from './shared';

/** Left column: Dropbox sync, Item List → pricing shortcuts, version pills and the file list. */
export function VersionsPanel({
  projectId, docType, catGroup, title, dropboxRootPath, isGeneratable, onSynced,
  planDocs, ilVersions, versionNumbers, safeVersion, activeVersionDocs, selectedId,
  onSelectVersion, onSelectDoc, onCreateItemList, onOpenForPricing, onEditDoc,
}: {
  projectId: string;
  docType: string;
  catGroup?: string | null;
  title: string;
  dropboxRootPath?: string | null;
  isGeneratable: boolean;
  onSynced?: () => void;
  planDocs: DocumentRow[];
  ilVersions: ILVer[];
  versionNumbers: number[];
  safeVersion: number;
  activeVersionDocs: DocumentRow[];
  selectedId: string | null;
  onSelectVersion: (vNum: number) => void;
  onSelectDoc: (id: string) => void;
  onCreateItemList: () => void;
  onOpenForPricing: (formData: unknown[]) => void;
  onEditDoc: (doc: DocumentRow) => void;
}) {
  return (
      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <DropboxIcon size={14} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-default)' }}>
            Dropbox {title} Versions
          </span>
        </div>

        {(dropboxRootPath || isGeneratable) && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            {isGeneratable && docType === 'item_list' && (
              <button
                onClick={onCreateItemList}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px' }}
              >
                <FilePlus2 size={13} /> Create Item List
              </button>
            )}
            {dropboxRootPath && (
              <div style={{ marginLeft: 'auto' }}>
                <DropboxSyncBtn
                  projectId={projectId}
                  dropboxRootPath={dropboxRootPath}
                  docType={docType}
                  catGroup={catGroup ?? null}
                  stepKey={docType}
                  linkedVersions={new Set(planDocs.map(d => d.dropbox_version ?? d.version))}
                  onSynced={onSynced ?? (() => window.location.reload())}
                />
              </div>
            )}
          </div>
        )}

        {docType === 'price_list' && isGeneratable && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Open Item List for Pricing
            </div>
            {ilVersions.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginBottom: 6 }}>
                No Item List versions found.<br />Create an Item List first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ilVersions.map(ver => (
                  <div key={ver.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>V{ver.version}</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ver.file_name.replace(/\.pdf$/i, '')}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (!ver.form_data?.length) { alert('No saved data for this version. Please regenerate the Item List first.'); return; }
                        onOpenForPricing(ver.form_data);
                      }}
                      style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '4px 10px', background: 'var(--status-danger)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Open for Pricing
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {planDocs.length === 0 ? (
          <div style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>
            No {title} files yet.{dropboxRootPath ? ' Use the Dropbox button to sync.' : ''}
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
            }}>
              {versionNumbers.map(vNum => {
                const isActive = vNum === safeVersion;
                return (
                  <button
                    key={vNum}
                    type="button"
                    onClick={() => onSelectVersion(vNum)}
                    style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 100ms',
                      background: isActive ? 'var(--brand-teal)' : 'var(--bg-surface)',
                      color:      isActive ? 'white'    : 'var(--fg-muted)',
                      boxShadow:  isActive ? 'none'    : 'inset 0 0 0 1px var(--border-default)',
                    }}
                  >
                    V{vNum}
                  </button>
                );
              })}
            </div>

            {activeVersionDocs.map(doc => {
              const isSelected = doc.id === selectedId;
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  style={{
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isSelected ? 'var(--status-info)' : 'transparent'}`,
                    background: isSelected ? 'var(--status-info-bg)' : 'white',
                    cursor: 'pointer', transition: 'all 80ms',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{
                      width: 32, height: 38, borderRadius: 4, flexShrink: 0, background: 'var(--status-danger-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 900, color: 'var(--status-danger)', letterSpacing: '0.06em',
                      border: '1px solid var(--status-danger)',
                    }}>
                      {doc.file_name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--fg-default)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 1,
                      }}>
                        {doc.file_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#0061FF' }}>
                      <DropboxIcon size={9} />Dropbox Synced
                    </span>
                    <DocStatusBadge status={doc.status} />
                    {doc.status === 'rejected' && isGeneratable && (
                      <button
                        onClick={e => { e.stopPropagation(); onEditDoc(doc); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)',
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={9} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
  );
}
