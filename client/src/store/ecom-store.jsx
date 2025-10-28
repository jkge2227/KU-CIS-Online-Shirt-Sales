import axios from 'axios'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { listCategory } from '../api/Category'
import { listProduct, searchFilters } from '../api/product'
import { listSize } from '../api/Size'
import { listGeneration } from '../api/Generation'
import { getMyStatus } from '../api/adminUsers';
// key เดียวต่อ variant
const makeKey = (productId, variantId) => `${productId}::${variantId}`

const ecomStore = (set, get) => ({
  users: null,
  token: null,
  categories: [],
  products: [],
  orders: [],
  carts: [], // [{ key, productId, variantId, count, price, productTitle, sizeName, generationName, image, maxStock? }]
  sizes: [],
  generations: [],


  actionRefreshMyStatus: async () => {
    const token = get().token;
    if (!token) return null;
    try {
      const res = await getMyStatus(token);
      const me = res?.data?.me;
      if (me) {
        // อัปเดต users ใน store ให้เป็นสถานะล่าสุดจาก server
        set({ users: { ...(get().users || {}), ...me } });
      }
      return me;
    } catch (err) {
      // ถ้า token หมดอายุ/โดนยกเลิก จะไปเข้าหน้า login ตาม flow ของคุณได้
      // หรือจะเช็ค err.response.status === 401 แล้ว logout อัตโนมัติก็ได้
      // console.log(err);
      return null;
    }
  },

  // ---------------- Auth ----------------
  actionLogin: async (form) => {
    const res = await axios.post('http://localhost:5002/api/login', form)
    const { token, PayLoad } = res.data
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    set({ users: PayLoad, token })
    localStorage.setItem('token', token)
    return res
  },

  actionLogout: () => {
    // ล้าง header
    delete axios.defaults.headers.common['Authorization']
    // ลบ token ที่เผื่อไว้
    localStorage.removeItem('token')
    // เคลียร์สถานะผู้ใช้ (และคุณจะเลือกเคลียร์ตะกร้าด้วยก็ได้)
    set({ users: null, token: null /*, carts: []*/ })
  },


  // ---------------- Masters ----------------
  getCategory: async () => {
    try {
      const res = await listCategory()
      set({ categories: res.data })
    } catch (err) { console.log(err) }
  },
  getProduct: async (count) => {
    try {
      const res = await listProduct(count)
      set({ products: res.data })
    } catch (err) { console.log(err) }
  },
  getSize: async () => {
    try {
      const res = await listSize()
      const data = Array.isArray(res.data) ? res.data : res.data?.data || []
      set({ sizes: data })
    } catch (err) { console.log(err) }
  },
  getGeneration: async () => {
    try {
      const res = await listGeneration()
      const data = Array.isArray(res.data) ? res.data : res.data?.data || []
      set({ generations: data })
    } catch (err) { console.log(err) }
  },

  // ---------------- Search ----------------
  actionSearchFilters: async (arg) => {
    try {
      const res = await searchFilters(arg)
      set({ products: res.data })
    } catch (err) { console.log(err) }
  },

  // ---------------- Cart (variant-aware) ----------------
  /**
   * payload ที่คาดหวังจาก ProductCard:
   * {
   *   productId, variantId, count,
   *   productTitle, price, sizeName, generationName, image,
   *   maxStock, // จำนวนสต็อกของ variant นี้ (แนะนำส่งมาด้วย)
   * }
   */
  actionAddtoCart: (payload) => {
    const {
      productId,
      variantId,
      count = 1,
      price,
      productTitle,
      sizeName,
      generationName = null,
      image = null,
      maxStock, // <= มาจาก selectedVariant.quantity ที่การ์ดส่งมา
    } = payload || {}

    if (!productId || !variantId) {
      console.warn('actionAddtoCart: productId/variantId is required')
      return
    }

    const key = makeKey(productId, variantId)
    const carts = get().carts
    const idx = carts.findIndex((c) => c.key === key)

    if (idx >= 0) {
      // เพิ่มจำนวนของเดิม (คุมไม่ให้เกิน maxStock ถ้ามี)
      const updated = [...carts]
      const prev = updated[idx]
      const next = Math.max(1, Number(prev.count || 0) + Number(count || 0))
      updated[idx] = {
        ...prev,
        count: maxStock != null ? Math.min(next, Number(maxStock)) : next,
        // อัปเดต maxStock หากรอบหลังส่งมา (เช่นตอนแรกไม่ได้ส่ง)
        ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
      }
      set({ carts: updated })
    } else {
      // เพิ่มรายการใหม่ (คุมไม่ให้เกิน maxStock ถ้ามี)
      const initCount = Math.max(1, Number(count || 1))
      const item = {
        key,
        productId,
        variantId,
        count: maxStock != null ? Math.min(initCount, Number(maxStock)) : initCount,
        price,
        productTitle,
        sizeName,
        generationName,
        image,
        ...(maxStock != null ? { maxStock: Number(maxStock) } : {}),
      }
      set({ carts: [...carts, item] })
    }
  },

  actionUpdateQuantity: (productId, variantId, newQuantity) => {
    const key = makeKey(productId, variantId)
    set((state) => ({
      carts: state.carts.map((item) => {
        if (item.key !== key) return item
        const desired = Math.max(1, Number(newQuantity || 1))
        // คุมไม่ให้เกิน maxStock ถ้ามี
        const limited = item.maxStock != null
          ? Math.min(desired, Number(item.maxStock))
          : desired
        return { ...item, count: limited }
      }),
    }))
  },

  actionRemoveProduct: (productId, variantId) => {
    const key = makeKey(productId, variantId)
    set((state) => ({
      carts: state.carts.filter((item) => item.key !== key),
    }))
  },

  actionAllRemoveProduct: () => set({ carts: [] }),

  getTotalPrice: () => {
    return get().carts.reduce((total, item) => {
      const price = Number(item.price || 0)
      const count = Number(item.count || 0)
      return total + price * count
    }, 0)
  },

  actionChangeVariant: (productId, oldVariantId, newLine) =>
    set((state) => {
      const oldKey = makeKey(productId, oldVariantId);
      const newVariantId = Number(newLine?.variantId);
      const newKey = makeKey(productId, newVariantId);

      const next = state.carts.map((it) => {
        if (it.key !== oldKey) return it;

        const maxStock = newLine?.maxStock != null
          ? Number(newLine.maxStock)
          : (it.maxStock != null ? Number(it.maxStock) : Number.POSITIVE_INFINITY);

        const desired = newLine?.count != null ? Number(newLine.count) : Number(it.count || 1);
        const limited = Number.isFinite(maxStock) ? Math.min(Math.max(1, desired), maxStock) : Math.max(1, desired);

        return {
          ...it,
          // บังคับให้ใช้ key/ids มาตรฐานจาก store
          key: newKey,
          productId,
          variantId: newVariantId,

          // อัปเดต props อื่น ๆ ตาม newLine (ถ้ามี)
          ...(newLine?.productTitle != null ? { productTitle: newLine.productTitle } : {}),
          ...(newLine?.sizeName != null ? { sizeName: newLine.sizeName } : {}),
          ...(newLine?.generationName != null ? { generationName: newLine.generationName } : {}),
          ...(newLine?.image != null ? { image: newLine.image } : {}),
          ...(newLine?.price != null ? { price: Number(newLine.price) } : {}),
          ...(newLine?.maxStock != null ? { maxStock: Number(newLine.maxStock) } : {}),

          // จำนวนหลัง clamp
          count: limited,
        };
      });

      return { carts: next };
    }),


  getCartCount: () => {
    return get().carts.reduce((sum, item) => sum + Number(item.count || 0), 0)
  },


})

// persist
const usePersist = {
  name: 'ecom-store',
  storage: createJSONStorage(() => localStorage),
}

const useEcomStore = create(persist(ecomStore, usePersist))
export default useEcomStore

export const selectCartQty = (s) =>
  s.carts.reduce((sum, item) => sum + Number(item.count || 0), 0);

// ถ้าอยากนับจำนวน “รายการ” (ไม่ใช่จำนวนชิ้น) ใช้ตัวนี้แทน
export const selectCartLines = (s) => s.carts.length;