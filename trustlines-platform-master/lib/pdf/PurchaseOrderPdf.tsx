import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { PdfSection, PdfSignature, PdfCategory } from './PriceListPdf';

export const PO_SIGNATURE_BOXES = ['Accountant', 'NE Tlines Project Manager', 'Tlines General Manager', 'Project Management Supervisor'] as const;

export interface PurchaseOrderDocProps {
  catBadge:       string;
  clientName:     string;
  poNumber:       string;
  date:           string;
  projectName:    string;
  projectNumber:  string;
  typeLabel:      string;
  sections:       PdfSection[];
  logoBase64:     string;
  signatures?:    PdfSignature[];
}

const C = { code: 70, photo: 36, qty: 50, amount: 60, total: 64, taking: 88 };
const BORD = '#333';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 18, backgroundColor: '#fff', color: '#111' },
  outer: { borderWidth: 1, borderColor: BORD },

  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORD },
  logoCell: { flex: 1.5, padding: 10, justifyContent: 'center', borderRightWidth: 1, borderRightColor: BORD },
  logo: { width: 150, height: 44, objectFit: 'contain' },
  titleCell: { flex: 1 },
  poTitleBox: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: BORD, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', flex: 1 },
  poTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', letterSpacing: 0.5 },
  poCatBox: { backgroundColor: '#808080', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', flex: 1 },
  poCat: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#fff', letterSpacing: 1 },

  rowB: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORD },
  cellB: { borderRightWidth: 1, borderRightColor: BORD, paddingVertical: 4, paddingHorizontal: 8, justifyContent: 'center' },
  lblCell: { width: 90, backgroundColor: '#d9d9d9', borderRightWidth: 1, borderRightColor: BORD, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  lbl: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#333', textTransform: 'uppercase' },
  val: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111' },
  projNoBig: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#111' },

  otBar: { backgroundColor: '#c00000', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORD, flexDirection: 'row' },
  otKey: { width: 70, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'center', textTransform: 'uppercase' },
  otText: { flex: 1, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },

  catBar: { backgroundColor: '#111', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORD },
  catText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase' },
  segBar: { backgroundColor: '#7f7f7f', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORD },
  segText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' },

  thRow: { flexDirection: 'row', backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: BORD },
  thCell: { borderRightWidth: 1, borderRightColor: '#555', paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  thText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textTransform: 'uppercase', textAlign: 'center' },

  itemRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#bbb', minHeight: 30, alignItems: 'center' },
  tdCell: { borderRightWidth: 1, borderRightColor: '#bbb', paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center' },
  tdCode: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#111' },
  tdDescMain: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#1f3864' },
  tdDescNote: { fontSize: 6.5, textAlign: 'center', color: '#a33', fontStyle: 'italic', marginTop: 1 },
  tdNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  photo: { width: 24, height: 24, objectFit: 'cover', alignSelf: 'center' },

  totalRow: { flexDirection: 'row', backgroundColor: '#f5c518', borderTopWidth: 2, borderTopColor: '#111', minHeight: 22, alignItems: 'center' },

  sigSection: { marginTop: 16, flexDirection: 'row' },
  sigBox: { flex: 1, borderWidth: 1, borderColor: '#2255aa', borderRadius: 3, padding: 6, minHeight: 64, marginHorizontal: 4 },
  sigLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#2255aa', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center', marginBottom: 4 },
  sigLine: { width: '85%', borderBottomWidth: 1, borderBottomColor: '#333', height: 30, marginBottom: 2, alignSelf: 'center' },
});

