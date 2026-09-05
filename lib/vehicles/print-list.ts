import type { VehicleRecord } from "@/lib/domain-types";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import {
  formatBaht,
  summarizeVehicleEconomics,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/calc";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FILTER_LABELS: Record<string, string> = {
  ACTIVE: "ในสต็อก/จอง",
  IN_STOCK: "ในสต็อก",
  SOLD: "ขายแล้ว",
  RESERVED: "จองแล้ว",
  ALL: "ทั้งหมด",
};

/** พิมพ์รายการรถตามตัวกรองปัจจุบัน */
export async function printVehicleList(opts: {
  vehicles: VehicleRecord[];
  statusFilter: string;
}) {
  const company = await loadCompanyBrandClient();
  const filterLabel = FILTER_LABELS[opts.statusFilter] ?? opts.statusFilter;
  const printedAt = new Date().toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let sumPurchase = 0;
  let sumRepair = 0;
  let sumTotal = 0;
  let sumSale = 0;
  let sumBeforeVat = 0;
  let sumVat = 0;
  let sumProfit = 0;

  const bodyRows = opts.vehicles
    .map((v, i) => {
      const eco = summarizeVehicleEconomics(v);
      const purchaseCost = Number(v.purchasePrice) || 0;
      const repairCost = eco.totalCost - purchaseCost;
      sumPurchase += purchaseCost;
      sumRepair += repairCost;
      sumTotal += eco.totalCost;
      sumSale += eco.expectedSale;
      sumBeforeVat += eco.priceBeforeVat;
      sumVat += eco.vatAmount;
      sumProfit += eco.grossProfit;
      const purchaseType =
        v.purchaseType === "INDIVIDUAL_NO_VAT" ? "ซื้อบุคคล" : "ซื้อบริษัท VAT";
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(purchaseType)}</td>
        <td>
          <strong>${esc(`${v.brand} ${v.model}`)}</strong>
          ${v.licensePlate ? ` · ${esc(v.licensePlate)}` : ""}
          <div class="muted">${esc(v.code || v.id)}</div>
        </td>
        <td class="n">${esc(formatBaht(purchaseCost))}</td>
        <td class="n">${esc(formatBaht(repairCost))}</td>
        <td class="n"><strong>${esc(formatBaht(eco.totalCost))}</strong></td>
        <td class="n">${esc(formatBaht(eco.expectedSale))}</td>
        <td class="n">${esc(formatBaht(eco.priceBeforeVat))}</td>
        <td class="n">${esc(formatBaht(eco.vatAmount))}</td>
        <td class="n">${esc(formatBaht(eco.grossProfit))}</td>
        <td>${esc(VEHICLE_STATUS_LABELS[v.status] ?? v.status)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<title>รายการรถ — ${esc(filterLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun", "TH Sarabun New", Tahoma, sans-serif; font-size: 11px; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #444; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 5px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.c, th.c { text-align: center; width: 28px; }
  .muted { color: #666; font-size: 10px; font-family: ui-monospace, monospace; }
  tfoot td { background: #f9fafb; font-weight: 600; }
  .toolbar { margin-bottom: 10px; }
  .toolbar button { padding: 6px 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">พิมพ์ / บันทึก PDF</button>
  </div>
  <h1>${esc(company.companyName || "Hatyai EV")} — รายการรถยนต์และต้นทุน</h1>
  <p class="sub">ตัวกรอง: ${esc(filterLabel)} · จำนวน ${opts.vehicles.length} คัน · พิมพ์เมื่อ ${esc(printedAt)} · กำไร = ราคาก่อนภาษี − ต้นทุนไม่รวมภาษี</p>
  <table>
    <thead>
      <tr>
        <th class="c">#</th>
        <th>ประเภทซื้อ</th>
        <th>รถ</th>
        <th class="n">ต้นทุนรถ</th>
        <th class="n">ต้นทุนซ่อม</th>
        <th class="n">ต้นทุนรวม</th>
        <th class="n">ตั้งขาย</th>
        <th class="n">ราคาก่อนภาษี</th>
        <th class="n">ภาษี 7%</th>
        <th class="n">กำไรประมาณ</th>
        <th>สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="11" style="text-align:center;padding:16px">ไม่มีรายการ</td></tr>`}
    </tbody>
    ${
      opts.vehicles.length
        ? `<tfoot>
      <tr>
        <td colspan="3">รวม</td>
        <td class="n">${esc(formatBaht(sumPurchase))}</td>
        <td class="n">${esc(formatBaht(sumRepair))}</td>
        <td class="n">${esc(formatBaht(sumTotal))}</td>
        <td class="n">${esc(formatBaht(sumSale))}</td>
        <td class="n">${esc(formatBaht(sumBeforeVat))}</td>
        <td class="n">${esc(formatBaht(sumVat))}</td>
        <td class="n">${esc(formatBaht(sumProfit))}</td>
        <td></td>
      </tr>
    </tfoot>`
        : ""
    }
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body>
</html>`;

  openPrintHtml(html);
}
