import { amountToThaiBahtText } from "@/lib/documents/thai-baht-text";
import type { CompanyBrand } from "@/lib/documents/brand";
import type { EntityRecord, RepairContractRecord, VehicleRecord } from "@/lib/domain-types";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import { DOCUMENT_PRINT_CSS } from "@/lib/documents/print-html";

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

function fmtDateTh(raw: string): string {
  if (!raw) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  return raw;
}

function partyBlock(label: string, e: EntityRecord | null | undefined, fallback = "—") {
  if (!e) {
    return `<div class="party-block">
    <p><strong>${esc(label)}:</strong> ${esc(fallback)}</p>
  </div>`;
  }
  return `<div class="party-block">
    <p><strong>${esc(label)}:</strong> ${esc(e.name)}</p>
    <p>ที่อยู่: ${esc(e.address || "—")}</p>
    <p>เลขบัตรประชาชน / ทะเบียนการค้า: ${esc(e.taxId || "—")}</p>
    <p>โทรศัพท์: ${esc(e.phone || "—")}</p>
  </div>`;
}

function partyBlockCompany(label: string, company: CompanyBrand) {
  const name = company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด";
  return `<div class="party-block">
    <p><strong>${esc(label)}:</strong> ${esc(name)}</p>
    <p>ที่อยู่: ${esc(company.address || "—")}</p>
    <p>เลขผู้เสียภาษี: ${esc(company.taxId || "—")}</p>
    <p>โทรศัพท์: ${esc(company.phone || "—")}</p>
  </div>`;
}

type LegalWrapMeta = {
  docNumber?: string;
  issueDate?: string;
  enTitle?: string;
};

function wrap(
  title: string,
  body: string,
  logoUrl: string,
  company: CompanyBrand,
  meta?: LegalWrapMeta,
): string {
  const docNo = meta?.docNumber?.trim() || "—";
  const issueDate = fmtDateTh(meta?.issueDate || "");
  const en = meta?.enTitle ? `<div class="en">${esc(meta.enTitle)}</div>` : "";
  return `<!DOCTYPE html><html lang="th"><head>
<meta charset="utf-8"/><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>${DOCUMENT_PRINT_CSS}
.party-block { margin: 6px 0; font-size: 10pt; line-height: 1.4; }
.clauses { font-size: 10pt; line-height: 1.55; margin: 10px 0; }
.clauses ol { padding-left: 1.4em; }
.pay-terms { margin: 4px 0 0; padding-left: 1.2em; }
.pay-terms li { margin: 2px 0; }
.sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; text-align: center; font-size: 10pt; }
.sign-line { margin-top: 8px; border-top: 1px solid #111; padding-top: 6px; }
.sign-assets { position: relative; height: 56px; margin-bottom: 2px; }
.sign-assets .sig { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); max-height: 52px; max-width: 150px; }
/* หัวเอกสาร: โลโก้ซ้าย · ข้อมูลบริษัทชิดขวา ไม่ทับกัน */
.legal-hdr {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 20px;
  align-items: start;
  border-bottom: 2px solid #111;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.legal-hdr .logo { width: 150px; }
.legal-hdr .logo img {
  max-width: 140px;
  max-height: 88px;
  object-fit: contain;
}
.legal-hdr .co {
  text-align: right;
  font-size: 10pt;
  line-height: 1.4;
  padding-top: 2px;
}
.legal-hdr .co strong {
  display: block;
  font-size: 12pt;
  color: #1d4ed8;
  margin-bottom: 2px;
}
/* หัวข้อกลางกระดาษ · เลขที่/วันที่ มุมขวา */
.title-row {
  position: relative;
  margin: 8px 0 12px;
  min-height: 52px;
}
.title-row .title {
  text-align: center;
  margin: 0;
  padding: 0 160px;
}
.title-row .title h1 { margin: 0; font-size: 18pt; }
.title-row .title .en {
  color: #1d4ed8;
  font-size: 12pt;
  font-weight: bold;
  margin-top: 2px;
}
.title-row .doc-meta {
  position: absolute;
  right: 0;
  top: 0;
  text-align: right;
  font-size: 10pt;
  line-height: 1.45;
}
@media print { .no-print { display:none !important; } }
</style></head><body>
<div class="no-print" style="padding:8px;background:#f1f5f9;text-align:center">
  <button onclick="window.print()">พิมพ์ / บันทึก PDF</button>
</div>
<div class="doc">
  <div class="legal-hdr">
    <div class="logo">${logoUrl ? `<img src="${esc(logoUrl)}" alt="logo"/>` : ""}</div>
    <div class="co">
      <strong>${esc(company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด")}</strong>
      ${esc(company.address || "")}<br/>
      โทร ${esc(company.phone || "")} · เลขผู้เสียภาษี ${esc(company.taxId || "")}
    </div>
  </div>
  <div class="title-row">
    <div class="title"><h1>${esc(title)}</h1>${en}</div>
    <div class="doc-meta">
      <div><strong>เลขที่:</strong> ${esc(docNo)}</div>
      <div><strong>วันที่:</strong> ${esc(issueDate)}</div>
    </div>
  </div>
  ${body}
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`;
}