function fmtMoney(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
            <View style={[s.thCell, { width: C.photo }]}><Text style={s.thText}>Photo</Text></View>
            <View style={[s.thCell, { width: C.qty }]}><Text style={s.thText}>Quantity</Text></View>
            <View style={[s.thCell, { width: C.amount }]}><Text style={s.thText}>Amount</Text></View>
            <View style={[s.thCell, { width: C.total }]}><Text style={s.thText}>Total</Text></View>
            <View style={[s.thCell, { width: C.taking, borderRightWidth: 0 }]}><Text style={s.thText}>Taking</Text></View>
          </View>
          {sub.groups.flatMap(g => g.items).map((item, ii) => {
            const rowTotal = (item.quantity || 0) * (item.unitPrice ?? 0);
            return (
              <View key={ii} style={s.itemRow}>
                <View style={[s.tdCell, { width: C.code }]}><Text style={s.tdCode}>{item.itemCode}</Text></View>
                <View style={[s.tdCell, { flex: 1 }]}>
                  <Text style={s.tdDescMain}>{item.description}</Text>
                  {!!item.descriptionNote && <Text style={s.tdDescNote}>{item.descriptionNote}</Text>}
                </View>
                <View style={[s.tdCell, { width: C.photo, alignItems: 'center' }]}>{item.photoBase64 ? <Image src={item.photoBase64} style={s.photo} /> : null}</View>
                <View style={[s.tdCell, { width: C.qty }]}><Text style={s.tdNum}>{item.quantity || ''}</Text></View>
                <View style={[s.tdCell, { width: C.amount }]}><Text style={s.tdNum}>{item.unitPrice != null ? fmtMoney(item.unitPrice) : ''}</Text></View>
                <View style={[s.tdCell, { width: C.total }]}><Text style={s.tdNum}>{rowTotal ? fmtMoney(rowTotal) : ''}</Text></View>
                <View style={[s.tdCell, { width: C.taking, borderRightWidth: 0 }]}><Text style={[s.tdNum, { fontSize: 7 }]}>{item.taking || ''}</Text></View>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

export function PurchaseOrderDocument({
  catBadge, clientName, poNumber, date, projectName, projectNumber, typeLabel,
  sections, logoBase64, signatures = [],
}: PurchaseOrderDocProps) {
  const getSig = (box: string) => signatures.find(g => g.box.toLowerCase() === box.toLowerCase()) ?? null;

  const pages = sections.length ? sections : [{ typeLabel, categories: [] }];

  const Header = () => (
    <>
      <View style={s.headerRow}>
        <View style={s.logoCell}><Image src={logoBase64} style={s.logo} /></View>
        <View style={s.titleCell}>
          <View style={s.poTitleBox}><Text style={s.poTitle}>PURCHASE ORDER</Text></View>
          <View style={s.poCatBox}><Text style={s.poCat}>{catBadge.toUpperCase()}</Text></View>
        </View>
      </View>
      <View style={s.rowB}>
        <View style={s.lblCell}><Text style={s.lbl}>To:</Text></View>
        <View style={[s.cellB, { flex: 1 }]}><Text style={s.val}>{clientName}</Text></View>
        <View style={[s.cellB, { width: 130, borderRightWidth: 0, alignItems: 'center' }]}><Text style={[s.val, { fontSize: 10 }]}>{date}</Text></View>
      </View>
      <View style={s.rowB}>
        <View style={s.lblCell}><Text style={s.lbl}>Po:</Text></View>
        <View style={[s.cellB, { flex: 1, borderRightWidth: 0 }]}><Text style={s.val}>{poNumber}</Text></View>
      </View>
      <View style={s.rowB}>
        <View style={s.lblCell}><Text style={s.lbl}>Project Name</Text></View>
        <View style={[s.cellB, { flex: 1 }]}><Text style={s.val}>{projectName}</Text></View>
        <View style={{ width: 130, borderRightWidth: 0 }}>
          <View style={[s.lblCell, { width: 130, paddingVertical: 2 }]}><Text style={[s.lbl, { fontSize: 6.5 }]}>Project Number</Text></View>
          <View style={{ alignItems: 'center', paddingVertical: 2 }}><Text style={s.projNoBig}>{projectNumber}</Text></View>
        </View>
      </View>
    </>
  );

  const Sigs = () => (
    <View style={s.sigSection}>
      {PO_SIGNATURE_BOXES.map(label => {
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
  );

  return (
    <Document>
      {pages.map((sec, pi) => {
        const items = sec.categories.flatMap(c => c.subCategories.flatMap(sb => sb.groups.flatMap(g => g.items)));
        const totalQty = items.reduce((a, i) => a + (i.quantity || 0), 0);
        const totalAmt = items.reduce((a, i) => a + (i.quantity || 0) * (i.unitPrice ?? 0), 0);
        return (
          <Page key={pi} size="A4" style={s.page}>
            <View style={s.outer}>
              <Header />
              <View style={s.otBar}>
                <Text style={s.otKey}>TYPE</Text>
                <Text style={s.otText}>{(sec.typeLabel || typeLabel || 'ITEMS')}</Text>
              </View>
              {sec.categories.map((cat, ci) => <ItemTable key={ci} cat={cat} />)}
              <View style={s.totalRow}>
                <View style={{ width: C.code + 30, alignItems: 'center' }}><Text style={[s.tdNum, { fontSize: 10 }]}>{totalQty}</Text></View>
                <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}><Text style={[s.tdNum, { fontSize: 10 }]}>TOTAL</Text></View>
                <View style={{ width: C.total + C.taking, alignItems: 'center' }}><Text style={[s.tdNum, { fontSize: 11 }]}>{fmtMoney(totalAmt)}</Text></View>
              </View>
            </View>
            <Sigs />
          </Page>
        );
      })}
    </Document>
  );
}
