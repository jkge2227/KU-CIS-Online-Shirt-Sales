import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    RulerDimensionLine,
    SquareChartGantt,
    ChartBarStacked,
    Package,
    LogOut,
    Layers,
    UserRoundPen,
    ShoppingCart,
    Store,
    Settings2,
} from 'lucide-react'

const navItemClasses = (isActive) =>
    isActive
        ? 'bg-gray-900 rounded-md text-white px-3 py-2 flex items-center gap-2'
        : 'text-gray-300 px-3 py-2 hover:bg-gray-700 hover:text-white rounded flex items-center gap-2'

const Label = ({ show, children }) => (
    <AnimatePresence initial={false}>
        {show && (
            <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="whitespace-nowrap overflow-hidden"
            >
                {children}
            </motion.span>
        )}
    </AnimatePresence>
)

const SidebarAdmin = () => {
    const [collapsed, setCollapsed] = useState(true)

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 64 : 240 }} // ✅ พับเหลือ 64px, ขยาย 240px (เล็กกว่าของเดิม)
            transition={{ type: 'tween', duration: 0.22 }}
            className="bg-gray-800 text-gray-100 flex flex-col h-screen shadow-lg"
            onMouseEnter={() => setCollapsed(false)}   // hover เข้า → ขยาย
            onMouseLeave={() => setCollapsed(true)}    // hover ออก → พับ
        >
            {/* Header */}
            <div className="h-16 bg-gray-900 flex items-center justify-center px-3">
                <div className="flex items-center gap-3 w-full">
                    <div className="h-9 w-9 rounded-xl bg-gray-800 flex items-center justify-center text-sm font-bold tracking-wide">
                        AP
                    </div>
                    <Label show={!collapsed}>
                        <div className="text-xl font-bold">แผงผู้ดูแลระบบ</div>
                    </Label>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-1">
                <NavLink to="dashboard" end className={({ isActive }) => navItemClasses(isActive)}>
                    <LayoutDashboard className="shrink-0" />
                    <Label show={!collapsed}>แดชบอร์ด</Label>
                </NavLink>

                <NavLink to="adminusers" end className={({ isActive }) => navItemClasses(isActive)}>
                    <UserRoundPen  className="shrink-0" />
                    <Label show={!collapsed}>จัดการผู้ใช้</Label>
                </NavLink>

                <NavLink to="statusorder" end className={({ isActive }) => navItemClasses(isActive)}>
                    <ShoppingCart   className="shrink-0" />
                    <Label show={!collapsed}>จัดการคำสั่งซื้อ</Label>
                </NavLink>

                <NavLink to="category" className={({ isActive }) => navItemClasses(isActive)}>
                    <ChartBarStacked className="shrink-0" />
                    <Label show={!collapsed}>ประเภทสินค้า</Label>
                </NavLink>

                <NavLink to="size" className={({ isActive }) => navItemClasses(isActive)}>
                    <RulerDimensionLine className="shrink-0" />
                    <Label show={!collapsed}>ขนาดสินค้า</Label>
                </NavLink>

                <NavLink to="generation" className={({ isActive }) => navItemClasses(isActive)}>
                    <Layers className="shrink-0" />
                    <Label show={!collapsed}>รุ่นเสื้อ</Label>
                </NavLink>
                <NavLink to="product" className={({ isActive }) => navItemClasses(isActive)}>
                    <Package className="shrink-0" />
                    <Label show={!collapsed}>จัดการสินค้า</Label>
                </NavLink>

                <NavLink to="/shop" className={({ isActive }) => navItemClasses(isActive)}>
                    <Store className="shrink-0" />
                    <Label show={!collapsed}>สั่งซื้อหน้าร้าน</Label>
                </NavLink>

                <NavLink to="settings" className={({ isActive }) => navItemClasses(isActive)}>
                    <Settings2 className="shrink-0" />
                    <Label show={!collapsed}>จัดการสต็อก</Label>
                </NavLink>
            </nav>
        </motion.aside>
    )
}

export default SidebarAdmin
