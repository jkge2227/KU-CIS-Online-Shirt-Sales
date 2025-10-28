import React from "react";
import LowStockThresholdCard from "../../components/admin/LowStockThresholdCard";

export default function AdminSettingsPage() {
    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <LowStockThresholdCard />
            {/* การ์ดอื่น ๆ ของแอดมิน */}
        </div>
    );
}
