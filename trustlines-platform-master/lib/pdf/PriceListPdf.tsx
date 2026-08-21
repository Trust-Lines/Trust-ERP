import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export interface PdfItem {
  itemCode:        string;
  description:     string;
  descriptionNote: string;
  photoBase64:     string | null;
  quantity:        number;
  unitPrice:       number | null;
  taking:          string;
  vendor:          string;
}

export interface PdfGroup {
  label: string;
  items: PdfItem[];
}

export interface PdfSubCategory {
  segmentName: string;
  groups:      PdfGroup[];
}

export interface PdfCategory {
  name:          string;
  subCategories: PdfSubCategory[];
}

export interface PdfSection {
  typeLabel:  string;
  categories: PdfCategory[];
}

export interface PdfSignature {
  box:        string;
  base64:     string;
  signerName: string;
  signedAt:   string;
}

export interface PriceListDocProps {
  projectName: string;
  projectCode: string;
  clientName:  string;
  date:        string;
  catBadge:    string;
  sections:    PdfSection[];
  showPrices:  boolean;
  logoBase64:  string;
  signatures?: PdfSignature[];
}

const C = {
  grp:    18,
  code:   68,
  photo:  24,
  qty:    36,
  amount: 54,
  total:  58,
  taking: 72,
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 9,
    paddingTop: 20, paddingBottom: 30, paddingLeft: 22, paddingRight: 22,
    backgroundColor: '#fff', color: '#111',
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: '#222' },
  logo: { width: 90, height: 32, objectFit: 'contain' },
  titleBlock: { flex: 1, alignItems: 'center' },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 3, textAlign: 'center', color: '#111' },
  catBadgeBox: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#555', color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textAlign: 'center', minWidth: 90 },

  infoTable: { flexDirection: 'row', borderWidth: 1, borderColor: '#555', marginBottom: 0 },
  infoLeft:  { flex: 1 },
  infoToRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#aaa' },
  infoToCell: { flex: 1, padding: '5px 8px', borderRightWidth: 1, borderRightColor: '#aaa' },
  infoDateCell: { width: 90, padding: '5px 8px', alignItems: 'flex-end', justifyContent: 'center' },
  infoProjNameRow: { padding: '5px 8px' },
  infoLabel: { fontSize: 6.5, color: '#888', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  projNameValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  infoRight: { width: 88, borderLeftWidth: 1, borderLeftColor: '#aaa', alignItems: 'center', justifyContent: 'flex-start', padding: '5px 4px' },
  projNoLabel: { fontSize: 6, color: '#888', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 4 },
  projNoBig: { fontSize: 28, fontFamily: 'Helvetica-Bold', backgroundColor: '#111', color: '#fff', paddingVertical: 6, paddingHorizontal: 6, width: '100%', textAlign: 'center' },

  typeRow: { backgroundColor: '#cc0000', flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  typeKey: { width: 44, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase' },
  typeVal: { flex: 1, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', textTransform: 'uppercase' },

  catHeader: { backgroundColor: '#111', paddingVertical: 5, paddingHorizontal: 8, marginTop: 2 },
  catHeaderText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  segHeader: { backgroundColor: '#444', paddingVertical: 3, paddingHorizontal: 8 },
  segHeaderText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 0.3, textTransform: 'uppercase' },

  tHead: { flexDirection: 'row', backgroundColor: '#333', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#111' },
  thCell: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textTransform: 'uppercase', textAlign: 'center' },

  itemRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', minHeight: 22, alignItems: 'center' },
  itemRowAlt: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', minHeight: 22, alignItems: 'center', backgroundColor: '#f8f8f8' },

  tdBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' },
  tdRed:  { fontSize: 7.5, fontFamily: 'Helvetica-BoldOblique', color: '#cc0000' },
  tdNote: { fontSize: 6.5, color: '#555', fontStyle: 'italic' },

  totalRow: { flexDirection: 'row', backgroundColor: '#f5c518', paddingVertical: 5, borderTopWidth: 2, borderTopColor: '#111', alignItems: 'center' },

  sigSection: { marginTop: 18 },
  sigRow: { flexDirection: 'row', marginBottom: 8 },
  sigBox: { flex: 1, borderWidth: 1, borderColor: '#2255aa', borderRadius: 3, padding: '6px 6px', minHeight: 70, marginHorizontal: 4 },
  sigLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#2255aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 4 },
  sigLine: { width: '80%', borderBottomWidth: 1, borderBottomColor: '#333', height: 28, marginBottom: 2, alignSelf: 'center' },
});

function fmtAmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ThCell({ width, flex, children }: { width?: number; flex?: number; children: string }) {
  const st = width ? { width } : { flex: flex ?? 1 };
  return (
    <View style={{ ...st, paddingHorizontal: 3, alignItems: 'center' as const }}>
      <Text style={s.thCell}>{children}</Text>
    </View>
  );
}

export function PriceListDocument({
  projectName, projectCode, clientName, date,
  catBadge, sections, showPrices, logoBase64, signatures = [],
}: PriceListDocProps) {
  function getSig(box: string) {
    return signatures.find(s => s.box.toLowerCase() === box.toLowerCase()) ?? null;
  }
  const projectNo = projectCode.split('-').pop() ?? projectCode;

  const allItems  = sections.flatMap(sec => sec.categories.flatMap(c => c.subCategories.flatMap(s => s.groups.flatMap(g => g.items))));
  const totalQty  = allItems.reduce((a, i) => a + i.quantity, 0);
  const totalAmt  = allItems.reduce((a, i) => a + i.quantity * (i.unitPrice ?? 0), 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerRow}>
          <Image style={s.logo} src={logoBase64} />
          <View style={s.titleBlock}>
            <Text style={s.docTitle}>{showPrices ? 'PRICE LIST' : 'ITEM LIST'}</Text>
          </View>
          <Text style={s.catBadgeBox}>{catBadge.toUpperCase()}</Text>
        </View>

        <View style={s.infoTable}>
          <View style={s.infoLeft}>
            <View style={s.infoToRow}>
              <View style={s.infoToCell}>
                <Text style={s.infoLabel}>To:</Text>
                <Text style={s.infoValue}>{clientName.toUpperCase()}</Text>
              </View>
              <View style={s.infoDateCell}>
                <Text style={[s.infoValue, { textAlign: 'right' }]}>{date}</Text>
              </View>
            </View>
            <View style={s.infoProjNameRow}>
              <Text style={s.infoLabel}>Project Name</Text>
              <Text style={s.projNameValue}>{projectName}</Text>
            </View>
          </View>
          <View style={s.infoRight}>
            <Text style={s.projNoLabel}>Project Number</Text>
            <Text style={s.projNoBig}>{projectNo}</Text>
          </View>
        </View>

        {sections.map((sec, si) => (
          <View key={si}>
            <View style={s.typeRow}>
              <Text style={s.typeKey}>TYPE</Text>
              <Text style={s.typeVal}>{sec.typeLabel.toUpperCase()}</Text>
            </View>

            {sec.categories.map((cat) => (
              <View key={cat.name + si}>
                <View style={s.catHeader}>
                  <Text style={s.catHeaderText}>{cat.name.toUpperCase()}</Text>
                </View>

                {cat.subCategories.map((sub, subI) => (
                  <View key={subI}>
                    {sub.segmentName ? (
                      <View style={s.segHeader}>
                        <Text style={s.segHeaderText}>{sub.segmentName.toUpperCase()}</Text>
                      </View>
                    ) : null}

                    <View style={s.tHead}>
                      <View style={{ width: C.grp }} />
                      <ThCell width={C.code}>Item Code</ThCell>
                      <ThCell flex={1}>Description</ThCell>
                      <ThCell width={C.photo}>Photo</ThCell>
                      <ThCell width={C.qty}>QTY</ThCell>
                      <ThCell width={C.amount}>Amount</ThCell>
                      <ThCell width={C.total}>Total</ThCell>
                      <ThCell width={C.taking}>Taking</ThCell>
                    </View>

                    {sub.groups.map((grp, gi) => (
                      <View key={gi} style={{ position: 'relative' }}>

                        <View style={{ marginLeft: C.grp }}>
                          {grp.items.map((item, ii) => {
                            const rowTotal = item.quantity * (item.unitPrice ?? 0);
                            return (
                              <View key={ii} style={ii % 2 === 1 ? s.itemRowAlt : s.itemRow}>
                                <View style={{ width: C.code, paddingHorizontal: 4 }}>
                                  <Text style={s.tdBold}>{item.itemCode}</Text>
                                </View>
                                <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2 }}>
                                  <Text style={s.tdRed}>{item.description}</Text>
                                  {item.descriptionNote ? <Text style={s.tdNote}>{item.descriptionNote}</Text> : null}
                                </View>
                                <View style={{ width: C.photo, alignItems: 'center', justifyContent: 'center' }}>
                                  {item.photoBase64
                                    ? <Image src={item.photoBase64} style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                    : <View style={{ width: 18, height: 18, backgroundColor: '#eee' }} />
                                  }
                                </View>
                                <View style={{ width: C.qty, alignItems: 'center' }}>
                                  <Text style={{ fontSize: 7.5, textAlign: 'center' }}>{item.quantity}</Text>
                                </View>
                                <View style={{ width: C.amount, alignItems: 'flex-end', paddingRight: 4 }}>
                                  <Text style={{ fontSize: 7.5, textAlign: 'right' }}>
                                    {showPrices && item.unitPrice != null ? `$ ${fmtAmt(item.unitPrice)}` : ''}
                                  </Text>
                                </View>
                                <View style={{ width: C.total, alignItems: 'flex-end', paddingRight: 4 }}>
                                  <Text style={{ fontSize: 7.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                                    {showPrices && rowTotal > 0 ? `$ ${fmtAmt(rowTotal)}` : ''}
                                  </Text>
                                </View>
                                <View style={{ width: C.taking, alignItems: 'center' }}>
                                  <Text style={{ fontSize: 7, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: '#444', textTransform: 'uppercase' }}>
                                    {item.taking}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>

                        <View style={{
                          position: 'absolute', top: 0, left: 0, bottom: 0, width: C.grp,
                          backgroundColor: '#f0f0f0',
                          borderRightWidth: 1, borderRightColor: '#ddd',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {grp.label ? (
                            <Text style={{
                              fontSize: 6.5, fontFamily: 'Helvetica-Bold',
                              color: '#444', letterSpacing: 0.3,
                              transform: 'rotate(-90deg)',
                            }}>
                              {grp.label.toUpperCase()}
                            </Text>
                          ) : null}
                        </View>

                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        <View style={s.totalRow}>
          <View style={{ width: C.grp }} />
          <Text style={{ flex: 1, paddingLeft: 6, fontFamily: 'Helvetica-Bold', fontSize: 9 }}>TOTAL</Text>
          <Text style={{ width: C.qty, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{totalQty}</Text>
          <View style={{ width: C.amount }} />
          <Text style={{ width: C.total, textAlign: 'right', paddingRight: 4, fontFamily: 'Helvetica-Bold', fontSize: 9 }}>
            {showPrices ? `$ ${fmtAmt(totalAmt)}` : ''}
          </Text>
          <View style={{ width: C.taking }} />
        </View>

        <View style={s.sigSection}>
          <View style={s.sigRow}>
            {['Production Manager', 'Trust PM', 'Client PM'].map(label => {
              const sig = getSig(label);
              return (
                <View key={label} style={s.sigBox}>
                  <Text style={s.sigLabel}>{label}</Text>
                  {sig
                    ? <Image src={sig.base64} style={{ height: 50, width: '94%', objectFit: 'contain', alignSelf: 'center' }} />
                    : <View style={s.sigLine} />
                  }
                  {sig && <Text style={{ fontSize: 6, color: '#444', textAlign: 'center', marginTop: 2 }}>{sig.signerName}</Text>}
                </View>
              );
            })}
          </View>
        </View>

      </Page>
    </Document>
  );
}
