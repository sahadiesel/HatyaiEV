/**
 * ย้ายข้อมูลจาก prisma/dev.db ไป Firestore (รันบนเครื่อง dev ครั้งเดียว)
 * ใช้: npm run db:migrate-firestore
 */
import { PrismaClient } from "@prisma/client";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    process.env[key] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";

if (!getApps().length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "auto-repair-management";
  const saPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    resolve(root, "serviceAccountKey.json");
  if (existsSync(saPath)) {
    const sa = JSON.parse(readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId });
  } else {
    try {
      initializeApp({ projectId });
    } catch (e) {
      console.error(
        "ต้องมีสิทธิ์เขียน Firestore: วาง serviceAccountKey.json ที่ root หรือรัน gcloud auth application-default login",
      );
      throw e;
    }
  }
}

const db = getFirestore();
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
  if (settings) {
    await db.collection("companySettings").doc("main").set(
      {
        companyName: settings.companyName,
        address: settings.address,
        taxId: settings.taxId,
        phone: settings.phone,
        email: settings.email,
        docPrefixInvoice: settings.docPrefixInvoice,
        docPrefixTaxInvoice: settings.docPrefixTaxInvoice,
        docPrefixReceipt: settings.docPrefixReceipt,
        docPrefixPo: settings.docPrefixPo,
        docPrefixWht: settings.docPrefixWht,
        updatedAt: new Date(),
      },
      { merge: true },
    );
    console.log("companySettings/main");
  }

  const clients = await prisma.client.findMany();
  for (const c of clients) {
    await db.collection("clients").doc(c.id).set({
      code: c.code,
      name: c.name,
      taxId: c.taxId,
      address: c.address,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      updatedAt: c.updatedAt,
    });
  }
  console.log(`clients: ${clients.length}`);

  const contractors = await prisma.contractor.findMany();
  for (const c of contractors) {
    await db.collection("contractors").doc(c.id).set({
      code: c.code,
      name: c.name,
      taxId: c.taxId,
      address: c.address,
      phone: c.phone,
      email: c.email,
      bankName: c.bankName,
      bankAccount: c.bankAccount,
      defaultWhtPercent: String(c.defaultWhtPercent),
      notes: c.notes,
      updatedAt: c.updatedAt,
    });
  }
  console.log(`contractors: ${contractors.length}`);

  const hiring = await prisma.hiringContract.count();
  const sub = await prisma.subcontractAgreement.count();
  console.log(`(SQLite only — สัญญา ${hiring} รับจ้าง / ${sub} ว่าจ้าง ยังไม่ย้าย Firestore)`);
  console.log("เสร็จ — production จะเห็นลูกค้า/ผู้รับเหมาหลัง deploy");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
