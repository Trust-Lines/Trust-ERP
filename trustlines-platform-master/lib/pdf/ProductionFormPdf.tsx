import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { PdfSection, PdfSignature, PdfCategory } from './PriceListPdf';

export const PF_SIGNATURE_BOXES = ['Production Manager', 'Project Manager', 'General Manager', 'Accountant'] as const;

export const PF_SIGNER_ROLE: Record<string, string> = {
  'Production Manager': 'production_manager',
  'Project Manager':    'project_manager',
  'General Manager':    'general_manager',
  'Accountant':         'accountant',
};

export interface ProductionFormDocProps {
  catBadge:        string;
  supplierName:    string;
  orderNo:         string;
  date:            string;
  projectNumber:   string;
  projectName:     string;
  clientName:      string;
  poNumber:        string;
  orderTypeLabel:  string;
  sections:        PdfSection[];
  logoBase64:      string;
  signatures?:     PdfSignature[];
}

const C = { code: 84, pic: 32, qty: 54, price: 78, total: 78 };
const BORD = '#333';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 18, backgroundColor: '#fff', color: '#111' },
  outer: { borderWidth: 1, borderColor: BORD },

  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORD },
  logoCell: { flex: 1.5, padding: 10, justifyContent: 'center', borderRightWidth: 1, borderRightColor: BORD },
  logo: { width: 150, height: 44, objectFit: 'contain' },
  titleCell: { flex: 1 },
  pfTitleBox: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: BORD, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  pfTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', letterSpacing: 0.5 },
  pfCatBox: { backgroundColor: '#808080', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  pfCat: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#fff', letterSpacing: 1 },

  grayHdr: { backgroundColor: '#808080' },
  grayHdrText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowB: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORD },
  cellB: { borderRightWidth: 1, borderRightColor: BORD, paddingVertical: 4, paddingHorizontal: 8, justifyContent: 'center' },
  val: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },

  thinBar: { backgroundColor: '#808080', paddingVertical: 1.5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORD },
  thinBarText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 6, textTransform: 'uppercase' },

  projNoBig: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#111' },

  otBar: { backgroundColor: '#c00000', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORD },
  otText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },

  catBar: { backgroundColor: '#111', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORD },
  catText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.3 },

  segBar: { backgroundColor: '#595959', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORD },
  segText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3 },

  thRow: { flexDirection: 'row', backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: BORD },
  thCell: { borderRightWidth: 1, borderRightColor: '#555', paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  thText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textTransform: 'uppercase', textAlign: 'center' },

  itemRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#bbb', minHeight: 30, alignItems: 'center' },
  tdCell: { borderRightWidth: 1, borderRightColor: '#bbb', paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center' },
  tdCode: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#111' },
  tdDescMain: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#1f3864' },
  tdDescNote: { fontSize: 6.5, textAlign: 'center', color: '#333', marginTop: 1 },
  tdNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  photo: { width: 24, height: 24, objectFit: 'cover', alignSelf: 'center' },

  sigSection: { marginTop: 14, flexDirection: 'row' },
  sigBox: { flex: 1, borderWidth: 1, borderColor: '#2255aa', borderRadius: 3, padding: 6, minHeight: 60, marginHorizontal: 3 },
  sigLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#2255aa', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center', marginBottom: 4 },
  sigLine: { width: '85%', borderBottomWidth: 1, borderBottomColor: '#333', height: 26, marginBottom: 2, alignSelf: 'center' },
});

