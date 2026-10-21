-- Thống kê ẩn danh của Sổ Tab Harmonica (Cloudflare D1, binding STATS).
-- Áp dụng: npx wrangler d1 execute harptabs-stats --remote --file schema.sql
-- Không lưu IP, tên hay thông tin cá nhân: chỉ mã ngẫu nhiên do app tự tạo trên máy.

-- mỗi máy cài một dòng; platform nâng dần web → pwa / apk khi người dùng cài app
CREATE TABLE IF NOT EXISTS installs (
  id TEXT PRIMARY KEY,
  first_day TEXT NOT NULL,
  platform TEXT NOT NULL,
  version TEXT
);
CREATE INDEX IF NOT EXISTS installs_first_day ON installs (first_day);

-- mỗi máy mỗi ngày dùng app một dòng; opens = số lần mở app
CREATE TABLE IF NOT EXISTS active (
  day TEXT NOT NULL,
  id TEXT NOT NULL,
  platform TEXT NOT NULL,
  opens INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, id)
);
