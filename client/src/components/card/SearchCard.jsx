import React, { useEffect, useState } from "react";
import useEcomStore from "../../store/ecom-store";
import ProductCard from "./ProductCard";

const ProductPage = () => {
  const getProduct = useEcomStore((state) => state.getProduct);
  const actionSearchFilters = useEcomStore((state) => state.actionSearchFilters);

  const getCategory = useEcomStore((state) => state.getCategory);
  const categories = useEcomStore((state) => state.categories);
  const products = useEcomStore((state) => state.products);

  // ใช้ Array เก็บหลาย category
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    getCategory();
    getProduct(100);
  }, []);

  const handleCategoryClick = (id) => {
    if (id === "all") {
      // reset
      setSelectedCategories([]);
      getProduct(100);
    } else {
      let updated;
      if (selectedCategories.includes(id)) {
        // ถ้าเลือกซ้ำ → เอาออก
        updated = selectedCategories.filter((c) => c !== id);
      } else {
        // เพิ่มเข้าไป
        updated = [...selectedCategories, id];
      }
      setSelectedCategories(updated);

      if (updated.length > 0) {
        actionSearchFilters({ category: updated });
      } else {
        getProduct(100);
      }
    }
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar Search */}
      <div className="bg-gray-50 p-4">
        {/* ถ้าอยากเก็บ SearchCard ไว้ */}
        {/* <SearchCard /> */}
      </div>

      {/* Product List */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Title + Categories */}
        <div className="mb-6">
          <p className="text-2xl font-bold text-gray-800 mb-4">สินค้าทั้งหมด</p>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleCategoryClick("all")}
              className={`px-4 py-2 rounded-lg border shadow-sm transition ${
                selectedCategories.length === 0
                  ? "bg-gray-700 text-white"
                  : "bg-white hover:bg-blue-100"
              }`}
            >
              ทั้งหมด
            </button>

            {categories.map((item) => (
              <button
                key={item.id}
                onClick={() => handleCategoryClick(item.id)}
                className={`px-4 py-2 rounded-lg border shadow-sm transition ${
                  selectedCategories.includes(item.id)
                    ? "bg-gray-700 text-white"
                    : "bg-white hover:bg-blue-100"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            ไม่มีสินค้าที่จะแสดง
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((item, index) => (
              <ProductCard key={index} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