function fmtMoney(n: number) {
  return `$${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ItemTable({ cat }: { cat: PdfCategory }) {
  return (
    <>
      <View style={s.catBar}><Text style={s.catText}>{cat.name || 'ITEMS'}</Text></View>
      {cat.subCategories.map((sub, sbi) => (
        <View key={sbi}>
          {!!sub.segmentName && <View style={s.segBar}><Text style={s.segText}>{sub.segmentName}</Text></View>}
          <View style={s.thRow}>
            <View style={[s.thCell, { width: C.code }]}><Text style={s.thText}>Item Code</Text></View>
            <View style={[s.thCell, { flex: 1 }]}><Text style={s.thText}>Description</Text></View>
            <View style={[s.thCell, { width: C.pic }]}><Text style={s.thText}>Pic</Text></View>
            <View style={[s.thCell, { width: C.qty }]}><Text style={s.thText}>Quantity</Text></View>
            <View style={[s.thCell, { width: C.price }]}><Text style={s.thText}>Price</Text></View>
            <View style={[s.thCell, { width: C.total, borderRightWidth: 0 }]}><Text style={s.thText}>Total</Text></View>
          </View>
          {sub.groups.flatMap(g => g.items).map((item, ii) => {
            const rowTotal = (item.quantity || 0) * (item.unitPrice ?? 0);
            return (
              <View key={ii} style={s.itemRow}>
                <View style={[s.tdCell, { width: C.code }]}><Text style={s.tdCode}>{item.itemCode}</Text></View>
                <View style={[s.tdCell, { flex: 1 }]}>
                  <Text style={s.tdDescMain}>{item.description}</Text>
                  {!!item.descriptionNote && <Text style={s.tdDescNote}>({item.descriptionNote})</Text>}
                </View>
                <View style={[s.tdCell, { width: C.pic, alignItems: 'center' }]}>
                  {item.photoBase64 ? <Image src={item.photoBase64} style={s.photo} /> : null}
                </View>
                <View style={[s.tdCell, { width: C.qty }]}><Text style={s.tdNum}>{item.quantity || ''}</Text></View>
                <View style={[s.tdCell, { width: C.price }]}><Text style={s.tdNum}>{item.unitPrice != null ? fmtMoney(item.unitPrice) : ''}</Text></View>
                <View style={[s.tdCell, { width: C.total, borderRightWidth: 0 }]}><Text style={s.tdNum}>{rowTotal ? fmtMoney(rowTotal) : ''}</Text></View>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

export function ProductionFormDocument({
  catBadge, supplierName, orderNo, date, projectNumber, projectName, clientName, poNumber,
  orderTypeLabel, sections, logoBase64, signatures = [],
}: ProductionFormDocProps) {
  const getSig = (box: string) => signatures.find(g => g.box.toLowerCase() === box.toLowerCase()) ?? null;
  const categories = sections.flatMap(sec => sec.categories);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.outer}>
          <View style={s.headerRow}>
            <View style={s.logoCell}><Image src={logoBase64} style={s.logo} /></View>
            <View style={s.titleCell}>
              <View style={s.pfTitleBox}><Text style={s.pfTitle}>PRODUCTION FORM</Text></View>
              <View style={s.pfCatBox}><Text style={s.pfCat}>{catBadge.toUpperCase()}</Text></View>
            </View>
          </View>

          <View style={s.rowB}>
            <View style={[s.cellB, s.grayHdr, { flex: 1 }]}><Text style={s.grayHdrText}>Supplier Info</Text></View>
            <View style={[s.cellB, s.grayHdr, { width: 150, alignItems: 'center' }]}><Text style={s.grayHdrText}>Order No:</Text></View>
            <View style={[s.cellB, s.grayHdr, { width: 110, alignItems: 'center', borderRightWidth: 0 }]}><Text style={s.grayHdrText}>Date</Text></View>
          </View>
          <View style={s.rowB}>
            <View style={[s.cellB, { flex: 1 }]}><Text style={s.val}>{supplierName}</Text></View>
            <View style={[s.cellB, { width: 150, alignItems: 'center', backgroundColor: '#d9d9d9' }]}><Text style={s.val}>{orderNo}</Text></View>
            <View style={[s.cellB, { width: 110, alignItems: 'center', borderRightWidth: 0 }]}><Text style={s.val}>{date}</Text></View>
          </View>

          <View style={s.thinBar}><Text style={s.thinBarText}>Project Info</Text></View>
          <View style={s.rowB}>
            <View style={{ width: 90, borderRightWidth: 1, borderRightColor: BORD }}>
              <View style={[s.grayHdr, { paddingVertical: 2, alignItems: 'center' }]}><Text style={s.grayHdrText}>Project Number</Text></View>
              <View style={{ paddingVertical: 4, alignItems: 'center' }}><Text style={s.projNoBig}>{projectNumber}</Text></View>
            </View>
            <View style={[s.cellB, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: '#333' }}>Client : <Text style={{ fontFamily: 'Helvetica-Bold' }}>{clientName}</Text></Text>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 3 }}>{projectName}</Text>
            </View>
            <View style={{ width: 110, borderRightWidth: 0 }}>
              <View style={[s.grayHdr, { paddingVertical: 2, alignItems: 'center' }]}><Text style={s.grayHdrText}>PO Number</Text></View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}><Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>{poNumber}</Text></View>
            </View>
          </View>

          <View style={s.otBar}><Text style={s.otText}>{orderTypeLabel || 'ITEMS'}</Text></View>

          {categories.map((cat, ci) => <ItemTable key={ci} cat={cat} />)}
        </View>

        <View style={s.sigSection}>
          {PF_SIGNATURE_BOXES.map(label => {
            const sig = getSig(label);
            return (
              <View key={label} style={s.sigBox}>
                <Text style={s.sigLabel}>{label}</Text>
                {sig
                  ? <Image src={sig.base64} style={{ height: 40, width: '90%', objectFit: 'contain', alignSelf: 'center' }} />
                  : <View style={s.sigLine} />}
                {sig && <Text style={{ fontSize: 6, color: '#444', textAlign: 'center', marginTop: 2 }}>{sig.signerName}</Text>}
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