/** ลายเซ็นบริษัทเท่านั้น — ไม่ใส่ตรายาง */
function companySignAssets(company: CompanyBrand): string {
  const sig = company.signatureUrl
    ? `<img class="sig" src="${esc(company.signatureUrl)}" alt="signature"/>`
    : "";
  return `<div class="sign-assets">${sig}</div>`;
}

export type PurchaseContractPrintLine = {
  label: string;
  amount: number;
  note: string;
};

export function buildPurchaseContractHtml(opts: {
  company: CompanyBrand;
  logoUrl: string;
  vehicle: VehicleRecord;
  seller: EntityRecord | null;
  amount: number;
  paymentLines: PurchaseContractPrintLine[];
  docNumber?: string;
  issueDate?: string;
}): string {
  const v = opts.vehicle;
  const payHtml =
    opts.paymentLines.length > 0
      ? `<ul class="pay-terms">${opts.paymentLines
          .map((line) => {
            const amt =
              line.amount > 0 ? `${fmt(line.amount)} บาท` : "";
            const parts = [esc(line.label || "รายการ"), amt, esc(line.note || "")]
              .filter(Boolean)
              .join(" — ");
            return `<li>${parts}</li>`;
          })
          .join("")}</ul>`
      : `<span> ตามที่คู่สัญญาตกลง</span>`;

  const body = `
  ${partyBlockCompany("ผู้ซื้อ", opts.company)}
  ${partyBlock("ผู้ขาย", opts.seller)}
  <p style="margin-top:10px"><strong>รายละเอียดรถ:</strong>
    ${esc(v.brand)} ${esc(v.model)} ปี ${esc(v.year || "—")} สี ${esc(v.color || "—")}<br/>
    ทะเบียน ${esc(v.licensePlate || "—")} · VIN ${esc(v.vin || "—")} · เลขเครื่อง ${esc(v.engineNo || "—")}
  </p>
  <p><strong>ราคาซื้อ:</strong> ${fmt(opts.amount)} บาท ${amountToThaiBahtText(opts.amount)}</p>
  <div class="clauses"><ol>
    <li>ผู้ขายตกลงขายและผู้ซื้อตกลงซื้อรถยนต์ตามรายละเอียดข้างต้น ในราคา ${fmt(opts.amount)} บาท</li>
    <li>เงื่อนไขการชำระเงิน:${payHtml}</li>
    <li>ผู้ขายรับรองว่าเป็นเจ้าของกรรมสิทธิ์โดยชอบด้วยกฎหมาย และไม่มีภาระผูกพันใด ๆ</li>
    <li>คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาแล้ว จึงลงลายมือชื่อไว้เป็นสำคัญ</li>
  </ol></div>
  <div class="sign-row">
    <div>${companySignAssets(opts.company)}<div class="sign-line">ผู้ซื้อ<br/>${esc(opts.company.companyName || "บจก. หาดใหญ่ อี วี")}</div></div>
    <div><div class="sign-assets"></div><div class="sign-line">ผู้ขาย<br/>${esc(opts.seller?.name || "……………………")}</div></div>
  </div>`;
  return wrap("สัญญาซื้อรถยนต์", body, opts.logoUrl, opts.company, {
    docNumber: opts.docNumber,
    issueDate: opts.issueDate || v.purchaseDate,
    enTitle: "VEHICLE PURCHASE CONTRACT",
  });
}

