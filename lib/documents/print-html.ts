import type { DocumentKind } from "@/lib/documents-firestore-types";
import { amountToThaiBahtText } from "./thai-baht-text";
import type { CompanyBrand } from "./brand";
import {
  type CommercialDocumentMeta,
  type DocumentLineItem,
  DOCUMENT_KIND_ROUTES,
  type WithholdingDocumentMeta,
} from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(s: string): number {
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

function formatDateThaiBE(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function docFooterHtml(issuedByName?: string): string {
  const name = (issuedByName ?? "").trim() || "—";
  return `<div class="doc-footer">เอกสารออกโดยระบบ HYEV โดย ${esc(name)}</div>`;
}

function logoImgHtml(logoUrl: string): string {
  if (!logoUrl) return "";
  return `<img src="${esc(logoUrl)}" alt="Hatyai EV" referrerpolicy="no-referrer"/>`;
}

export type DocumentPrintAssetOptions = {
  /** ใส่ลายเซ็นบริษัทตอนพิมพ์ (ค่าเริ่มต้น true) */
  includeSignature?: boolean;
  /** ใส่ตรายางบริษัทตอนพิมพ์ (ค่าเริ่มต้น true) */
  includeStamp?: boolean;
};

export function normalizePrintAssetOptions(
  opts?: DocumentPrintAssetOptions,
): { includeSignature: boolean; includeStamp: boolean } {
  return {
    includeSignature: opts?.includeSignature === true,
    includeStamp: opts?.includeStamp === true,
  };
}

export const DOCUMENT_PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: "Sarabun", "Tahoma", sans-serif; font-size: 11pt; color: #111; margin: 0; }
.doc { border: 2px solid #111; padding: 10px 12px; min-height: 260mm; display: flex; flex-direction: column; }
/* หัวเอกสาร: โลโก้ซ้าย · ชื่อ/ที่อยู่บริษัทชิดขวา ไม่ทับกัน */
.hdr {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 16px;
  align-items: start;
  border-bottom: 2px solid #111;
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.logo { width: 150px; }
.logo img { max-width: 140px; max-height: 88px; object-fit: contain; display: block; }
.co { text-align: right; font-size: 10pt; line-height: 1.4; }
.co strong { display: block; font-size: 12pt; color: #1d4ed8; margin-bottom: 2px; }
.title { text-align: center; margin: 6px 0 10px; }
.title h1 { margin: 0; font-size: 18pt; }
.title .en { color: #1d4ed8; font-size: 13pt; font-weight: bold; margin-top: 2px; }
.party { display: grid; grid-template-columns: 1fr 220px; gap: 8px; margin-bottom: 8px; font-size: 10pt; }
.party label { color: #333; }
.meta-r { text-align: right; }
table.items { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
table.items th, table.items td { border: 1px solid #111; padding: 4px 6px; vertical-align: top; }
table.items th { background: #f1f5f9; text-align: center; }
.num { text-align: right; white-space: nowrap; }
.cen { text-align: center; }
.footer { display: grid; grid-template-columns: 1fr 240px; gap: 10px; margin-top: 8px; font-size: 10pt; }
.totals table { width: 100%; border-collapse: collapse; }
.totals td { border: 1px solid #111; padding: 4px 8px; }
.totals td.lbl { background: #f8fafc; }
.totals td.val { text-align: right; font-weight: 600; }
.words { margin-top: 6px; font-size: 10pt; }
.pay-chk { margin: 4px 0; }
.doc-footer { margin-top: auto; padding-top: 16px; text-align: right; font-size: 9.5pt; color: #333; }
.wht-grid { font-size: 10pt; }
.wht-grid .row { display: grid; grid-template-columns: 140px 1fr; gap: 4px; margin: 3px 0; }
.wht-section { border: 1px solid #111; padding: 8px; margin: 6px 0; }
.sign-block { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; font-size: 10pt; text-align: center; }
.sign-cell { position: relative; min-height: 120px; }
/* ตรายางกับลายเซ็นแยกกัน — ไม่ซ้อนทับ */
.sign-assets {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  min-height: 72px;
  margin-bottom: 4px;
}
.sign-assets .stamp { position: static; max-height: 64px; max-width: 72px; opacity: 0.9; }
.sign-assets .sig { position: static; max-height: 52px; max-width: 140px; }
.sign-line { border-top: 1px solid #111; padding-top: 6px; margin-top: 4px; }
@media print { .no-print { display: none !important; } }
`;

export function companySignBlockHtml(opts: {
  signatureUrl?: string;
  stampUrl?: string;
  leftLabel?: string;
  rightLabel?: string;
  companyName?: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
}): string {
  const leftLabel = opts.leftLabel ?? "ผู้รับเอกสาร";
  const rightLabel = opts.rightLabel ?? "ผู้มีอำนาจลงนาม";
  const assets = normalizePrintAssetOptions(opts);
  const stamp =
    assets.includeStamp && opts.stampUrl
      ? `<img class="stamp" src="${esc(opts.stampUrl)}" alt="stamp"/>`
      : "";
  const sig =
    assets.includeSignature && opts.signatureUrl
      ? `<img class="sig" src="${esc(opts.signatureUrl)}" alt="signature"/>`
      : "";
  const company = opts.companyName
    ? `<div style="font-size:9pt;margin-top:2px">${esc(opts.companyName)}</div>`
    : "";

  return `<div class="sign-block">
    <div class="sign-cell">
      <div class="sign-assets"></div>
      <div class="sign-line">${esc(leftLabel)}</div>
    </div>
    <div class="sign-cell">
      <div class="sign-assets">${stamp}${sig}</div>
      <div class="sign-line">${esc(rightLabel)}${company}</div>
    </div>
  </div>`;
}

export function buildCommercialPrintHtml(opts: {
  kind: DocumentKind;
  company: CompanyBrand;
  number: string;
  issueDate: Date;
  lines: DocumentLineItem[];
  meta: CommercialDocumentMeta;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  notes: string;
  issuedByName?: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
}): string {
  const route = DOCUMENT_KIND_ROUTES[opts.kind];
  const m = opts.meta;
  const assets = normalizePrintAssetOptions(opts);
  const lineRows = opts.lines
    .filter((l) => l.description.trim() || parseNum(l.amount) > 0)
    .map(
      (l, i) => `<tr>
      <td class="cen">${i + 1}</td>
      <td>${esc(l.code)}</td>
      <td>${esc(l.description).replace(/\n/g, "<br/>")}</td>
      <td class="num">${esc(fmt(parseNum(l.unitPrice)))}</td>
      <td class="cen">${esc(l.quantity)}</td>
      <td class="num">${esc(fmt(parseNum(l.amount)))}</td>
    </tr>`,
    )
    .join("");

  const payMethod = m.paymentMethod ?? "TRANSFER";
  const chequeDetail =
    payMethod === "CHEQUE"
      ? [
          m.chequeBankName ? `ธนาคาร ${m.chequeBankName}` : "",
          m.chequeNo ? `เลขที่ ${m.chequeNo}` : "",
          m.chequeDate ? `วันที่ ${m.chequeDate}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
  const payBlock =
    opts.kind === "RECEIPT"
      ? `<div class="pay-chk">
      <div>การรับเงินจะสมบูรณ์ เมื่อบริษัทฯ ได้รับเงินเรียบร้อยแล้วเท่านั้น</div>
      <div>${payMethod === "CASH" ? "☑" : "☐"} เงินสด &nbsp; ${payMethod === "TRANSFER" ? "☑" : "☐"} โอน ธนาคาร &nbsp; ${payMethod === "CHEQUE" ? "☑" : "☐"} เช็ค${chequeDetail ? ` ${esc(chequeDetail)}` : ""}</div>
    </div>`
      : opts.kind === "INVOICE"
        ? `<div class="pay-chk">
      <div>การรับเงินจะสมบูรณ์ เมื่อบริษัทฯ ได้รับเงินเรียบร้อยแล้วเท่านั้น</div>
      <div>${esc(m.bankAccountText ?? "")}</div>
      <div>เมื่อชำระเงินแล้ว กรุณาแจ้งเพื่อออกใบเสร็จรับเงิน/ใบกำกับภาษี</div>
    </div>`
        : `<div>${esc(opts.notes)}</div>`;

  const branchLine = m.counterpartyBranchHeadOffice
    ? "☑ สำนักงานใหญ่ ☐ สาขา"
    : `☐ สำนักงานใหญ่ ☑ สาขา ${esc(m.counterpartyBranchNo)}`;

  const totalsRows =
    opts.kind === "RECEIPT"
      ? `<tr><td class="lbl">รวม Total</td><td class="val">${fmt(opts.totalAmount)}</td></tr>
      <tr><td class="lbl"><strong>เป็นเงินทั้งสิ้น Grand Total</strong></td><td class="val"><strong>${fmt(opts.totalAmount)}</strong></td></tr>`
      : `<tr><td class="lbl">รวม Total</td><td class="val">${fmt(opts.subtotal)}</td></tr>
      <tr><td class="lbl">ภาษีมูลค่าเพิ่ม ${m.vatRatePercent ?? 7}%</td><td class="val">${fmt(opts.vatAmount)}</td></tr>
      <tr><td class="lbl"><strong>เป็นเงินทั้งสิ้น Grand Total</strong></td><td class="val"><strong>${fmt(opts.totalAmount)}</strong></td></tr>`;

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || route.titleTh)}</title>
<style>${DOCUMENT_PRINT_CSS}</style></head><body>
<div class="doc">
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co">
      <strong>${esc(opts.company.companyName)}</strong>
      ${esc(opts.company.address).replace(/\n/g, "<br/>")}<br/>
      โทร. ${esc(opts.company.phone)} · เลขประจำตัวผู้เสียภาษี ${esc(opts.company.taxId)}
    </div>
  </div>
  <div class="title">
    <h1>${esc(route.titleTh)}</h1>
    <div class="en">${esc(route.titleEn)}</div>
  </div>
  <div class="party">
    <div>
      <div><label>ชื่อลูกค้า Customer:</label> ${esc(m.counterpartyName)}</div>
      <div><label>ที่อยู่ลูกค้า Customer:</label> ${esc(m.counterpartyAddress).replace(/\n/g, " ")}</div>
      <div><label>เบอร์ติดต่อ Contact Mobile:</label> ${esc(m.counterpartyPhone)}</div>
      <div><label>เลขประจำตัวผู้เสียภาษี Tax ID:</label> ${esc(m.counterpartyTaxId)}</div>
      <div>${branchLine}</div>
    </div>
    <div class="meta-r">
      <div><label>เลขที่ Document No.:</label> <strong>${esc(opts.number || "—")}</strong></div>
      <div><label>วันที่ Date:</label> ${esc(formatDateThaiBE(opts.issueDate))}</div>
    </div>
  </div>
  <table class="items">
    <thead><tr>
      <th style="width:36px">ลำดับ<br/>No.</th>
      <th style="width:56px">รหัส<br/>Code</th>
      <th>รายละเอียด<br/>Description</th>
      <th style="width:80px">ราคา/หน่วย<br/>Unit Price</th>
      <th style="width:48px">จำนวน<br/>Qty.</th>
      <th style="width:88px">ราคารวม<br/>Amount</th>
    </tr></thead>
    <tbody>${lineRows}${lineRows ? "" : '<tr><td colspan="6" class="cen">—</td></tr>'}</tbody>
  </table>
  <div class="footer">
    <div>${payBlock}<div class="words">Grand Total in Word: ${esc(amountToThaiBahtText(opts.totalAmount))}</div></div>
    <div class="totals"><table>
      ${totalsRows}
    </table></div>
  </div>
  ${docFooterHtml(opts.issuedByName ?? m.issuedByName)}
  ${companySignBlockHtml({
    signatureUrl: opts.company.signatureUrl,
    stampUrl: opts.company.stampUrl,
    companyName: opts.company.companyName,
    leftLabel: "ผู้รับเอกสาร / ลูกค้า",
    rightLabel: "ผู้มีอำนาจลงนาม",
    includeSignature: assets.includeSignature,
    includeStamp: assets.includeStamp,
  })}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

/** ฉบับพิมพ์หนังสือรับรองหัก ณ ที่จ่าย — ตามแบบ OPEC ม.50 ทวิ */
export type HyevWhtCopyVariant =
  | "COPY_PAYEE_TAX_RETURN"
  | "COPY_PAYEE_RECORD"
  | "COPY_PAYER_RECORD";

const HYEV_WHT_COPY_VARIANTS: HyevWhtCopyVariant[] = [
  "COPY_PAYEE_TAX_RETURN",
  "COPY_PAYEE_RECORD",
  "COPY_PAYER_RECORD",
];

function whtCopyBannerTh(v: HyevWhtCopyVariant): string {
  switch (v) {
    case "COPY_PAYEE_TAX_RETURN":
      return "ฉบับที่ 1 สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบแบบแสดงรายการภาษี";
    case "COPY_PAYEE_RECORD":
      return "ฉบับที่ 2 สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน";
    case "COPY_PAYER_RECORD":
      return "สำเนาสำหรับผู้หักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน";
    default:
      return "";
  }
}

function paymentMethodLabelTh(method: string): string {
  if (method === "CASH") return "เงินสด";
  if (method === "CHEQUE") return "เช็ค";
  if (method === "TRANSFER") return "โอนเงิน";
  return method || "อื่น ๆ";
}

function whtIncomeTypeChecks(label: string): string {
  const t = label.trim();
  const goods =
    /ค่าจ้างทำของ|ค่าแรง|ทำของ/i.test(t) && !/บริการ|เหมา/i.test(t);
  const service = /ค่าจ้างเหมา|ค่าบริการ|บริการ|เหมา/i.test(t);
  const other = !goods && !service && Boolean(t);
  const bothLabor = /ค่าจ้างทำของ.*ค่าแรง|ค่าแรง.*ค่าบริการ|ค่าจ้างทำของ\s*\/\s*ค่า/i.test(t);
  const g = goods || bothLabor || (!service && !other && /ค่าจ้างทำของ|ค่าแรง/i.test(t));
  const s = service || bothLabor;
  return `${g ? "☑" : "☐"} ค่าจ้างทำของ / ค่าแรง &nbsp; ${s ? "☑" : "☐"} ค่าจ้างเหมา / ค่าบริการ${
    other ? ` &nbsp; ☑ อื่น ๆ (${esc(t)})` : ""
  }`;
}

function buildWithholdingCopyPageHtml(opts: {
  company: CompanyBrand;
  number: string;
  issueDate: Date;
  meta: WithholdingDocumentMeta;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  withholdingAmount: number;
  issuedByName?: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
  copyVariant: HyevWhtCopyVariant;
}): string {
  const m = opts.meta;
  const assets = normalizePrintAssetOptions(opts);
  const base = parseNum(m.withholdingTaxBase) || opts.subtotal;
  const rate = parseNum(m.withholdingTaxRatePercent) || 0;
  const wht = opts.withholdingAmount || (base * rate) / 100;
  const forceNoVat =
    m.payeeEntityKind === "INDIVIDUAL" ||
    String(m.vatRatePercent ?? "") === "0" ||
    m.payeeEntityKind !== "COMPANY";
  const vatAmount = forceNoVat ? 0 : opts.vatAmount;
  const showVat = !forceNoVat && vatAmount > 0;
  const amountBeforeVat = base;
  const gross = showVat ? opts.totalAmount || base + vatAmount : base;
  const net = Math.max(0, gross - wht);
  const payDate = m.paymentDate
    ? formatDateThaiBE(new Date(m.paymentDate))
    : formatDateThaiBE(opts.issueDate);
  const issueDateDisp = formatDateThaiBE(opts.issueDate);
  const payeeIsIndividual = m.payeeEntityKind === "INDIVIDUAL";
  const payeeIsHead = m.payeeBranchHeadOffice !== false;
  const payeeCategory = payeeIsIndividual ? "บุคคลธรรมดา" : "นิติบุคคล (ในประเทศ)";
  const incomeLabel = m.incomeTypeLabel || "ค่าจ้างทำของ / ค่าแรง";
  const banner = whtCopyBannerTh(opts.copyVariant);
  const whtWords = amountToThaiBahtText(wht);
  const stamp =
    assets.includeStamp && opts.company.stampUrl
      ? `<img class="wht-sign-img" src="${esc(opts.company.stampUrl)}" alt="stamp"/>`
      : "";
  const sig =
    assets.includeSignature && opts.company.signatureUrl
      ? `<img class="wht-sign-img" src="${esc(opts.company.signatureUrl)}" alt="signature"/>`
      : "";
  const issuedBy = (opts.issuedByName ?? m.issuedByName ?? "").trim() || "—";

  return `<div class="wht-print-page">
  <div class="copy-banner">${esc(banner)}</div>
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co">
      <strong>${esc(opts.company.companyName)}</strong>
      ${esc(opts.company.address).replace(/\n/g, "<br/>")}<br/>
      โทร. ${esc(opts.company.phone)} · เลขประจำตัวผู้เสียภาษี ${esc(opts.company.taxId)}
    </div>
  </div>
  <div class="doc-top">
    <div class="doc-title-wrap">
      <h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
      <p class="sub">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>
    </div>
    <div class="doc-meta">
      <div><strong>เลขที่</strong> ${esc(opts.number || "—")}</div>
      <div><strong>วันที่ออกหนังสือรับรอง</strong><br/>${esc(issueDateDisp)}</div>
      <div><strong>วันที่จ่ายเงิน</strong><br/>${esc(payDate)}</div>
    </div>
  </div>

  <div class="sec">1. ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
  <div class="field">ชื่อบริษัท/ห้าง: ${esc(opts.company.companyName)}</div>
  <div class="field">เลขประจำตัวผู้เสียภาษี: ${esc(opts.company.taxId)}</div>
  <div class="field">ประเภทผู้เสียภาษี: นิติบุคคล</div>
  <div class="field">ที่อยู่: ${esc(opts.company.address)}</div>
  ${opts.company.phone || opts.company.email ? `<div class="field">โทรศัพท์ / อีเมล: ${esc([opts.company.phone, opts.company.email].filter(Boolean).join(" · "))}</div>` : ""}
  <div class="field">สาขา: ☑ สำนักงานใหญ่ &nbsp; ☐ สาขาเลขที่ __________</div>

  <div class="sec">2. ผู้ถูกหักภาษี ณ ที่จ่าย / คู่ค้า / ผู้รับจ้าง</div>
  <div class="field">ชื่อบุคคล/บริษัท/ห้าง: ${esc(m.payeeName || "—")}</div>
  <div class="field">เลขประจำตัวผู้เสียภาษี: ${esc(m.payeeTaxId || "—")}</div>
  <div class="field">ประเภทคู่ค้า: ${esc(payeeCategory)}</div>
  <div class="field">ที่อยู่: ${esc(m.payeeAddress || "—")}</div>
  ${
    payeeIsIndividual
      ? ""
      : `<div class="field">สาขา: ${payeeIsHead ? "☑" : "☐"} สำนักงานใหญ่ &nbsp; ${payeeIsHead ? "☐" : "☑"} สาขาเลขที่ ${esc(!payeeIsHead && m.payeeBranchNo ? m.payeeBranchNo : "__________")}</div>`
  }

  <div class="sec">3. รายละเอียดการจ่ายเงิน</div>
  <div class="field">ประเภทเงินได้: ${whtIncomeTypeChecks(incomeLabel)}</div>
  <div class="field">รายละเอียดงาน / บริการ: ${esc(m.jobDescription || "—")}</div>
  <div class="field">วิธีชำระเงิน: ${esc(paymentMethodLabelTh(m.paymentMethod))}</div>
  ${m.referenceNo ? `<div class="field">อ้างอิง / เลขที่อ้างอิง: ${esc(m.referenceNo)}</div>` : ""}

  <table class="amounts" aria-label="ยอดเงิน">
    <tr><td>${showVat ? "จำนวนเงินค่าจ้างก่อน VAT" : "จำนวนเงินที่จ่าย (ฐานหัก)"}</td><td>${fmt(amountBeforeVat)} บาท</td></tr>
    ${showVat ? `<tr><td>VAT 7%</td><td>${fmt(vatAmount)} บาท</td></tr>` : ""}
    ${showVat ? `<tr><td><strong>ยอดรวม (รวม VAT)</strong></td><td><strong>${fmt(gross)} บาท</strong></td></tr>` : ""}
    <tr><td>ฐานภาษีหัก ณ ที่จ่าย</td><td>${fmt(base)} บาท</td></tr>
    <tr><td>อัตราภาษีหัก ณ ที่จ่าย ${esc(String(rate))} % เป็นเงินที่หักไว้</td><td>${fmt(wht)} บาท</td></tr>
    <tr><td><strong>ยอดเงินสุทธิที่จ่ายให้คู่ค้า</strong></td><td><strong>${fmt(net)} บาท</strong></td></tr>
  </table>

  <div class="field">ตัวอักษรจำนวนภาษีที่หักไว้: ${esc(whtWords)}</div>

  <div class="sec">4. เงื่อนไขการหักภาษี</div>
  <div class="checkbox-row">☑ หัก ณ ที่จ่าย</div>
  <div class="checkbox-row">☐ ออกภาษีให้ตลอดไป</div>
  <div class="checkbox-row">☐ ออกภาษีให้ครั้งเดียว</div>
  <div class="checkbox-row">☐ อื่น ๆ: _____________________________</div>

  <div class="sec">5. ผู้จ่ายเงิน / ผู้รับรอง</div>
  <div class="certify-block">ข้าพเจ้าขอรับรองว่า ข้อความและตัวเลขข้างต้นถูกต้องตรงตามความเป็นจริงทุกประการ</div>
  <div class="sign-grid">
    <div class="sign-cell">
      <div class="sign-space"></div>
      <div class="sign-line">ผู้ถูกหักภาษี ณ ที่จ่าย</div>
      <div class="muted">${esc(m.payeeName || "")}</div>
    </div>
    <div class="sign-cell">
      <div class="sign-space">${stamp}${sig}</div>
      <div class="sign-line">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
      <div class="muted">${esc(opts.company.companyName)}</div>
    </div>
  </div>

  <p class="footer-sys">
    เอกสารออกโดยระบบ HYEV โดย ${esc(issuedBy)}
  </p>
</div>`;
}

/** หนังสือรับรองหัก ณ ที่จ่าย — รูปแบบ OPEC ม.50 ทวิ (ฉบับผู้ถูกหัก 1–2 + สำเนาผู้หัก) */
export function buildWithholdingPrintHtml(opts: {
  company: CompanyBrand;
  number: string;
  issueDate: Date;
  meta: WithholdingDocumentMeta;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  withholdingAmount: number;
  issuedByName?: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
  /** ค่าเริ่มต้นพิมพ์ครบ 3 ฉบับตามแบบ OPEC */
  copies?: HyevWhtCopyVariant[];
}): string {
  const variants = opts.copies?.length ? opts.copies : HYEV_WHT_COPY_VARIANTS;
  const pages = variants
    .map((copyVariant) => buildWithholdingCopyPageHtml({ ...opts, copyVariant }))
    .join("\n");

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || "หัก ณ ที่จ่าย")}</title>
<style>
@page { size: A4; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body {
  font-family: "Sarabun", "TH Sarabun New", "Tahoma", sans-serif;
  font-size: 11px;
  line-height: 1.35;
  color: #111;
  margin: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.copy-banner {
  text-align: center;
  font-weight: bold;
  font-size: 11px;
  border: 1px solid #333;
  padding: 5px 8px;
  margin-bottom: 8px;
  background: #fafafa;
}
.hdr {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  align-items: start;
  border-bottom: 1.5px solid #111;
  padding-bottom: 6px;
  margin-bottom: 10px;
}
.logo img { max-width: 100px; max-height: 64px; object-fit: contain; display: block; }
.co { text-align: right; font-size: 10px; line-height: 1.35; }
.co strong { display: block; font-size: 12px; color: #1d4ed8; margin-bottom: 2px; }
.doc-top { position: relative; margin-bottom: 12px; min-height: 72px; }
.doc-title-wrap { text-align: center; padding: 0 150px; }
.doc-title-wrap h1 { font-size: 14px; margin: 0 0 2px; font-weight: bold; }
.doc-title-wrap .sub { font-size: 11px; margin: 0; color: #222; }
.doc-meta {
  position: absolute;
  top: 0;
  right: 0;
  text-align: right;
  font-size: 10.5px;
  line-height: 1.45;
  max-width: 210px;
}
.doc-meta div { margin-bottom: 4px; }
.sec {
  margin-top: 10px;
  font-weight: bold;
  border-bottom: 1px solid #333;
  padding-bottom: 1px;
  margin-bottom: 4px;
  font-size: 11.5px;
}
.field { margin: 2px 0 3px; font-size: 10.5px; }
.muted { color: #444; font-size: 10px; }
table.amounts { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10.5px; }
table.amounts td { padding: 2px 5px; vertical-align: top; }
table.amounts td:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.checkbox-row { margin: 3px 0; font-size: 10.5px; }
.certify-block { margin-top: 6px; font-size: 10.5px; }
.sign-grid { display: table; width: 100%; margin-top: 14px; }
.sign-cell { display: table-cell; width: 50%; vertical-align: top; padding: 0 10px; text-align: center; font-size: 10.5px; }
.sign-space { min-height: 64px; display: flex; align-items: flex-end; justify-content: center; gap: 8px; }
.wht-sign-img { max-height: 56px; max-width: 120px; object-fit: contain; }
.sign-line { border-top: 1px solid #111; padding-top: 6px; margin-top: 4px; font-weight: 600; }
.footer-sys {
  margin-top: 12px;
  padding-top: 6px;
  border-top: 1px solid #ddd;
  font-size: 10px;
  color: #333;
  text-align: right;
}
.wht-print-page {
  page-break-after: always;
  break-after: page;
}
.wht-print-page:last-of-type {
  page-break-after: auto;
  break-after: auto;
}
@media print { .no-print { display: none !important; } }
</style></head><body>
${pages}
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

function resolvePvWithholding(meta: import("./types").PaymentVoucherMeta, notes: string) {
  const fromNotes = notes.match(/หัก\s*ณ\s*ที่จ่าย\s*([A-Za-z0-9\-]+)/i);
  const whtNo = (meta.withholdingDocumentNumber || fromNotes?.[1] || "").trim();
  const rate = parseNum(meta.withholdingTaxRatePercent ?? "");
  const base = parseNum(meta.withholdingTaxBase ?? "");
  const whtAmt = parseNum(meta.withholdingAmount ?? "");
  const hasWht = Boolean(whtNo || whtAmt > 0 || rate > 0);
  return { hasWht, whtNo, rate, base, whtAmt };
}

function buildPaymentVoucherCopyHtml(opts: {
  company: CompanyBrand;
  number: string;
  issueDate: Date;
  meta: import("./types").PaymentVoucherMeta;
  totalAmount: number;
  notes: string;
  issuedByName?: string;
  copyLabel: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
}): string {
  const m = opts.meta;
  const assets = normalizePrintAssetOptions(opts);
  const wht = resolvePvWithholding(m, opts.notes);
  const grossBase = wht.base > 0 ? wht.base : opts.totalAmount;
  const netPay = wht.whtAmt > 0 ? Math.max(0, opts.totalAmount - wht.whtAmt) : opts.totalAmount;
  const notesWithoutWhtRef = opts.notes
    .replace(/อ้างอิงหัก\s*ณ\s*ที่จ่าย\s*[A-Za-z0-9\-]+/gi, "")
    .trim();

  const whtBlock = wht.hasWht
    ? `<div class="pv-wht">
        <div class="pv-wht-title">รายละเอียดหักภาษี ณ ที่จ่าย</div>
        ${wht.base > 0 || wht.whtAmt > 0 ? `<div class="pv-row"><span>มูลค่าฐานหัก:</span><span>${fmt(grossBase)} บาท</span></div>` : ""}
        ${wht.whtAmt > 0 ? `<div class="pv-row"><span>หัก ณ ที่จ่าย${wht.rate > 0 ? ` ${wht.rate}%` : ""}:</span><span>${fmt(wht.whtAmt)} บาท</span></div>` : ""}
        ${wht.whtNo ? `<div class="pv-row"><span>เลขที่หนังสือรับรอง:</span><span>${esc(wht.whtNo)}</span></div>` : ""}
        ${wht.whtAmt > 0 ? `<div class="pv-row"><span><strong>จำนวนที่จ่ายสุทธิ:</strong></span><span><strong>${fmt(netPay)} บาท</strong></span></div>` : ""}
      </div>`
    : "";

  const stamp =
    assets.includeStamp && opts.company.stampUrl
      ? `<img src="${esc(opts.company.stampUrl)}" alt="stamp" class="pv-stamp"/>`
      : "";
  const sig =
    assets.includeSignature && opts.company.signatureUrl
      ? `<img src="${esc(opts.company.signatureUrl)}" alt="sig" class="pv-sig"/>`
      : "";

  return `<section class="pv-copy">
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co">
      <strong>${esc(opts.company.companyName)}</strong>
      ${esc(opts.company.address).replace(/\n/g, "<br/>")}<br/>
      โทร. ${esc(opts.company.phone)} · เลขประจำตัวผู้เสียภาษี ${esc(opts.company.taxId)}
    </div>
  </div>
  <div class="title">
    <div class="title-center">
      <div class="title-main">
        <h1>ใบสำคัญจ่าย</h1>
        <div class="en">PAYMENT VOUCHER</div>
      </div>
      <div class="pv-copy-badge">${esc(opts.copyLabel)}</div>
    </div>
  </div>
  <div class="party">
    <div>
      <div><label>จ่ายให้:</label> ${esc(m.payeeName)}</div>
      <div><label>ที่อยู่:</label> ${esc(m.payeeAddress)}</div>
      <div><label>เลขผู้เสียภาษี:</label> ${esc(m.payeeTaxId)}</div>
      <div><label>โทร:</label> ${esc(m.payeePhone)}</div>
    </div>
    <div class="meta-r">
      <div><label>เลขที่:</label> <strong>${esc(opts.number || "—")}</strong></div>
      <div><label>วันที่:</label> ${esc(formatDateThaiBE(opts.issueDate))}</div>
    </div>
  </div>
  <div class="wht-section pv-detail">
    <p><strong>วัตถุประสงค์:</strong> ${esc(m.purpose)}</p>
    <p><strong>จำนวนเงิน:</strong> ${fmt(opts.totalAmount)} บาท (${esc(amountToThaiBahtText(opts.totalAmount))})</p>
    <p><strong>วิธีจ่าย:</strong> ${esc(paymentMethodLabelTh(m.paymentMethod))}</p>
    ${whtBlock}
    ${notesWithoutWhtRef ? `<p><strong>หมายเหตุ:</strong> ${esc(notesWithoutWhtRef)}</p>` : ""}
  </div>
  <div class="pv-sign">
    <div class="pv-sign-cell">
      <div class="pv-sign-space"></div>
      <div class="pv-sign-line">ผู้จัดทำ</div>
    </div>
    <div class="pv-sign-cell">
      <div class="pv-sign-space">${stamp}${sig}</div>
      <div class="pv-sign-line">ผู้อนุมัติ</div>
    </div>
  </div>
  <div class="pv-foot">${esc(opts.issuedByName ? `เอกสารออกโดยระบบ HYEV โดย ${opts.issuedByName}` : "เอกสารออกโดยระบบ HYEV")}</div>
</section>`;
}

export function buildPaymentVoucherPrintHtml(opts: {
  company: CompanyBrand;
  number: string;
  issueDate: Date;
  meta: import("./types").PaymentVoucherMeta;
  totalAmount: number;
  notes: string;
  issuedByName?: string;
  includeSignature?: boolean;
  includeStamp?: boolean;
}): string {
  const issuedByName = opts.issuedByName ?? opts.meta.issuedByName;
  const assets = normalizePrintAssetOptions(opts);
  const copyOpts = {
    ...opts,
    issuedByName,
    includeSignature: assets.includeSignature,
    includeStamp: assets.includeStamp,
  };
  const original = buildPaymentVoucherCopyHtml({ ...copyOpts, copyLabel: "ต้นฉบับ" });
  const duplicate = buildPaymentVoucherCopyHtml({ ...copyOpts, copyLabel: "สำเนา" });

  // สไตล์เฉพาะใบสำคัญจ่าย — ไม่ใช้ DOCUMENT_PRINT_CSS (min-height 260mm จะดันเป็น 2 หน้า)
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || "ใบสำคัญจ่าย")}</title>
<style>
@page { size: A4 portrait; margin: 5mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: auto; }
body {
  font-family: "Sarabun", "Tahoma", sans-serif;
  font-size: 9pt;
  color: #111;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pv-sheet {
  width: 100%;
  height: 287mm; /* A4 297mm − margin 5+5 */
  max-height: 287mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: avoid;
  page-break-inside: avoid;
}
.pv-copy {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  border: 1.5px solid #111;
  padding: 5px 8px 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 8.5pt;
  page-break-inside: avoid;
}
.pv-copy-badge {
  border: 1px solid #111;
  padding: 1px 8px;
  font-size: 8pt;
  font-weight: 700;
  background: #fff;
  white-space: nowrap;
  line-height: 1.3;
}
.pv-copy .hdr {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  align-items: start;
  border-bottom: 1.5px solid #111;
  padding-bottom: 3px;
  margin-bottom: 2px;
}
.pv-copy .logo { width: 56px; }
.pv-copy .logo img { max-width: 56px; max-height: 40px; object-fit: contain; display: block; }
.pv-copy .co {
  text-align: right;
  font-size: 7.5pt;
  line-height: 1.25;
  width: 100%;
  margin-left: auto;
}
.pv-copy .co strong {
  display: block;
  width: 100%;
  text-align: right;
  font-size: 9pt;
  color: #1d4ed8;
  margin-bottom: 1px;
}
.pv-copy .title {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 2px 0 4px;
}
.pv-copy .title-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.pv-copy .title-main { text-align: center; }
.pv-copy .title-main h1 { margin: 0; font-size: 12pt; line-height: 1.2; }
.pv-copy .title-main .en { color: #1d4ed8; font-size: 9pt; font-weight: bold; margin-top: 0; }
.pv-copy .party {
  display: grid; grid-template-columns: 1fr 140px; gap: 4px;
  margin-bottom: 2px; font-size: 8pt; line-height: 1.3;
}
.pv-copy .party label { color: #333; }
.pv-copy .meta-r { text-align: right; }
.pv-copy .wht-section {
  border: 1px solid #111; margin: 2px 0; padding: 4px 6px; font-size: 8pt; line-height: 1.3;
}
.pv-copy .wht-section p { margin: 1px 0; }
.pv-wht { margin-top: 3px; border-top: 1px dashed #333; padding-top: 2px; }
.pv-wht-title { font-weight: 700; margin-bottom: 1px; font-size: 8pt; }
.pv-row { display: grid; grid-template-columns: 130px 1fr; gap: 2px; margin: 0; }
.pv-sign {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  margin-top: auto; padding-top: 4px; text-align: center; font-size: 8pt;
}
.pv-sign-space {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  margin-bottom: 1px;
}
.pv-stamp { max-height: 28px; max-width: 36px; opacity: 0.9; }
.pv-sig { max-height: 26px; max-width: 90px; }
.pv-sign-line { border-top: 1px solid #111; padding-top: 2px; }
.pv-foot { text-align: right; font-size: 7pt; color: #444; margin-top: 2px; }
.pv-cut {
  flex: 0 0 auto;
  text-align: center; font-size: 7pt; color: #666; letter-spacing: 1px;
  margin: 1.5mm 0; line-height: 1;
}
@media print {
  html, body { height: auto !important; }
  .pv-sheet { page-break-after: avoid; page-break-inside: avoid; }
  .pv-copy { page-break-inside: avoid; break-inside: avoid; }
}
</style></head><body>
<div class="pv-sheet">
  ${original}
  <div class="pv-cut">✂ — พับ / ตัด —</div>
  ${duplicate}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}
