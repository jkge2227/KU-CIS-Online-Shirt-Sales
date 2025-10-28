import React, { useEffect, useState, useMemo } from "react";
import useEcomStore from "../../store/ecom-store";
import ProductCard from "./ProductCard";
import { Tag, RefreshCcw, PackageOpen } from "lucide-react";

const ProductPage = () => {
  const getProduct = useEcomStore((s) => s.getProduct);
  const actionSearchFilters = useEcomStore((s) => s.actionSearchFilters);
  const getCategory = useEcomStore((s) => s.getCategory);
  const categories = useEcomStore((s) => s.categories) || [];
  const products = useEcomStore((s) => s.products) || [];

  const [selectedCategories, setSelectedCategories] = useState([]);
  const isAll = selectedCategories.length === 0;

  useEffect(() => {
    getCategory?.();
    getProduct?.(100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryClick = (id) => {
    if (id === "all") {
      setSelectedCategories([]);
      getProduct?.(100);
      return;
    }
    const exists = selectedCategories.includes(id);
    const next = exists
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id];

    setSelectedCategories(next);
    if (next.length > 0) {
      actionSearchFilters?.({ category: next });
    } else {
      getProduct?.(100);
    }
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    getProduct?.(100);
  };

  const totalProductsText = useMemo(() => {
    const n = products.length || 0;
    return n.toLocaleString();
  }, [products.length]);

  const chipClass = (active) =>
    [
      "px-3 py-1.5 rounded-md border text-sm transition",
      "focus:outline-none focus:ring-gray-800 active:scale-95",
      active
        ? "bg-gray-800 text-white border-gray-800"
        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-800 hover:text-white",
    ].join(" ");

  return (
    <div className="min-h-screen md:p-1 bg-gray-50">
      {/* Header */}
      <div className="mx-auto w-full max-w-[1295px] px-6 pt-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">สินค้าทั้งหมด</h1>
            <p className="text-sm text-gray-600 mt-1">
              เลือกหมวดหมู่เพื่อกรองรายการ หรือรีเซ็ตเพื่อดูทั้งหมด
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1">
            <Tag size={14} />
            สินค้าทั้งหมด: <b className="text-gray-900">{totalProductsText}</b> รายการ
          </span>
        </div>
      </div>

      {/* Category bar */}
      <div className="mx-auto w-full max-w-[1295px] px-6 mt-4">

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleCategoryClick("all")}
            className={chipClass(isAll)}
          >
            ทั้งหมด
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCategoryClick(c.id)}
              className={chipClass(selectedCategories.includes(c.id))}
              aria-pressed={selectedCategories.includes(c.id)}
              title={c.name}
            >
              {c.name}
            </button>
          ))}

        </div>

      </div>

      {/* Product Grid */}
      <div className="mx-auto w-full max-w-[1295px] px-6 py-6">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 rounded-2xl bg-white text-center">
            <PackageOpen className="h-10 w-10 text-gray-300 mb-3" />
            <div className="text-base font-semibold text-gray-800">ไม่มีสินค้าที่จะแสดง</div>
            <p className="text-sm text-gray-500 mt-1">
              ลองเลือกหมวดหมู่อื่น หรือกด “รีเซ็ตตัวกรอง” เพื่อดูสินค้าทั้งหมด
            </p>
            {selectedCategories.length > 0 && (
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-800 bg-white hover:bg-black hover:text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-black/30"
              >
                รีเซ็ตตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-6
                       [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]"
          >
            {products.map((item, idx) => (
              <div key={idx} className="max-w-sm w-full mx-auto">
                <ProductCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
