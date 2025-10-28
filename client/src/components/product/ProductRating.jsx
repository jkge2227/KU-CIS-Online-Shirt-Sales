// client/src/components/product/ProductRating.jsx
import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getProductRating } from "../../api/review";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ✅ ตัดทศนิยมโดยไม่ปัด แล้วฟอร์แมตให้มี N ตำแหน่ง
const toFixedNoRound = (num, decimals = 2) => {
  const factor = 10 ** decimals;
  return (Math.trunc(Number(num) * factor) / factor).toFixed(decimals);
};

export default function ProductRating({ productId, size = 18, showText = true }) {
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getProductRating(productId);
        if (!alive) return;
        setAvg(Number(res.data?.avg || 0));
        setCount(Number(res.data?.count || 0));
      } catch { }
    })();
    return () => { alive = false; };
  }, [productId]);

  // ⭐ ถ้ายังอยากได้ดาวแบบครึ่งดวง คงสูตรเดิมไว้ได้
  const filled = Math.round(clamp(avg, 0, 5) * 2) / 2;

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            className={filled >= n ? "fill-yellow-300 stroke-yellow-300" : "stroke-gray-300"}
          />
        ))}
      </div>
      {showText && (
        <div className="text-sm text-gray-600">
          {toFixedNoRound(clamp(avg, 0, 5), 2)} ({count.toLocaleString()} รีวิว)
        </div>
      )}
    </div>
  );
}
