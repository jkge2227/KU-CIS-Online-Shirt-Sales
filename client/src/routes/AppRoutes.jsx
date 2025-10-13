import React from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Home from '../pages/home'
import Shop from '../pages/Shop'
import Cart from '../pages/cart'
import Order from '../pages/Order'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import Layout from '../layouts/Layout'
import LayoutAdmin from '../layouts/LayoutAdmin'
import Dashboard from '../pages/admin/Dashboard'
import Category from '../pages/admin/Category'
import Product from '../pages/admin/Product'
import Manage from '../pages/admin/Manage'
import LayoutUser from '../layouts/LayoutUser'
import HomeUser from '../pages/user/HomeUser'
import ProtectRoutUser from './ProtectRoutUser'
import ProtectRouteAdmin from './ProtectRouteAdmin'
import EditProduct from '../pages/admin/EditProduct'
import FormSize from '../components/admin/FormSize'
import FormGeneration from '../components/admin/FormGeneration'
import StatusOrder from '../components/admin/StatusOrder'
import ProductDetail from "../pages/ProductDetail"
import History from '../pages/history'
import AdminSalesDashboard from '../components/admin/AdminSalesDashboard'
import ForgotPasswordOTP from '../pages/auth/ForgotPasswordOTP'
import ForgotPassword from '../pages/auth/ForgotPassword'
import AdminUsers from '../components/admin/AdminUsers'

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            { index: true, element: <Home /> },
            { path: 'shop', element: <Shop /> },
            { path: 'product/:id', element: <ProductDetail /> },
            { path: 'cart', element: <Cart /> },
            { path: 'history', element: <History /> },
            { path: 'order', element: <Order /> },
            { path: 'login', element: <Login /> },
            { path: 'register', element: <Register /> },
            { path: "forgot-otp", element: <ForgotPasswordOTP /> },
            { path: "forgot-password", element: <ForgotPassword /> },


        ]
    },
    {
        path: '/admin',
        element: <ProtectRouteAdmin element={<LayoutAdmin />} />,
        children: [
            { index: true, element: <Dashboard /> },
            { path: 'category', element: <Category /> },
            { path: 'product', element: <Product /> },
            { path: 'product/:id', element: <EditProduct /> },
            { path: 'manage', element: <Manage /> },
            { path: 'size', element: <FormSize /> },
            { path: 'generation', element: <FormGeneration /> },
            { path: 'statusorder', element: <StatusOrder /> },
            { path: 'dashboard', element: <AdminSalesDashboard /> },
            { path: 'adminusers', element: <AdminUsers /> },
        ]
    },
    {
        path: '/user',
        element: <ProtectRoutUser element={<LayoutUser />} />,
        children: [
            { index: true, element: <HomeUser /> },

        ]
    }
])

const AppRoutes = () => {
    return (
        <>
            <RouterProvider router={router} />
            <ToastContainer
                position="top-center"
                autoClose={1200}        // ให้สั้นลง ~1.2s
                hideProgressBar
                newestOnTop
                closeOnClick
                pauseOnHover={false}
                draggable
                theme="colored"
            />
        </>
    )
}

export default AppRoutes