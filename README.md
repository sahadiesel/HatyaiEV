# Hatyai EV Co., Ltd. — ระบบจัดการรถมือสอง / ซ่อม / เอกสารบัญชี

Next.js 15 + Firebase (Auth, Firestore, Storage) สำหรับ **บริษัท หาดใหญ่ อี วี จำกัด**

ประยุกต์จากโปรเจกต์ HYEV / Saha Diesel / OPEC — เพิ่มโมดูลสต็อกรถ ต้นทุน Margin Scheme VAT และสมุดเงินสดแบบ Hybrid Posting

## โมดูลหลัก

| โมดูล | เส้นทาง | ฟังก์ชัน |
|--------|---------|----------|
| 1. รถยนต์และต้นทุน | `/vehicles` | การ์ด/ตารางต่อคัน · ต้นทุนรวม Real-time · เพิ่มต้นทุนสะสม · ราคาตั้งขาย/คอม · ประเภทซื้อ (บุคคล / บริษัท VAT 7%) |
| 2. รับจ้างซ่อม | `/services` | ตกลงราคา · สัญญารับจ้างซ่อม / สัญญาจ้างต่อ · ดึง Entities |
| 3. ศูนย์เอกสาร | `/documents` | ใบแจ้งหนี้ / กำกับภาษี / เสร็จ / หัก ณ ที่จ่าย / ใบสำคัญจ่าย + สัญญาซื้อ-ขาย / ใบรับรถ (PDF พิมพ์) |
| 4. สมุดเงินสด | `/cashbook` | Cashflow Balance · Auto จากใบเสร็จ/ใบสำคัญจ่าย · Manual รายการด่วน |
| คู่ค้า | `/entities` | บุคคลธรรมดา / นิติบุคคล · ชื่อ ที่อยู่ โทร เลขภาษี |

## VAT Margin Scheme (ป.111)

เมื่อรถซื้อจาก**บุคคลธรรมดา** → VAT ตอนขาย = `(ราคาขาย − ต้นทุนรวม) × 7/107`  
เมื่อซื้อจาก**บริษัท VAT 7%** → VAT จากยอดขายเต็ม = `ราคาขาย × 7/107`

โค้ด: `lib/vehicles/calc.ts`, `lib/documents/calc.ts` → `calcVehicleSaleVatTotals`

## Hybrid Cashbook

- **Automatic:** ออกใบเสร็จ (IN) / ใบสำคัญจ่าย (OUT) / ซื้อรถเข้า / เพิ่มต้นทุนพร้อมติ๊กลงสมุด → `postCashbookEntry`
- **Manual:** ปุ่ม「บันทึกรายการด่วน」ใน `/cashbook`

## เริ่มต้นใช้งาน

```bash
cp .env.local.example .env.local
# ใส่ NEXT_PUBLIC_FIREBASE_* และ service account สำหรับ server actions
npm install
npm run dev
```

เปิด http://localhost:3003

## Firestore collections ใหม่

- `entities` — คู่ค้า
- `vehicles` — สต็อกรถ + `costLines[]`
- `repairContracts` — สัญญาซ่อมสั้น
- `cashbookEntries` / `cashSettings` — สมุดเงินสด

คอลเลกชันเดิมจาก HYEV (clients, contractors, hiringContracts, documents, …) ยังใช้ได้สำหรับงานโครงการขนาดใหญ่

## พิมพ์เอกสารกฎหมาย

- `/documents/legal/purchase?vehicleId=…`
- `/documents/legal/sale?vehicleId=…`
- `/documents/legal/receiving?vehicleId=…`
- `/documents/legal/repair?contractId=…`
