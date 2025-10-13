// utils/date-thai.js
const TH_OFFSET_MS = 7 * 60 * 60 * 1000;

// ตัดเวลาให้เป็น "เที่ยงคืนของวันไทย" (instant UTC)
export const startOfThaiDayUTC = (d) => {
  const t = new Date(d.getTime());                 // clone
  // เอาเวลาไทยออก (ช่วงเวลาไทย = UTC+7) => คืนค่าทันทีที่เป็นเที่ยงคืนของวันไทย
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const dd = t.getUTCDate();
  // สร้าง instant ตอน 00:00 "ไทย" ของวันเดียวกัน
  const utc = new Date(Date.UTC(y, m, dd));        // 00:00 UTC ของวัน
  return new Date(utc.getTime() - TH_OFFSET_MS);   // เลื่อนไปเป็น 00:00 ไทย
};

// Date -> "YYYY-MM-DD" โดยยึดวันไทย
export const toYMDThai = (d) => {
  const thai0 = startOfThaiDayUTC(d);
  const y = thai0.getUTCFullYear();
  const m = String(thai0.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(thai0.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// "YYYY-MM-DD" -> Date (00:00 ไทย)
export const fromYMDThai = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  // 00:00 ไทย = 17:00 UTC ของวันก่อนหน้า
  return new Date(Date.UTC(y, m - 1, d) - TH_OFFSET_MS);
};
