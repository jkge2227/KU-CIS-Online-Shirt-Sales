// client/src/components/MainNav.jsx
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ShoppingCart, User2, LogOut, ChevronDown } from "lucide-react";
import useEcomStore from "../store/ecom-store";

// ถ้ายังไม่ได้ export selector จาก store ก็ทำ inline selector แบบนี้ได้เลย
// const selectCartQty = (s) =>
//     s.carts.reduce((sum, it) => sum + Number(it.count || 0), 0);

// ใหม่: นับจำนวนสินค้า (บรรทัดในตะกร้า/แต่ละ variant)
const selectCartLines = (s) => s.carts.length;


const MainNav = () => {
    const navigate = useNavigate();
    const users = useEcomStore((s) => s.users);
    const actionLogout = useEcomStore((s) => s.actionLogout);

    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [userOpen, setUserOpen] = React.useState(false);

    // ✅ subscribe กับจำนวนสินค้าในตะกร้า (จะ re-render ทันทีเมื่อ carts เปลี่ยน)
    const cartCount = useEcomStore(selectCartLines);

    const handleLogout = () => {
        actionLogout();
        navigate("/login");
        setUserOpen(false);
        setMobileOpen(false);
    };

    const initials = React.useMemo(() => {
        const f = users?.first_name?.[0] ?? users?.firstName?.[0] ?? "";
        const l = users?.last_name?.[0] ?? users?.lastName?.[0] ?? "";
        return (f + l || users?.email?.[0] || "U").toUpperCase();
    }, [users]);

    const NavItem = ({ to, children }) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition 
        ${isActive ? "text-white bg-white/10" : "text-gray-200 hover:text-white hover:bg-white/10"}`
            }
            onClick={() => setMobileOpen(false)}
        >
            {children}
        </NavLink>
    );

    return (
        <nav className="sticky top-0 z-40 bg-gray-800 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-white/10">
            <div className="max-w-8xl mx-auto px-6">
                <div className="h-14 flex items-center justify-between">
                    {/* Left */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-1">
                            <NavItem to="/shop">รายการสินค้า</NavItem>
                            <NavItem to="/order">คำสั่งซื้อ</NavItem>
                            <NavItem to="/history">ประวัติการซื้อ</NavItem>
                        </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2">
                        {/* Cart */}
                        <Link
                            to="/cart"
                            className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition"
                            title="ตะกร้าสินค้า"
                        >
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-white text-black text-[11px] leading-none px-1.5 py-1 rounded-full ring-1 ring-black/10">
                                    {cartCount}
                                </span>
                            )}
                        </Link>

                        {/* User */}
                        {!users ? (
                            <div className="hidden sm:flex items-center gap-1">
                                <Link to="/login" className="px-3 py-2 text-sm text-gray-200 hover:text-white">
                                    เข้าสู่ระบบ
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-3 py-2 text-sm text-black bg-white rounded-lg hover:bg-gray-100"
                                >
                                    สมัครสมาชิก
                                </Link>
                            </div>
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={() => setUserOpen((v) => !v)}
                                    className="inline-flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition"
                                    aria-haspopup="menu"
                                    aria-expanded={userOpen}
                                >
                                    <span className="h-7 w-7 rounded-full bg-white/10 ring-1 ring-white/15 text-white text-xs font-semibold grid place-items-center">
                                        {initials}
                                    </span>
                                    <ChevronDown className="h-4 w-4" />
                                </button>

                                {userOpen && (
                                    <div
                                        className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-neutral-900 text-gray-100 shadow-lg overflow-hidden"
                                        onMouseLeave={() => setUserOpen(false)}
                                    >
                                        <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10">
                                            {users?.email ?? "ผู้ใช้"}
                                        </div>
                                        <Link
                                            to="/user"
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-white/10"
                                            onClick={() => setUserOpen(false)}
                                        >
                                            <User2 className="h-4 w-4" />
                                            โปรไฟล์ของฉัน
                                        </Link>
                                        {users?.role === "admin" && (
                                            <Link
                                                to="/admin/dashboard"
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-white/10"
                                                onClick={() => setUserOpen(false)}
                                            >
                                                แดชบอร์ดแอดมิน
                                            </Link>
                                        )}
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-white/10"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            ออกจากระบบ
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition"
                            onClick={() => setMobileOpen((v) => !v)}
                            aria-label="Toggle menu"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileOpen && (
                    <div className="md:hidden pb-3 border-t border-white/10">
                        <div className="flex flex-col pt-2 gap-1">
                            <NavItem to="/shop">รายการสินค้า</NavItem>
                            <NavItem to="/cart">ตะกร้าสินค้า</NavItem>
                            <NavItem to="/order">คำสั่งซื้อ</NavItem>
                            <NavItem to="/history">ประวัติการซื้อ</NavItem>

                            {!users ? (
                                <div className="flex items-center gap-2 pt-1">
                                    <Link to="/login" className="px-3 py-2 rounded-lg text-sm text-gray-200 hover:text-white hover:bg-white/10">
                                        เข้าสู่ระบบ
                                    </Link>
                                    <Link to="/register" className="px-3 py-2 rounded-lg text-sm bg-white text-black hover:bg-gray-100">
                                        สมัครสมาชิก
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <NavItem to="/user">โปรไฟล์ของฉัน</NavItem>
                                    {users?.role === "admin" && <NavItem to="/admin">แดชบอร์ดแอดมิน</NavItem>}
                                    <button
                                        onClick={handleLogout}
                                        className="mt-1 px-3 py-2 rounded-lg text-sm text-red-300 hover:text-white hover:bg-red-600/20 text-left"
                                    >
                                        ออกจากระบบ
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default MainNav;
