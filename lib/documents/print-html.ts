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

export const DOCUMENT_PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: "Sarabun", "Tahoma", sans-serif; font-size: 11pt; color: #111; margin: 0; }
.doc { border: 2px solid #111; padding: 10px 12px; min-height: 260mm; display: flex; flex-direction: column; }
.hdr { display: flex; gap: 12px; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; }
.logo { width: 120px; flex-shrink: 0; }
.logo img { max-width: 150px; max-height: 88px; object-fit: contain; }
.co { flex: 1; font-size: 10pt; line-height: 1.35; }
.co strong { font-size: 11pt; }
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
.sign-cell { position: relative; min-height: 110px; }
.sign-assets { position: relative; height: 72px; margin-bottom: 4px; }
.sign-assets .stamp { position: absolute; left: 50%; top: 0; transform: translateX(-50%); max-height: 70px; max-width: 90px; opacity: 0.85; }
.sign-assets .sig { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); max-height: 48px; max-width: 140px; }
.sign-line { border-top: 1px solid #111; padding-top: 6px; margin-top: 4px; }
@media print { .no-print { display: none !important; } }
`;

export function companySignBlockHtml(opts: {
  signatureUrl?: string;
  stampUrl?: string;
  leftLabel?: string;
  rightLabel?: string;
  companyName?: string;
}): string {
  const leftLabel = opts.leftLabel ?? "ผู้รับเอกสาร";
  const rightLabel = opts.rightLabel ?? "ผู้มีอำนาจลงนาม";
  const stamp = opts.stampUrl
    ? `<img class="stamp" src="${esc(opts.stampUrl)}" alt="stamp"/>`
    : "";
  const sig = opts.signatureUrl
    ? `<img class="sig" src="${esc(opts.signatureUrl)}" alt="signature"/>`
    : "";
  const company = opts.companyName ? `<div style="font-size:9pt;margin-top:2px">${esc(opts.companyName)}</div>` : "";

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
}): string {
  const route = DOCUMENT_KIND_ROUTES[opts.kind];
  const m = opts.meta;
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
  const payBlock =
    opts.kind === "RECEIPT"
      ? `<div class="pay-chk">
      <div>การรับเงินจะสมบูรณ์ เมื่อบริษัทฯ ได้รับเงินเรียบร้อยแล้วเท่านั้น</div>
      <div>${payMethod === "CASH" ? "☑" : "☐"} เงินสด &nbsp; ${payMethod === "TRANSFER" ? "☑" : "☐"} โอน ธนาคาร &nbsp; ${payMethod === "CHEQUE" ? "☑" : "☐"} เช็ค เลขที่/วันที่ ${esc(m.chequeNo ?? "")} ${esc(m.chequeDate ?? "")}</div>
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

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || route.titleTh)}</title>
<style>${DOCUMENT_PRINT_CSS}</style></head><body>
<div class="doc">
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co">
      <strong>${esc(opts.company.companyName)}</strong><br/>
      ${esc(opts.company.address).replace(/\n/g, "<br/>")}<br/>
      โทร. ${esc(opts.company.phone)}<br/>
      เลขประจำตัวผู้เสียภาษี ${esc(opts.company.taxId)}
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
      <tr><td class="lbl">รวม Total</td><td class="val">${fmt(opts.subtotal)}</td></tr>
      <tr><td class="lbl">ภาษีมูลค่าเพิ่ม ${m.vatRatePercent ?? 7}%</td><td class="val">${fmt(opts.vatAmount)}</td></tr>
      <tr><td class="lbl"><strong>เป็นเงินทั้งสิ้น Grand Total</strong></td><td class="val"><strong>${fmt(opts.totalAmount)}</strong></td></tr>
    </table></div>
  </div>
  ${docFooterHtml(opts.issuedByName ?? m.issuedByName)}
  ${companySignBlockHtml({
    signatureUrl: opts.company.signatureUrl,
    stampUrl: opts.company.stampUrl,
    companyName: opts.company.companyName,
    leftLabel: "ผู้รับเอกสาร / ลูกค้า",
    rightLabel: "ผู้มีอำนาจลงนาม",
  })}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