export function buildSaleContractHtml(opts: {
  company: CompanyBrand;
  logoUrl: string;
  vehicle: VehicleRecord;
  buyer: EntityRecord | null;
  depositPercent: number;
  balancePercent: number;
  amount: number;
  docNumber?: string;
  issueDate?: string;
}): string {
  const v = opts.vehicle;
  const body = `
  ${partyBlockCompany("ผู้ขาย", opts.company)}
  ${partyBlock("ผู้ซื้อ", opts.buyer)}
  <p style="margin-top:10px"><strong>รายละเอียดรถ:</strong>
    ${esc(v.brand)} ${esc(v.model)} ปี ${esc(v.year || "—")} สี ${esc(v.color || "—")}<br/>
    ทะเบียน ${esc(v.licensePlate || "—")} · VIN ${esc(v.vin || "—")}
  </p>
  <p><strong>ราคาขาย:</strong> ${fmt(opts.amount)} บาท ${amountToThaiBahtText(opts.amount)}</p>
  <div class="clauses"><ol>
    <li>ผู้ขายตกลงขายและผู้ซื้อตกลงซื้อรถยนต์ตามรายละเอียดข้างต้น</li>
    <li>เงื่อนไขการชำระเงิน: มัดจำ ${opts.depositPercent}% (${fmt((opts.amount * opts.depositPercent) / 100)} บาท)
      จ่ายวันส่งมอบส่วนที่เหลือ ${opts.balancePercent}% (${fmt((opts.amount * opts.balancePercent) / 100)} บาท)</li>
    <li>การโอนกรรมสิทธิ์จะดำเนินการเมื่อผู้ซื้อชำระครบถ้วน</li>
    <li>คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาแล้ว จึงลงลายมือชื่อไว้เป็นสำคัญ</li>
  </ol></div>
  <div class="sign-row">
    <div>${companySignAssets(opts.company)}<div class="sign-line">ผู้ขาย<br/>${esc(opts.company.companyName || "บจก. หาดใหญ่ อี วี")}</div></div>
    <div><div class="sign-assets"></div><div class="sign-line">ผู้ซื้อ<br/>${esc(opts.buyer?.name || "……………………")}</div></div>
  </div>`;
  return wrap("สัญญาขายรถยนต์", body, opts.logoUrl, opts.company, {
    docNumber: opts.docNumber,
    issueDate: opts.issueDate || v.soldDate,
    enTitle: "VEHICLE SALE CONTRACT",
  });
}

