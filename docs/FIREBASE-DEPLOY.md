# Firebase Deploy — HYEV

คู่มือนี้ปรับจากโปรเจกต์อ้างอิง **Saha_new** ที่ deploy ได้สม่ำเสมอบน Windows และ corporate network

## สรุปโปรเจกต์

| รายการ | ค่า |
|--------|-----|
| โฟลเดอร์ | `D:\HYEV` |
| Firebase Project ID | `auto-repair-management` |
| สิ่งที่ deploy ได้ | Firestore **Security Rules** + **Indexes** |
| Cloud Functions | ยังไม่มี — เมื่อเพิ่ม `functions/` ให้ขยาย `firebase.json` และสคริปต์ตาม Saha_new |

## ติดตั้งครั้งแรก

```powershell
cd D:\HYEV
npm run deploy:prepare
npm install
firebase login
```

ตรวจว่าเลือกโปรเจกต์ถูก:

```powershell
firebase use
# ควรเห็น: auto-repair-management (default)
```

## คำสั่ง deploy

| งาน | คำสั่ง |
|-----|--------|
| Deploy rules เท่านั้น | `npm run deploy:rules` |
| Deploy indexes เท่านั้น | `npm run deploy:indexes` |
| Deploy rules + indexes | `npm run deploy:firestore` |
| เหมือนด้านบน (alias) | `npm run deploy:all` |

## SSL / Certificate (Windows + corporate)

สคริปต์ deploy ตั้ง `NODE_OPTIONS=--use-system-ca` ผ่าน `cross-env` อัตโนมัติ

ถ้ายังเจอ `UNABLE_TO_VERIFY_LEAF_SIGNATURE`:

```powershell
npm run deploy:prepare
```

หรือรันเอง:

```powershell
Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
```

**แนะนำ:** ถ้ามีไฟล์ CA ของบริษัท ให้ตั้ง `NODE_EXTRA_CA_CERTS` ชี้ไปที่ไฟล์ `.pem` แทนการปิดการตรวจ SSL

ติดตั้ง dependencies ด้วย CMD (ทางเลือก):

```cmd
cd /d D:\HYEV
set NODE_OPTIONS=--use-system-ca
npm install
```

## Authentication

**เครื่อง dev**

```powershell
firebase login
firebase login --reauth   # เมื่อ session หมดอายุ
```

**CI / GitHub Actions**

```powershell
firebase login:ci
```

เก็บ token เป็น secret ชื่อ `FIREBASE_TOKEN` ใน repository

## ไฟล์ที่เกี่ยวข้อง

- `firebase.json` — ชี้ `firestore.rules`, `firestore.indexes.json`
- `.firebaserc` — project id `auto-repair-management`
- `firestore.rules` — Security Rules (users, meta, companySettings, nationalIdIndex)
- `firestore.indexes.json` — composite indexes (ว่างได้ถ้ายังไม่มี query ซับซ้อน)
- `.github/workflows/firebase-deploy.yml` — deploy อัตโนมัติบน push `main`

## เมื่อเพิ่ม Cloud Functions ในอนาคต

1. สร้างโฟลเดอร์ `functions/` พร้อม `package.json` และ build script
2. เพิ่มบล็อก `functions` ใน `firebase.json` (ดูตัวอย่างที่ `D:\Saha_new\firebase.json`)
3. เพิ่มสคริปต์ `deploy:functions` และ `deploy:backend` ใน `package.json`
4. รัน `npm install` **บน Windows** ใน `functions/` — อย่า copy `node_modules` จาก WSL/Linux (จะขาด `firebase-functions.cmd`)

## Firebase App Hosting (เว็บ production)

Backend: **evbackend** — `https://evbackend--auto-repair-management.us-east4.hosted.app`

ค่า env อยู่ใน `apphosting.yaml` (ยกเว้น API key ใช้ Secret Manager ชื่อ `hyevFirebaseApiKey`)

หลังแก้ `.env.local` หรือเปลี่ยน API key:

```powershell
cd D:\HYEV
npm run apphosting:sync-env
git add apphosting.yaml
git commit -m "Update App Hosting env"
git push origin main
```

รอ rollout อัตโนมัติจาก GitHub (หรือ Roll out ใน Console → App Hosting → evbackend)

**หมายเหตุ:** ข้อมูล Prisma/SQLite บน cloud (`file:./dev.db`) แยกจากเครื่อง dev — ตัวเลข 0 บน production จนกว่าจะกรอกข้อมูลใหม่หรือย้าย DB

## ความปลอดภัย

- อย่า commit `.env.local`
- Rules ใน repo ต้องสอดคล้องกับหน้า login/register/admin ของแอป
- อย่าใช้ test mode rules (`if true`) บน production
