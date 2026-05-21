import type { DocumentKind } from "@prisma/client";
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
@media print { .no-print { display: none !important; } }
`;

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
  const gross = opts.totalAmount || base + opts.vatAmount;
  const net = gross - wht;
  const payeeBranch = m.payeeBranchHeadOffice
    ? "☑ สำนักงานใหญ่"
    : `☑ สาขา ${esc(m.payeeBranchNo)}`;

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${esc(opts.number || "หัก ณ ที่จ่าย")}</title>
<style>${DOCUMENT_PRINT_CSS}</style></head><body>
<div class="doc">
  <div class="hdr">
    <div class="logo">${logoImgHtml(opts.company.logoUrl)}</div>
    <div class="co"><strong>หนังสือรับรองการหักภาษี ณ ที่จ่าย</strong><br/>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
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
      <div class="row"><span>เลขประจำตัวผู้เสียภาษี:</span><span>${esc(m.payeeTaxId)} ${payeeBranch}</span></div>
      <div class="row"><span>ที่อยู่:</span><span>${esc(m.payeeAddress)}</span></div>
    </div>
  </div>
  <div class="wht-section">
    <strong>รายการเงินได้ที่จ่าย</strong>
    <div class="wht-grid">
      <div class="row"><span>ประเภทเงินได้:</span><span>☑ ${esc(m.incomeTypeLabel)}</span></div>
      <div class="row"><span>รายละเอียด:</span><span>${esc(m.jobDescription)}</span></div>
      <div class="row"><span>มูลค่าก่อน VAT:</span><span>${fmt(base)} บาท</span></div>
      <div class="row"><span>VAT:</span><span>${fmt(opts.vatAmount)} บาท</span></div>
      <div class="row"><span>จำนวนเงินที่จ่าย:</span><span>${fmt(gross)} บาท</span></div>
      <div class="row"><span>หัก ณ ที่จ่าย ${rate}%:</span><span><strong>${fmt(wht)} บาท</strong></span></div>
      <div class="row"><span>เงินที่จ่ายสุทธิ:</span><span>${fmt(net)} บาท</span></div>
      <div class="row"><span>วันที่จ่าย:</span><span>${esc(m.paymentDate ? formatDateThaiBE(new Date(m.paymentDate)) : formatDateThaiBE(opts.issueDate))}</span></div>
      <div class="row"><span>อ้างอิง:</span><span>${esc(m.referenceNo)}</span></div>
    </div>
    <div class="words" style="margin-top:8px">☑ หัก ณ ที่จ่าย &nbsp; ☐ ออกภาษีให้ตลอดไป &nbsp; ☐ ออกภาษีให้ครั้งเดียว</div>
    <div class="words">${esc(amountToThaiBahtText(wht))}</div>
  </div>
  ${docFooterHtml(opts.issuedByName ?? m.issuedByName)}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}
