
export type AssigneeKey = 'production_pm' | 'trust_pm' | 'client_pm' | 'general_manager' | 'accountant' | 'pm_supervisor';

export interface StageDef {
  label:    string;
  hint:     string;
  assignee: AssigneeKey;
  box:      string;
  optional?: boolean;
  anytime?:  boolean;
}

const PRODUCTION_BUNDLE = ['item_plan', 'item_list', 'price_list', 'book', 'proposal'];

export function approvalStagesFor(docType: string, catGroup: string | null): StageDef[] {
  if (docType === 'plan_layout') {
    return [{ label: 'Client PM', hint: 'T-Lines client PM approval', assignee: 'client_pm', box: 'Client PM' }];
  }
  if (docType === 'proposal' && !catGroup) {
    return [{ label: 'Client PM', hint: 'T-Lines client PM approval', assignee: 'client_pm', box: 'Client PM' }];
  }
  if (docType === 'construction_drawings' || docType === 'shop_drawing') {
    return [
      { label: 'Trust PM',  hint: 'Trust Lines PM review',     assignee: 'trust_pm',  box: 'Trust PM' },
      { label: 'Client PM', hint: 'T-Lines client PM approval', assignee: 'client_pm', box: 'Client PM' },
    ];
  }

  if (docType === 'po_bo') {
    return [
      { label: 'Client PM',       hint: 'NE T-Lines PM approval',          assignee: 'client_pm',       box: 'NE Tlines Project Manager' },
      { label: 'General Manager', hint: 'T-Lines General Manager approval', assignee: 'general_manager', box: 'Tlines General Manager' },
      { label: 'Accountant',      hint: 'Accountant (optional)',           assignee: 'accountant',      box: 'Accountant', optional: true },
      { label: 'Project Management Supervisor', hint: 'Optional · sign any time', assignee: 'pm_supervisor', box: 'Project Management Supervisor', optional: true, anytime: true },
    ];
  }

  if (catGroup && PRODUCTION_BUNDLE.includes(docType)) {
    return [
      { label: 'Production Manager', hint: 'Production Manager approval', assignee: 'production_pm', box: 'Production Manager' },
      { label: 'Trust PM',           hint: 'Trust Lines PM review',       assignee: 'trust_pm',     box: 'Trust PM' },
      { label: 'Client PM',          hint: 'T-Lines client PM approval',  assignee: 'client_pm',    box: 'Client PM' },
    ];
  }

  return [{ label: 'Client PM', hint: 'T-Lines client PM approval', assignee: 'client_pm', box: 'Client PM' }];
}

export function mandatoryStageCount(docType: string, catGroup: string | null): number {
  return approvalStagesFor(docType, catGroup).filter(s => !s.optional).length;
}

export function rolesForAssignee(assignee: AssigneeKey, catGroup: string | null): string[] {
  switch (assignee) {
    case 'production_pm': {
      const catUp = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
      return ['Millwork', 'Shelving'].includes(catUp) ? ['pm_millwork'] : ['pm_ceiling'];
    }
    case 'trust_pm':        return ['trustlines_pm'];
    case 'client_pm':       return ['tlines_pm'];
    case 'general_manager': return ['general_manager'];
    case 'accountant':      return ['accountant'];
    case 'pm_supervisor':   return ['ops_manager'];
    default:                return [];
  }
}

export function pfStageRoles(stage: number, catGroup: string | null): string[] {
  const catUp = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
  switch (stage) {
    case 1: return ['Millwork', 'Shelving'].includes(catUp) ? ['pm_millwork', 'production_manager'] : ['pm_ceiling', 'production_manager'];
    case 2: return ['trustlines_pm', 'project_manager'];
    case 3: return ['general_manager'];
    case 4: return ['accountant'];
    default: return [];
  }
}

export function stageRolesFor(docType: string, catGroup: string | null, stage: number): string[] {
  if (docType === 'pf') return pfStageRoles(stage, catGroup);
  const sd = approvalStagesFor(docType, catGroup)[stage - 1];
  return sd ? rolesForAssignee(sd.assignee, catGroup) : [];
}

function isMillworkish(catGroup: string | null): boolean {
  const c = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
  return ['Millwork', 'Shelving'].includes(c);
}

export function signPermForAssignee(assignee: AssigneeKey, catGroup: string | null): string {
  switch (assignee) {
    case 'production_pm':   return isMillworkish(catGroup) ? 'sign.production_millwork' : 'sign.production_ceiling';
    case 'trust_pm':        return 'sign.trust_pm';
    case 'client_pm':       return 'sign.client_pm';
    case 'general_manager': return 'sign.general_manager';
    case 'accountant':      return 'sign.accountant';
    case 'pm_supervisor':   return 'sign.pm_supervisor';
    default:                return '';
  }
}

export function signPermForStage(docType: string, catGroup: string | null, stage: number): string | null {
  if (docType === 'pf') {
    switch (stage) {
      case 1: return isMillworkish(catGroup) ? 'sign.production_millwork' : 'sign.production_ceiling';
      case 2: return 'sign.trust_pm';
      case 3: return 'sign.general_manager';
      case 4: return 'sign.accountant';
      default: return null;
    }
  }
  const sd = approvalStagesFor(docType, catGroup)[stage - 1];
  return sd ? signPermForAssignee(sd.assignee, catGroup) || null : null;
}