/** หนังสือรับรองหัก ณ ที่จ่าย — เราเป็นผู้หัก ผู้รับเหมาเป็นผู้ถูกหัก (แนว OPEC ม.50 ทวิ) */
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
}): string {
  const m = opts.meta;
  const base = parseNum(m.withholdingTaxBase) || opts.subtotal;
  const rate = parseNum(m.withholdingTaxRatePercent) || 0;
  const wht = opts.withholdingAmount || (base * rate) / 100;
  /** บุคคลธรรมดา / ไม่ระบุว่าเป็นบริษัท → ไม่มี VAT 7% */
  const forceNoVat =
    m.payeeEntityKind === "INDIVIDUAL" ||
    String(m.vatRatePercent ?? "") === "0" ||
    m.payeeEntityKind !== "COMPANY";
  const vatAmount = forceNoVat ? 0 : opts.vatAmount;
  const showVat = !forceNoVat && vatAmount > 0;
  const gross = showVat ? opts.totalAmount || base + vatAmount : base;
  const net = gross - wht;
  const payeeBranch =
    m.payeeEntityKind === "INDIVIDUAL"
      ? ""
      : m.payeeBranchHeadOffice
        ? "☑ สำนักงานใหญ่"
        : `☑ สาขา ${esc(m.payeeBranchNo)}`;

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || "หัก ณ ที่จ่าย")}</title>
<style>${DOCUMENT_PRINT_CSS}</style></head><body>
<div class="doc">
  <div class="title" style="border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:10px">
    <h1 style="font-size:16pt;line-height:1.35">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
    <div style="font-size:11pt;margin-top:4px;font-weight:600">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
  </div>
  <div class="wht-section">
    <div class="wht-grid">
      <div class="row"><span>เลขที่:</span><span><strong>${esc(opts.number || "—")}</strong></span></div>
      <div class="row"><span>วันที่:</span><span>${esc(formatDateThaiBE(opts.issueDate))}</span></div>
    </div>
  </div>
  <div class="wht-section">
    <strong>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้ว่าจ้าง)</strong>
    <div class="wht-grid">
      <div class="row"><span>ชื่อ:</span><span>${esc(opts.company.companyName)}</span></div>
      <div class="row"><span>เลขประจำตัวผู้เสียภาษี:</span><span>${esc(opts.company.taxId)}</span></div>
      <div class="row"><span>ที่อยู่:</span><span>${esc(opts.company.address)}</span></div>
    </div>
  </div>
  <div class="wht-section">
    <strong>ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเหมา)</strong>
    <div class="wht-grid">
      <div class="row"><span>ชื่อ:</span><span>${esc(m.payeeName)}</span></div>
      <div class="row"><span>เลขประจำตัวผู้เสียภาษี:</span><span>${esc(m.payeeTaxId)}${payeeBranch ? ` ${payeeBranch}` : ""}</span></div>
      <div class="row"><span>ที่อยู่:</span><span>${esc(m.payeeAddress)}</span></div>
    </div>
  </div>
  <div class="wht-section">
    <strong>รายการเงินได้ที่จ่าย</strong>
    <div class="wht-grid">
      <div class="row"><span>ประเภทเงินได้:</span><span>☑ ${esc(m.incomeTypeLabel)}</span></div>
      <div class="row"><span>รายละเอียด:</span><span>${esc(m.jobDescription)}</span></div>
      <div class="row"><span>${showVat ? "มูลค่าก่อน VAT:" : "จำนวนเงิน:"}</span><span>${fmt(base)} บาท</span></div>
      ${showVat ? `<div class="row"><span>VAT 7%:</span><span>${fmt(vatAmount)} บาท</span></div>` : ""}
      ${showVat ? `<div class="row"><span>จำนวนเงินที่จ่าย:</span><span>${fmt(gross)} บาท</span></div>` : ""}
      <div class="row"><span>หัก ณ ที่จ่าย ${rate}%:</span><span><strong>${fmt(wht)} บาท</strong></span></div>
      <div class="row"><span>เงินที่จ่ายสุทธิ:</span><span>${fmt(net)} บาท</span></div>
      <div class="row"><span>วันที่จ่าย:</span><span>${esc(m.paymentDate ? formatDateThaiBE(new Date(m.paymentDate)) : formatDateThaiBE(opts.issueDate))}</span></div>
      <div class="row"><span>อ้างอิง:</span><span>${esc(m.referenceNo)}</span></div>
    </div>
    <div class="words" style="margin-top:8px">☑ หัก ณ ที่จ่าย &nbsp; ☐ ออกภาษีให้ตลอดไป &nbsp; ☐ ออกภาษีให้ครั้งเดียว</div>
    <div class="words">${esc(amountToThaiBahtText(wht))}</div>
  </div>
  ${docFooterHtml(opts.issuedByName ?? m.issuedByName)}
  ${companySignBlockHtml({
    signatureUrl: opts.company.signatureUrl,
    stampUrl: undefined,
    companyName: opts.company.companyName,
    leftLabel: "ผู้ถูกหักภาษี",
    rightLabel: "ผู้มีหน้าที่หักภาษี",
  })}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

