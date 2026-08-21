
export interface DropboxProjectParams {
  dropboxSection:    string;
  dropboxRegion:     string;
  dropboxStatus:     string;
  dropboxClientType: string;
  dropboxClientName?: string;
  projectNo:         string;
  address:           string;
}

export const PROD_TYPES = ['Millwork', 'Ceiling', 'Image', 'Shelving', 'Furniture', 'Decoration'] as const;
export type  ProdType   = typeof PROD_TYPES[number];

export const PROD_TYPES_WITH_PROPOSAL = ['Millwork', 'Shelving'] as const satisfies readonly ProdType[];

export const PROD_TYPES_WITHOUT_PROPOSAL = ['Ceiling', 'Image', 'Furniture', 'Decoration'] as const satisfies readonly ProdType[];

export const PROD_DOC_TYPES = new Set([
  'item_plan', 'item_list', 'price_list', 'boq', 'book', 'po_bo', 'pf',
]);

export interface DocPathOptions {
  version:       number;
  prodType?:     ProdType;
  innerVersion?: number;
}

export function getDocFolder(docType: string, opts: DocPathOptions): string {
  const v  = opts.version;
  const pt = opts.prodType ?? 'Millwork';

  if (docType === 'closed_deal_email') return '1-Finalization/2-Project info';
  if (docType === 'plan_layout')       return `1-Finalization/5-Plan Layout/V${v}/PDF`;
  if (docType === 'proposal')          return `1-Finalization/6-Design Proposal/V${v}/1-PDF`;

  if (docType === 'construction_drawings' || docType === 'shop_drawing')
    return `2-Construction Document/3-Construction Drawings/V${v}/2-PDF`;

  const base = `3-Production & Delivery/${pt}/V${v}`;
  const withProposal = (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(pt);

  if (docType === 'proposal_prod')  return `${base}/1-Proposal/PDF`;

  const pfInner = `V${opts.innerVersion ?? 0}`;

  if (withProposal) {
    if (docType === 'proposal_prod')                                      return `${base}/1-Proposal/PDF`;
    if (docType === 'item_plan')                                          return `${base}/2-Item Plan/PDF`;
    if (docType === 'item_list' || docType === 'price_list' || docType === 'boq')
                                                                          return `${base}/3-Item List/PDF`;
    if (docType === 'book')                                               return `${base}/4-Book/4-Final Submission/PDF`;
    if (docType === 'po_bo')                                              return `${base}/5-Purchase Order/PDF`;
    if (docType === 'pf')                                                 return `${base}/6-Production Form/For Trust/${pfInner}/PDF`;
  } else {
    if (docType === 'item_plan')                                          return `${base}/1-Item Plan/PDF`;
    if (docType === 'item_list' || docType === 'price_list' || docType === 'boq')
                                                                          return `${base}/2-Item List/PDF`;
    if (docType === 'book')                                               return `${base}/3-Book/4-Final Submission/PDF`;
    if (docType === 'po_bo')                                              return `${base}/4-Purchase Order/PDF`;
    if (docType === 'pf')                                                 return `${base}/5-Production Form/For Trust/${pfInner}/PDF`;
  }

  return '3-Production & Delivery/0-Missing-Extra';
}

export function getVersionBaseFolder(docType: string, prodType?: ProdType): string | null {
  if (docType === 'plan_layout')           return '1-Finalization/5-Plan Layout';
  if (docType === 'proposal' && !prodType) return '1-Finalization/6-Design Proposal';
  if (docType === 'construction_drawings' || docType === 'shop_drawing')
    return '2-Construction Document/3-Construction Drawings';

  if (!prodType) {
    if (PROD_DOC_TYPES.has(docType)) return `3-Production & Delivery/Millwork`;
    return null;
  }

  const pt = prodType;
  if (PROD_DOC_TYPES.has(docType)) return `3-Production & Delivery/${pt}`;

  if (docType === 'proposal' && (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(pt))
    return `3-Production & Delivery/${pt}`;

  return null;
}

export function getDocSubfolder(docType: string, prodType?: ProdType): string | null {
  if (docType === 'plan_layout')                     return 'PDF';
  if (docType === 'proposal' && !prodType)           return '1-PDF';
  if (docType === 'construction_drawings' || docType === 'shop_drawing') return '2-PDF';

  if (!prodType) return null;

  const withProposal = (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(prodType);

  if (withProposal) {
    if (docType === 'proposal')                                          return '1-Proposal/PDF';
    if (docType === 'item_plan')                                         return '2-Item Plan/PDF';
    if (docType === 'item_list' || docType === 'price_list' || docType === 'boq') return '3-Item List/PDF';
    if (docType === 'book')                                              return '4-Book/4-Final Submission/PDF';
    if (docType === 'po_bo')                                             return '5-Purchase Order/PDF';
    if (docType === 'pf')                                                return '6-Production Form/For Trust';
  } else {
    if (docType === 'item_plan')                                         return '1-Item Plan/PDF';
    if (docType === 'item_list' || docType === 'price_list' || docType === 'boq') return '2-Item List/PDF';
    if (docType === 'book')                                              return '3-Book/4-Final Submission/PDF';
    if (docType === 'po_bo')                                             return '4-Purchase Order/PDF';
    if (docType === 'pf')                                                return '5-Production Form/For Trust';
  }

  return null;
}

export function getDropboxPath(
  projectRootPath: string,
  docType: string,
  fileName: string,
  opts: DocPathOptions,
): string {
  return `${projectRootPath}/${getDocFolder(docType, opts)}/${fileName}`;
}

export function buildDropboxProjectPath(params: DropboxProjectParams): {
  parentPath: string;
  projectFolderPath: string;
} {
  const {
    dropboxSection, dropboxRegion, dropboxStatus,
    dropboxClientType, dropboxClientName,
    projectNo, address,
  } = params;

  const clientTypeFolder  = dropboxClientType === 'Individuals' ? 'Individiuals' : dropboxClientType;
  const projectFolderName = `${projectNo} - ${address}`;

  const parentParts = [
    '/D-Projects/T LINES',
    dropboxSection,
    dropboxRegion,
    dropboxStatus,
    clientTypeFolder,
  ];
  if (dropboxClientType === 'Clients' && dropboxClientName) {
    parentParts.push(dropboxClientName);
  }

  const parentPath        = parentParts.join('/');
  const projectFolderPath = `${parentPath}/${projectFolderName}`;
  return { parentPath, projectFolderPath };
}

export const PLAN_LAYOUT_V_SUBFOLDERS = ['CAD', 'PDF'];

export const DESIGN_PROPOSAL_V_SUBFOLDERS = ['1-PDF', '2-Randers', '3-SKP', '4-LUMION'];

export const CONSTRUCTION_DRAWINGS_V_SUBFOLDERS = ['1-CAD', '2-PDF'];

export const PROD_V_SUBFOLDERS_WITH_PROPOSAL = [
  '1-Proposal',
  '1-Proposal/CAD',
  '1-Proposal/PDF',
  '2-Item Plan',
  '2-Item Plan/CAD',
  '2-Item Plan/PDF',
  '3-Item List',
  '3-Item List/Excel',
  '3-Item List/PDF',
  '4-Book',
  '4-Book/1-initial Submit',
  '4-Book/1-initial Submit/CAD',
  '4-Book/1-initial Submit/PDF',
  '4-Book/2-Meeting With Supplier',
  '4-Book/3-Meeting With Tlines',
  '4-Book/4-Final Submission',
  '4-Book/4-Final Submission/CAD',
  '4-Book/4-Final Submission/PDF',
  '5-Purchase Order',
  '5-Purchase Order/EXCEL',
  '5-Purchase Order/PDF',
  '6-Production Form',
  '6-Production Form/For Trust',
  '6-Production Form/For Trust/V0',
  '6-Production Form/For Trust/V0/EXCEL',
  '6-Production Form/For Trust/V0/PDF',
  '6-Production Form/For Vendor',
  '6-Production Form/From Vendor',
];

export const PROD_V_SUBFOLDERS_WITHOUT_PROPOSAL = [
  '1-Item Plan',
  '1-Item Plan/CAD',
  '1-Item Plan/PDF',
  '2-Item List',
  '2-Item List/Excel',
  '2-Item List/PDF',
  '3-Book',
  '3-Book/1-initial Submit',
  '3-Book/1-initial Submit/CAD',
  '3-Book/1-initial Submit/PDF',
  '3-Book/2-Meeting With Supplier',
  '3-Book/3-Meeting With Tlines',
  '3-Book/4-Final Submission',
  '3-Book/4-Final Submission/CAD',
  '3-Book/4-Final Submission/PDF',
  '4-Purchase Order',
  '4-Purchase Order/EXCEL',
  '4-Purchase Order/PDF',
  '5-Production Form',
  '5-Production Form/For Trust',
  '5-Production Form/For Trust/V0',
  '5-Production Form/For Trust/V0/EXCEL',
  '5-Production Form/For Trust/V0/PDF',
  '5-Production Form/For Vendor',
  '5-Production Form/From Vendor',
];

export const PROD_V_SUBFOLDERS = PROD_V_SUBFOLDERS_WITH_PROPOSAL;

export function getProdVSubfolders(prodType: ProdType | string): string[] {
  return (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(prodType)
    ? PROD_V_SUBFOLDERS_WITH_PROPOSAL
    : PROD_V_SUBFOLDERS_WITHOUT_PROPOSAL;
}

export function getProdV0Paths(prodType: ProdType | string): string[] {
  const subs = getProdVSubfolders(prodType);
  return [
    `3-Production & Delivery/${prodType}/V0`,
    ...subs.map(sub => `3-Production & Delivery/${prodType}/V0/${sub}`),
  ];
}

export const PROD_V1_SUBFOLDERS = [
  'V0',
  ...PROD_V_SUBFOLDERS_WITH_PROPOSAL.map(s => `V0/${s}`),
];

export function getProdV1Paths(prodType: string): string[] {
  return getProdV0Paths(prodType as ProdType);
}

export const PROJECT_STRUCTURE_V2: string[] = [
  '1-Finalization',
  '1-Finalization/0-Project Closure Meeting  Tlines',
  '1-Finalization/1-Client Pre-Meet Tlines',
  '1-Finalization/2-Project info',
  '1-Finalization/2-Project info/1-Estimate & Design proposal',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/1-PDF',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/2-Randers',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/2-Randers/360',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/2-Randers/With Legend',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/2-Randers/Without Legend',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/3-CAD',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/4-SKP',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Design Proposal/5-LUMION',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Estimate',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Estimate/1-EXCEL',
  '1-Finalization/2-Project info/1-Estimate & Design proposal/Estimate/2-PDF',
  '1-Finalization/2-Project info/2-Dimension Plan',
  '1-Finalization/2-Project info/3-MatterPort',
  '1-Finalization/2-Project info/4-Images & Videos',
  '1-Finalization/2-Project info/5-Branding Requirements',
  '1-Finalization/2-Project info/5-Branding Requirements/1-IMAGE',
  '1-Finalization/2-Project info/5-Branding Requirements/1-IMAGE/1-ART WORK',
  '1-Finalization/2-Project info/5-Branding Requirements/2-PDF',
  '1-Finalization/2-Project info/5-Branding Requirements/3-AI',
  '1-Finalization/2-Project info/6-Equipment',
  '1-Finalization/3-First Project Meeting Tlines  Trust lines',
  '1-Finalization/4-Branding',
  '1-Finalization/4-Branding/V0',
  '1-Finalization/4-Branding/V0/1-IMAGE',
  '1-Finalization/4-Branding/V0/2-PDF',
  '1-Finalization/4-Branding/V0/3-AI',
  '1-Finalization/5-Plan Layout',
  '1-Finalization/5-Plan Layout/V0',
  '1-Finalization/5-Plan Layout/V0/CAD',
  '1-Finalization/5-Plan Layout/V0/PDF',
  '1-Finalization/6-Design Proposal',
  '1-Finalization/6-Design Proposal/V0',
  '1-Finalization/6-Design Proposal/V0/1-PDF',
  '1-Finalization/6-Design Proposal/V0/2-Randers',
  '1-Finalization/6-Design Proposal/V0/3-SKP',
  '1-Finalization/6-Design Proposal/V0/4-LUMION',

  '2-Construction Document',
  '2-Construction Document/0-Contractor Meeting',
  '2-Construction Document/1-Technical meeting Trust-Tlines',
  '2-Construction Document/2-Internal PM Meeting',
  '2-Construction Document/3-Construction Drawings',
  '2-Construction Document/3-Construction Drawings/V0',
  '2-Construction Document/3-Construction Drawings/V0/1-CAD',
  '2-Construction Document/3-Construction Drawings/V0/2-PDF',
  '2-Construction Document/4-Cut Sheets',
  '2-Construction Document/4-Cut Sheets/V0',
  '2-Construction Document/4-Cut Sheets/V0/EXCEL',
  '2-Construction Document/4-Cut Sheets/V0/PDF',

  '3-Production & Delivery',
];

export function designRootFromProjectRoot(projectRootPath: string): string | null {
  const m = projectRootPath.match(/^\/D-Projects\/(.*)$/i);
  if (!m) return null;
  return `/Design/${m[1]}`;
}

export const DESIGN_PROJECT_STRUCTURE: string[] = [
  '1-Plan Layout',
  '1-Plan Layout/1-PDF',
  '1-Plan Layout/2-CAD',
  '2-Estimate',
  '2-Estimate/1-EXCEL',
  '2-Estimate/2-PDF',
  '3-Design proposal',
  '3-Design proposal/Design Proposal',
  '3-Design proposal/Design Proposal/1-PDF',
  '3-Design proposal/Design Proposal/2-Randers',
  '3-Design proposal/Design Proposal/2-Randers/360',
  '3-Design proposal/Design Proposal/2-Randers/With Legend',
  '3-Design proposal/Design Proposal/2-Randers/Without Legend',
  '3-Design proposal/Design Proposal/3-CAD',
  '3-Design proposal/Design Proposal/4-SKP',
  '3-Design proposal/Design Proposal/5-LUMION',
  '4-Dimension Plan',
  '5-MatterPort',
  '6-Images & Videos',
  '7-Branding Requirements',
  '7-Branding Requirements/1-IMAGE',
  '7-Branding Requirements/1-IMAGE/1-ART WORK',
  '7-Branding Requirements/2-PDF',
  '7-Branding Requirements/3-AI',
  '8-Equipment',
];
