import { amountToThaiBahtText } from "@/lib/documents/thai-baht-text";
import type { CompanyBrand } from "@/lib/documents/company-brand-defaults";
import { DOCUMENT_PRINT_CSS } from "@/lib/documents/print-html";
import type { ContractPartySnapshot } from "@/lib/domain-types";

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

/** แปลง YYYY-MM-DD → วันที่ไทย พ.ศ. */
export function formatThaiDate(iso: string): string {
  if (!iso || iso.length < 10) return iso || "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const be = y + 543;
  return `${d} ${thaiMonth(m)} พ.ศ. ${be}`;
}

function thaiMonth(m: number): string {
  const names = [
    "",
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return names[m] || String(m);
}

function idLabel(kind: ContractPartySnapshot["entityKind"]): string {
  return kind === "COMPANY" ? "ทะเบียนการค้า / เลขผู้เสียภาษี" : "เลขบัตรประชาชน";
}

export function partyDetailHtml(label: string, p: ContractPartySnapshot): string {
  return `<div class="party-block">
    <p><strong>${esc(label)}:</strong> ${esc(p.name || "—")}</p>
    <p>ที่อยู่: ${esc(p.address || "—")}</p>
    <p>${esc(idLabel(p.entityKind))}: ${esc(p.idOrTaxNo || "—")}</p>
    <p>โทรศัพท์: ${esc(p.phone || "—")}</p>
  </div>`;
}

function companyAsParty(company: CompanyBrand): ContractPartySnapshot {
  return {
    entityId: null,
    name: company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด",
    address: company.address || "",
    idOrTaxNo: company.taxId || "",
    phone: company.phone || "",
    entityKind: "COMPANY",
  };
}

function wrap(title: string, body: string, logoUrl: string, company: CompanyBrand): string {
  return `<!DOCTYPE html><html lang="th"><head>
<meta charset="utf-8"/><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>${DOCUMENT_PRINT_CSS}
.meta-right { text-align: right; font-size: 10pt; line-height: 1.5; margin-bottom: 12px; }
.intro { font-size: 10.5pt; line-height: 1.65; text-align: justify; margin: 10px 0 14px; }
.party-block { margin: 8px 0; font-size: 10pt; line-height: 1.45; }
.clauses { font-size: 10.5pt; line-height: 1.65; margin: 12px 0; text-align: justify; }
.clauses p { margin: 0 0 10px; }
.clauses ul { margin: 6px 0 10px 1.4em; padding: 0; }
.sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; text-align: center; font-size: 10pt; }
.sign-line { margin-top: 56px; border-top: 1px solid #111; padding-top: 6px; }
.sign-sub { font-size: 9pt; color: #333; margin-top: 4px; }
.sign-assets { position: relative; height: 72px; margin-bottom: 2px; }
.sign-assets .stamp { position: absolute; left: 50%; top: 0; transform: translateX(-50%); max-height: 70px; max-width: 90px; opacity: 0.85; }
.sign-assets .sig { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); max-height: 48px; max-width: 140px; }
.witness-row { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 36px; text-align: center; font-size: 10pt; }
.page-foot { margin-top: 28px; text-align: right; font-size: 9pt; color: #666; }
@media print { .no-print { display:none !important; } }
</style></head><body>
<div class="no-print" style="padding:8px;background:#f1f5f9;text-align:center">
  <button onclick="window.print()">พิมพ์ / บันทึก PDF</button>
</div>
<div class="doc">
  <div class="hdr">
    <div class="logo">${logoUrl ? `<img src="${esc(logoUrl)}" alt="logo"/>` : ""}</div>
    <div class="co">
      <strong>${esc(company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด")}</strong><br/>
      ${esc(company.address || "")}<br/>
      โทร ${esc(company.phone || "")} · เลขผู้เสียภาษี ${esc(company.taxId || "")}
    </div>
  </div>
  ${body}
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
</body></html>`;
}

function companySignAssets(company: CompanyBrand): string {
  const stamp = company.stampUrl
    ? `<img class="stamp" src="${esc(company.stampUrl)}" alt="stamp"/>`
    : "";
  const sig = company.signatureUrl
    ? `<img class="sig" src="${esc(company.signatureUrl)}" alt="signature"/>`
    : "";
  return `<div class="sign-assets">${stamp}${sig}</div>`;
}

function signCell(
  label: string,
  name: string,
  opts: { companyAssets?: CompanyBrand; directorLine?: string },
): string {
  const assets = opts.companyAssets ? companySignAssets(opts.companyAssets) : `<div class="sign-assets"></div>`;
  const director = opts.directorLine
    ? `<div class="sign-sub">${esc(opts.directorLine)}</div>`
    : "";
  return `<div>${assets}<div class="sign-line">${esc(label)}<br/>${esc(name)}</div>${director}</div>`;
}

export type VehicleSaleContractPrintInput = {
  company: CompanyBrand;
  logoUrl: string;
  /** หาดใหญ่ อี วี เป็นผู้ขาย หรือผู้ซื้อ */
  hyevRole: "SELLER" | "BUYER";
  counterparty: ContractPartySnapshot;
  issuePlace: string;
  issueDate: string;
  vehicleCondition: string;
  brand: string;
  model: string;
  licensePlate: string;
  vin: string;
  amount: number;
  depositPercent: number;
  balancePercent: number;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  improvements: string[];
  deliveryDeadline: string;
  deliveryPlace: string;
  authorizedDirectorName: string;
};

/** สัญญาซื้อขายรถยนต์ — ตามแบบตัวอย่าง */
export function buildVehicleSalePurchaseContractHtml(opts: VehicleSaleContractPrintInput): string {
  const hyev = companyAsParty(opts.company);
  const seller = opts.hyevRole === "SELLER" ? hyev : opts.counterparty;
  const buyer = opts.hyevRole === "BUYER" ? hyev : opts.counterparty;
  const deposit = (opts.amount * opts.depositPercent) / 100;
  const balance = (opts.amount * opts.balancePercent) / 100;
  const improvements =
    opts.improvements.filter((x) => x.trim()).length > 0
      ? opts.improvements
          .filter((x) => x.trim())
          .map((x) => `<li>${esc(x.trim())}</li>`)
          .join("")
      : "<li>—</li>";

  const sellerIsHyev = opts.hyevRole === "SELLER";
  const buyerIsHyev = opts.hyevRole === "BUYER";

  const body = `
  <div class="title"><h1>สัญญาซื้อขายรถยนต์</h1></div>
  <div class="meta-right">
    ทำที่ ${esc(opts.issuePlace || opts.company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด")}<br/>
    วันที่ ${esc(formatThaiDate(opts.issueDate))}
  </div>
  <p class="intro">
    สัญญานี้ทำขึ้นระหว่าง <strong>${esc(seller.name)}</strong>
    ที่อยู่ ${esc(seller.address || "—")}
    ${esc(idLabel(seller.entityKind))} ${esc(seller.idOrTaxNo || "—")}
    โทรศัพท์ ${esc(seller.phone || "—")}
    ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;<strong>ผู้ขาย</strong>&rdquo; ฝ่ายหนึ่ง กับ
    <strong>${esc(buyer.name)}</strong>
    ที่อยู่ ${esc(buyer.address || "—")}
    ${esc(idLabel(buyer.entityKind))} ${esc(buyer.idOrTaxNo || "—")}
    โทรศัพท์ ${esc(buyer.phone || "—")}
    ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;<strong>ผู้ซื้อ</strong>&rdquo; อีกฝ่ายหนึ่ง
    คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาซื้อขายรถยนต์กัน โดยมีข้อความดังต่อไปนี้
  </p>

  <div class="clauses">
    <p><strong>ข้อ 1. วัตถุประสงค์</strong><br/>
    ผู้ขายตกลงขายและผู้ซื้อตกลงซื้อรถยนต์${esc(opts.vehicleCondition || "มือสอง")}
    ยี่ห้อ ${esc(opts.brand || "—")} รุ่น ${esc(opts.model || "—")}
    ทะเบียน ${esc(opts.licensePlate || "—")}
    เลขตัวถัง ${esc(opts.vin || "—")}
    ตามรายละเอียดที่ระบุในสัญญานี้</p>

    <p><strong>ข้อ 2. ราคาและการชำระเงิน</strong><br/>
    ราคาซื้อขายทั้งสิ้น <strong>${fmt(opts.amount)}</strong> บาท
    ${amountToThaiBahtText(opts.amount)}
    ผู้ซื้อตกลงชำระโดยโอนเข้าบัญชีธนาคาร ${esc(opts.bankName || "—")}
    เลขที่บัญชี ${esc(opts.bankAccount || "—")}
    ชื่อบัญชี ${esc(opts.bankAccountName || seller.name)} ดังนี้</p>
    <p>2.1 มัดจำ ${opts.depositPercent}% เป็นเงิน ${fmt(deposit)} บาท จ่ายในวันทำสัญญา<br/>
    2.2 ส่วนที่เหลือ ${opts.balancePercent}% เป็นเงิน ${fmt(balance)} บาท จ่ายในวันส่งมอบและโอนกรรมสิทธิ์</p>

    <p><strong>ข้อ 3. เงื่อนไขการปรับปรุงรถยนต์</strong><br/>
    ผู้ขายตกลงปรับปรุงรถยนต์ก่อนส่งมอบ โดยไม่คิดค่าใช้จ่ายเพิ่ม ดังนี้</p>
    <ul>${improvements}</ul>

    <p><strong>ข้อ 4. กำหนดและสถานที่ส่งมอบ</strong><br/>
    ผู้ขายตกลงส่งมอบรถยนต์ภายในกำหนด ${esc(opts.deliveryDeadline || "—")}
    โดยผู้ซื้อมารับรถ ณ ${esc(opts.deliveryPlace || opts.company.address || "สถานประกอบการของผู้ขาย")}</p>

    <p><strong>ข้อ 5. การรับรองและความรับผิดชอบ</strong><br/>
    ผู้ขายรับรองว่ารถยนต์มีเอกสารสิทธิตามกฎหมาย และไม่มีภาระจำนองหรือภาระผูกพันใด ๆ
    ผู้ขายตกลงดำเนินการและรับผิดชอบค่าใช้จ่ายในการโอนกรรมสิทธิ์ให้แก่ผู้ซื้อ</p>

    <p>สัญญานี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว
    จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน และต่างยึดถือไว้ฝ่ายละฉบับ</p>
  </div>

  <div class="sign-grid">
    ${signCell("ผู้ขาย", seller.name, {
      companyAssets: sellerIsHyev ? opts.company : undefined,
      directorLine: sellerIsHyev && opts.authorizedDirectorName
        ? `โดย ${opts.authorizedDirectorName} กรรมการผู้มีอำนาจ`
        : undefined,
    })}
    ${signCell("ผู้ซื้อ", buyer.name, {
      companyAssets: buyerIsHyev ? opts.company : undefined,
      directorLine: buyerIsHyev && opts.authorizedDirectorName
        ? `โดย ${opts.authorizedDirectorName} กรรมการผู้มีอำนาจ`
        : undefined,
    })}
  </div>
  <div class="witness-row">
    <div><div class="sign-line">พยาน</div></div>
    <div><div class="sign-line">พยาน</div></div>
  </div>`;

  return wrap("สัญญาซื้อขายรถยนต์", body, opts.logoUrl, opts.company);
}

export type HireContractPrintInput = {
  company: CompanyBrand;
  logoUrl: string;
  /** หาดใหญ่ อี วี เป็นผู้ว่าจ้าง หรือผู้รับจ้าง */
  hyevRole: "HIRER" | "CONTRACTOR";
  counterparty: ContractPartySnapshot;
  issuePlace: string;
  issueDate: string;
  title: string;
  scopeOfWork: string;
  amount: number;
  paymentTerms: string;
  startDate: string;
  endDate: string;
  workPlace: string;
  authorizedDirectorName: string;
};

/** สัญญาว่าจ้าง */
export function buildHireContractHtml(opts: HireContractPrintInput): string {
  const hyev = companyAsParty(opts.company);
  const hirer = opts.hyevRole === "HIRER" ? hyev : opts.counterparty;
  const contractor = opts.hyevRole === "CONTRACTOR" ? hyev : opts.counterparty;
  const hirerIsHyev = opts.hyevRole === "HIRER";
  const contractorIsHyev = opts.hyevRole === "CONTRACTOR";

  const body = `
  <div class="title"><h1>สัญญาว่าจ้าง</h1></div>
  <div class="meta-right">
    ทำที่ ${esc(opts.issuePlace || opts.company.companyName || "บริษัท หาดใหญ่ อี วี จำกัด")}<br/>
    วันที่ ${esc(formatThaiDate(opts.issueDate))}
  </div>
  <p class="intro">
    สัญญานี้ทำขึ้นระหว่าง <strong>${esc(hirer.name)}</strong>
    ที่อยู่ ${esc(hirer.address || "—")}
    ${esc(idLabel(hirer.entityKind))} ${esc(hirer.idOrTaxNo || "—")}
    โทรศัพท์ ${esc(hirer.phone || "—")}
    ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;<strong>ผู้ว่าจ้าง</strong>&rdquo; ฝ่ายหนึ่ง กับ
    <strong>${esc(contractor.name)}</strong>
    ที่อยู่ ${esc(contractor.address || "—")}
    ${esc(idLabel(contractor.entityKind))} ${esc(contractor.idOrTaxNo || "—")}
    โทรศัพท์ ${esc(contractor.phone || "—")}
    ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;<strong>ผู้รับจ้าง</strong>&rdquo; อีกฝ่ายหนึ่ง
    คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาว่าจ้างกัน โดยมีข้อความดังต่อไปนี้
  </p>

  <div class="clauses">
    <p><strong>ข้อ 1. วัตถุประสงค์</strong><br/>
    ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างปฏิบัติงาน
    ${esc(opts.title || "ตามขอบเขตงานที่ระบุ")} ดังรายละเอียดในข้อ 2</p>

    <p><strong>ข้อ 2. ขอบเขตงาน</strong><br/>
    ${esc(opts.scopeOfWork || "—").replace(/\n/g, "<br/>")}</p>

    <p><strong>ข้อ 3. ค่าจ้างและการชำระเงิน</strong><br/>
    ค่าจ้างทั้งสิ้น <strong>${fmt(opts.amount)}</strong> บาท
    ${amountToThaiBahtText(opts.amount)}<br/>
    เงื่อนไขการชำระเงิน: ${esc(opts.paymentTerms || "ตามที่คู่สัญญาตกลง")}</p>

    <p><strong>ข้อ 4. ระยะเวลาและสถานที่ปฏิบัติงาน</strong><br/>
    เริ่ม ${esc(formatThaiDate(opts.startDate))} ถึง ${esc(formatThaiDate(opts.endDate))}<br/>
    สถานที่ปฏิบัติงาน: ${esc(opts.workPlace || "—")}</p>

    <p><strong>ข้อ 5. การรับรองและความรับผิดชอบ</strong><br/>
    ผู้รับจ้างรับรองว่าจะปฏิบัติงานด้วยความระมัดระวังเยี่ยงผู้ประกอบวิชาชีพ
    และส่งมอบผลงานตามที่ตกลง ผู้ว่าจ้างมีสิทธิหักภาษี ณ ที่จ่ายตามประมวลรัษฎากรเมื่อจ่ายค่าจ้าง</p>

    <p>สัญญานี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว
    จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน และต่างยึดถือไว้ฝ่ายละฉบับ</p>
  </div>

  <div class="sign-grid">
    ${signCell("ผู้ว่าจ้าง", hirer.name, {
      companyAssets: hirerIsHyev ? opts.company : undefined,
      directorLine: hirerIsHyev && opts.authorizedDirectorName
        ? `โดย ${opts.authorizedDirectorName} กรรมการผู้มีอำนาจ`
        : undefined,
    })}
    ${signCell("ผู้รับจ้าง", contractor.name, {
      companyAssets: contractorIsHyev ? opts.company : undefined,
      directorLine: contractorIsHyev && opts.authorizedDirectorName
        ? `โดย ${opts.authorizedDirectorName} กรรมการผู้มีอำนาจ`
        : undefined,
    })}
  </div>
  <div class="witness-row">
    <div><div class="sign-line">พยาน</div></div>
    <div><div class="sign-line">พยาน</div></div>
  </div>`;

  return wrap("สัญญาว่าจ้าง", body, opts.logoUrl, opts.company);
}