function paymentMethodLabelTh(method: string): string {
  if (method === "CASH") return "เงินสด";
  if (method === "CHEQUE") return "เช็ค";
  if (method === "TRANSFER") return "โอนเงิน";
  return method;
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
}): string {
  const m = opts.meta;
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

  const sig = opts.company.signatureUrl
    ? `<img src="${esc(opts.company.signatureUrl)}" alt="sig" class="pv-sig"/>`
    : "";

  return `<section class="pv-copy">
  <div class="pv-copy-badge">${esc(opts.copyLabel)}</div>
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co">
      <strong>${esc(opts.company.companyName)}</strong><br/>
      ${esc(opts.company.address).replace(/\n/g, "<br/>")}<br/>
      โทร. ${esc(opts.company.phone)} · เลขประจำตัวผู้เสียภาษี ${esc(opts.company.taxId)}
    </div>
  </div>
  <div class="title"><h1>ใบสำคัญจ่าย</h1><div class="en">PAYMENT VOUCHER</div></div>
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
      <div class="pv-sign-space">${sig}</div>
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
}): string {
  const issuedByName = opts.issuedByName ?? opts.meta.issuedByName;
  const copyOpts = { ...opts, issuedByName };
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
  position: absolute; top: 4px; right: 8px;
  border: 1px solid #111; padding: 0 6px; font-size: 8pt; font-weight: 700;
  background: #fff; z-index: 1;
}
.pv-copy .hdr {
  display: flex; gap: 8px; align-items: flex-start;
  border-bottom: 1.5px solid #111; padding-bottom: 3px; margin-bottom: 2px;
  padding-right: 52px;
}
.pv-copy .logo { width: 56px; flex-shrink: 0; }
.pv-copy .logo img { max-width: 56px; max-height: 40px; object-fit: contain; }
.pv-copy .co { flex: 1; font-size: 7.5pt; line-height: 1.25; }
.pv-copy .co strong { font-size: 9pt; }
.pv-copy .title { text-align: center; margin: 1px 0 3px; }
.pv-copy .title h1 { margin: 0; font-size: 12pt; line-height: 1.2; }
.pv-copy .title .en { color: #1d4ed8; font-size: 9pt; font-weight: bold; margin-top: 0; }
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
.pv-sign-space { position: relative; height: 28px; margin-bottom: 1px; }
.pv-sig {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  max-height: 26px; max-width: 90px;
}
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
