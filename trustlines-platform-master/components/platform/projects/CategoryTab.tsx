'use client';

import { useState } from 'react';
import { PlanLayoutTab } from './PlanLayoutTab';
import { PfTab } from './PfTab';
import { PoTab } from './PoTab';
import { PROD_TYPES_WITH_PROPOSAL } from '@/lib/dropbox/paths';
import { permCan, type PermMap } from '@/lib/permissions/catalog';
import type { DocumentRow, AuditRow } from './ProjectDetailClient';

const ALL_INNER_TABS = [
  { key: 'proposal',   label: 'Proposal',        docType: 'proposal',   requiresProposal: true  },
  { key: 'item_plan',  label: 'Item Plan',        docType: 'item_plan',  requiresProposal: false },
  { key: 'item_list',  label: 'Item List',        docType: 'item_list',  requiresProposal: false },
  { key: 'price_list', label: 'Item Price List',  docType: 'price_list', requiresProposal: false },
  { key: 'book',       label: 'Book',             docType: 'book',       requiresProposal: false },
  { key: 'po',         label: 'PO',               docType: 'po_bo',      requiresProposal: false },
  { key: 'pfs',        label: 'PFS',              docType: 'pf',         requiresProposal: false },
] as const;

type InnerTabKey = typeof ALL_INNER_TABS[number]['key'];

interface Props {
  projectId:        string;
  userId:           string;
  userRole?:        string;
  userPerms?:       PermMap;
  catGroup:         string;
  categoryLabel:    string;
  documents:        DocumentRow[];
  auditEvents:      AuditRow[];
  dropboxRootPath?: string | null;
  onSynced?:        () => void;
}

export function CategoryTab({
  projectId, userId, userRole, userPerms, catGroup, categoryLabel, documents, auditEvents,
  dropboxRootPath, onSynced,
}: Props) {
  const hasProposal = (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(
    catGroup.charAt(0).toUpperCase() + catGroup.slice(1),
  );
  const INNER_TABS = ALL_INNER_TABS.filter(t => {
    if (t.requiresProposal && !hasProposal) return false;
    if (t.key === 'po'  && userPerms && !permCan(userPerms, 'view.po')) return false;
    if (t.key === 'pfs' && userPerms && !permCan(userPerms, 'view.pf')) return false;
    return true;
  });

  const defaultTab: InnerTabKey = hasProposal ? 'proposal' : 'item_plan';
  const [activeInner, setActiveInner] = useState<InnerTabKey>(defaultTab);

  const current = INNER_TABS.find(t => t.key === activeInner) ?? INNER_TABS[0];

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20, overflowX: 'auto',
      }}>
        {INNER_TABS.map(tab => {
          const seen = new Set<string>();
          for (const d of documents) {
            if (d.doc_type === tab.docType && d.cat_group === catGroup)
              seen.add(`${(d as { dropbox_version?: number | null }).dropbox_version ?? d.version}::${d.file_name}`);
          }
          const count = seen.size;
          const isActive = tab.key === activeInner;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveInner(tab.key)}
              style={{
                padding: '7px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--brand-teal)' : 'var(--fg-muted)',
                borderBottom: `2px solid ${isActive ? 'var(--brand-teal)' : 'transparent'}`,
                marginBottom: -1, whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'color 100ms',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 99,
                  background: isActive ? 'var(--brand-teal)' : 'var(--bg-subtle)',
                  color: isActive ? 'white' : 'var(--fg-subtle)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {current.docType === 'po_bo' ? (
        <PoTab
          key={`${catGroup}-po`}
          projectId={projectId}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          catGroup={catGroup}
          categoryLabel={categoryLabel}
          documents={documents}
          onSynced={onSynced}
        />
      ) : current.docType === 'pf' ? (
        <PfTab
          key={`${catGroup}-pf`}
          projectId={projectId}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          catGroup={catGroup}
          categoryLabel={categoryLabel}
          documents={documents}
          dropboxRootPath={dropboxRootPath}
          onSynced={onSynced}
        />
      ) : (
        <PlanLayoutTab
          key={`${catGroup}-${current.key}`}
          projectId={projectId}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          documents={documents}
          auditEvents={auditEvents}
          docType={current.docType}
          title={`${categoryLabel} ${current.label}`}
          catGroup={catGroup}
          dropboxRootPath={dropboxRootPath}
          onSynced={onSynced}
        />
      )}
    </div>
  );
}