export function buildReceivingTicketHtml(opts: {
  company: CompanyBrand;
  logoUrl: string;
  vehicle: VehicleRecord;
  seller: EntityRecord | null;
  docNumber?: string;
  issueDate?: string;
}): string {
  const v = opts.vehicle;
  const body = `
  <p>วันที่รับ: ${esc(fmtDateTh(v.purchaseDate || opts.issueDate || ""))}</p>
  ${partyBlock("ผู้ส่งมอบ", opts.seller)}
  <p style="margin-top:10px"><strong>รายละเอียดรถที่รับ:</strong></p>
  <table class="items">
    <tr><th>ยี่ห้อ/รุ่น</th><th>ทะเบียน</th><th>VIN</th><th>สี</th><th>ไมล์</th></tr>
    <tr>
      <td>${esc(v.brand)} ${esc(v.model)}</td>
      <td class="cen">${esc(v.licensePlate || "—")}</td>
      <td class="cen">${esc(v.vin || "—")}</td>
      <td class="cen">${esc(v.color || "—")}</td>
      <td class="cen">${esc(v.mileage || "—")}</td>
    </tr>
  </table>
  <p style="margin-top:12px">หมายเหตุ: ${esc(v.notes || "—")}</p>
  <div class="sign-row">
    <div><div class="sign-assets"></div><div class="sign-line">ผู้ส่งมอบ</div></div>
    <div>${companySignAssets(opts.company)}<div class="sign-line">ผู้รับรถ (HYEV)</div></div>
  </div>`;
  return wrap("ใบรับรถ", body, opts.logoUrl, opts.company, {
    docNumber: opts.docNumber,
    issueDate: opts.issueDate || v.purchaseDate,
    enTitle: "VEHICLE RECEIVING TICKET",
  });
}

export function buildRepairContractHtml(opts: {
  company: CompanyBrand;
  logoUrl: string;
  contract: RepairContractRecord;
  counterparty: EntityRecord | null;
}): string {
  const c = opts.contract;
  const price = parseAmount(c.agreedPriceExVat);
  const vat = roundMoney2((price * parseAmount(c.vatRate || "7")) / 100);
  const total = roundMoney2(price + vat);
  const isOut = c.kind === "OUTSOURCE_TO_SUPPLIER";
  const title = isOut ? "สัญญาจ้างต่อ" : "สัญญารับจ้างซ่อม";
  const en = isOut ? "OUTSOURCE REPAIR AGREEMENT" : "REPAIR SERVICE AGREEMENT";

  const body = `
  ${
    isOut
      ? `${partyBlockCompany("ผู้ว่าจ้าง", opts.company)}${partyBlock("ผู้รับจ้าง", opts.counterparty)}`
      : `${partyBlockCompany("ผู้รับจ้าง", opts.company)}${partyBlock("ผู้ว่าจ้าง / ลูกค้า", opts.counterparty)}`
  }
  <p><strong>รถ:</strong> ${esc(c.customerVehicleLabel || "—")}</p>
  <p><strong>อาการ / ขอบเขตงาน:</strong><br/>${esc(c.symptoms).replace(/\n/g, "<br/>")}</p>
  <p><strong>ราคาตกลง:</strong> ${fmt(price)} บาท (ก่อน VAT) · VAT ${fmt(vat)} · รวม ${fmt(total)} บาท
    ${amountToThaiBahtText(total)}</p>
  <div class="clauses"><ol>
    <li>คู่สัญญาตกลงว่าจ้างตามขอบเขตงานและราคาข้างต้น</li>
    <li>ผู้รับจ้างจะดำเนินการด้วยความระมัดระวังเยี่ยงผู้ประกอบวิชาชีพ</li>
    <li>การชำระเงินเป็นไปตามที่คู่สัญญาตกลง หรือตามใบแจ้งหนี้/ใบเสร็จที่ออกในระบบ</li>
    ${isOut ? "<li>ผู้ว่าจ้างอาจหักภาษี ณ ที่จ่ายตามประมวลรัษฎากรเมื่อจ่ายค่าบริการ</li>" : ""}
  </ol></div>
  <div class="sign-row">
    <div>${companySignAssets(opts.company)}<div class="sign-line">${isOut ? "ผู้ว่าจ้าง (HYEV)" : "ผู้รับจ้าง (HYEV)"}</div></div>
    <div><div class="sign-assets"></div><div class="sign-line">${isOut ? "ผู้รับจ้าง" : "ผู้ว่าจ้าง"}</div></div>
  </div>`;
  return wrap(title, body, opts.logoUrl, opts.company, {
    docNumber: c.code || undefined,
    issueDate: c.issueDate,
    enTitle: en,
  });
}
