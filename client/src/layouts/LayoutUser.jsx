// client/src/layout/Layout.jsx
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import MainNav from "../components/MainNav";
import useEcomStore from "../store/ecom-store";
import { ShieldAlert, X } from "lucide-react";

const TopCenterBanCard = ({ enabled, reason }) => {
    // ซ่อนชั่วคราว (จะรีเซ็ตอัตโนมัติเมื่อ enabled/reason เปลี่ยน)
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => { setDismissed(false); }, [enabled, reason]);

    if (enabled || dismissed) return null;

    return (
        <div
            className="fixed left-1/2 -translate-x-1/2 top-16 md:top-20 z-[1200] w-full max-w-2xl px-4"
            role="status"
            aria-live="assertive"
        >
            <div className="relative overflow-hidden rounded-2xl border border-rose-300/50
                      bg-gradient-to-r from-rose-600 via-rose-600 to-pink-600 text-white
                      shadow-2xl ring-1 ring-rose-500/40">
                {/* ตกแต่ง (ไม่ดักคลิก) */}
                <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-white/10" />

                <div className="px-4 py-3 sm:px-5 sm:py-4 relative z-10">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 rounded-full bg-white/15 p-1.5">
                            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="font-semibold tracking-tight">
                                บัญชีของคุณถูกระงับการใช้งาน
                            </div>
                            <p className="mt-0.5 text-sm text-white/90">
                                {reason ? <>เหตุผล: <span className="font-medium">{reason}</span></> : "โปรดติดต่อผู้ดูแลระบบ"}
                            </p>
                        </div>

                        {/* ปุ่ม X */}
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            className="ml-2 rounded-md p-1 text-white/85 transition hover:bg-white/10 hover:text-white
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 relative z-20"
                            aria-label="ซ่อนประกาศ"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* แถบล่าง */}
                <div className="flex items-center justify-between gap-3 border-t border-white/15 px-4 py-2 text-xs text-white/85 sm:px-5">
                    <span>สถานะจะอัปเดตอัตโนมัติเมื่อผู้ดูแลเปลี่ยนแปลง</span>
                    <a
                        className=" hover:decoration-white"
                    >
                        ติดต่อผู้ดูแลระบบที่ : อีเมล kriangsak.sa@ku.th
                    </a>
                </div>
            </div>
        </div>
    );
};

const LayoutUser = () => {
    const token = useEcomStore((s) => s.token);
    const users = useEcomStore((s) => s.users);
    const refresh = useEcomStore((s) => s.actionRefreshMyStatus);

    useEffect(() => {
        if (!token) return;
        refresh();
        const id = setInterval(refresh, 5000);
        return () => clearInterval(id);
    }, [token, refresh]);

    const enabled = users?.enabled ?? true;
    const reason = users?.banReason ?? "";

    return (
        <div>
            {/* การ์ดประกาศตรงกลางด้านบน (เหมือนภาพตัวอย่าง) */}
            <TopCenterBanCard enabled={enabled} reason={reason} />

            <MainNav />
            <main className="h-full px-4 mt-2 mx-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default LayoutUser;
