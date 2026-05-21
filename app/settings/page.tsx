import { SettingsPageClient } from "./SettingsPageClient";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าร้าน</h1>
      </div>
      <SettingsPageClient />
    </div>
  );
}
