// client/src/components/admin/LowStockThresholdCard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { getLowStockThreshold, setLowStockThreshold } from "../../api/adminOrders";
import useEcomStore from "../../store/ecom-store";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";

export default function LowStockThresholdCard() {
    const token = useEcomStore((s) => s.token);
    const [value, setValue] = useState(9);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const v = await getLowStockThreshold(token);
                setValue(Number(v) ?? 9);
            } catch (e) {
                toast.error("โหลดค่า threshold ไม่สำเร็จ");
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    const onSave = useCallback(async () => {
        // ตรวจสอบก่อนเปิดสถานะกำลังบันทึก
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            toast.warn("กรุณากรอกเลข 0 ขึ้นไป");
            return;
        }

        try {
            setSaving(true);
            const v = await setLowStockThreshold(token, Math.floor(num));
            setValue(v);
            toast.success("บันทึกค่าเรียบร้อย");
        } catch (e) {
            toast.error("บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    }, [token, value]);

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onSave();
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                        กำหนดสต็อกต่ำ
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        ระบบจะแจ้งเตือนสินค้าที่มีจำนวนคงเหลือน้อยกว่าหรือเท่ากับค่านี้
                    </p>
                </div>
                {loading ? (
                    <Loader2 className="animate-spin w-5 h-5 text-gray-400" />
                ) : null}
            </div>

            {/* Control */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="w-full sm:w-auto">
                    <span className="sr-only">จำนวนขั้นต่ำ</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        disabled={loading || saving}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={onKeyDown}
                        className="w-full sm:w-40 px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400
                       disabled:bg-gray-50 disabled:text-gray-400"
                        aria-label="กำหนดค่าแจ้งเตือนสต็อกต่ำ"
                    />
                </label>

                <button
                    onClick={onSave}
                    disabled={loading || saving}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                     bg-gray-700 text-white border border-gray-700
                     hover:bg-gray-800 hover:border-gray-800
                     active:scale-[0.99] transition
                     disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">บันทึก</span>
                </button>
            </div>
        </div>
    );
}
