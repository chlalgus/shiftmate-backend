-- ShiftMate Database Schema
-- Character set settings
SET NAMES utf8mb4;
SET time_zone = '+09:00';

-- 외래키 체크 잠깐 끄기
SET FOREIGN_KEY_CHECKS = 0;

------------------------------------------
-- USERS (사장 + 알바)
------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  user_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id       BIGINT UNSIGNED NULL,
  name           VARCHAR(60) NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  role           ENUM('OWNER', 'STAFF') NOT NULL DEFAULT 'STAFF',
  hourly_wage    DECIMAL(10,2) NULL,
  password_hash  VARCHAR(255) NOT NULL,
  status         ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

------------------------------------------
-- STORES (매장)
------------------------------------------
DROP TABLE IF EXISTS stores;
CREATE TABLE stores (
  store_id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NULL,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  address       VARCHAR(200),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- FK: stores ⟶ users
ALTER TABLE stores
  ADD CONSTRAINT fk_stores_owner FOREIGN KEY (owner_user_id)
  REFERENCES users(user_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

------------------------------------------
-- SHIFTS (근무표)
------------------------------------------
DROP TABLE IF EXISTS shifts;
CREATE TABLE shifts (
  shift_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id        BIGINT UNSIGNED NOT NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  date_only        DATE NOT NULL,
  start_at         DATETIME NOT NULL,
  end_at           DATETIME NOT NULL,
  break_minutes    INT UNSIGNED NOT NULL DEFAULT 0,
  status           ENUM('SCHEDULED','COMPLETED','CANCELLED','PENDING_SWAP')
                   NOT NULL DEFAULT 'SCHEDULED',
  created_by       BIGINT UNSIGNED NOT NULL,
  updated_by       BIGINT UNSIGNED NOT NULL,

  -- 자동 계산 (총 근무 시간)
  duration_minutes INT AS (
    GREATEST(TIMESTAMPDIFF(MINUTE, start_at, end_at) - break_minutes, 0)
  ) STORED,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 인덱스
  KEY idx_shift_store_date (store_id, date_only),
  KEY idx_shift_user (assigned_user_id),

  -- FK
  CONSTRAINT fk_shift_store FOREIGN KEY (store_id) REFERENCES stores(store_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_shift_user FOREIGN KEY (assigned_user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_shift_created FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_shift_updated FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  -- 유효성 검사
  CONSTRAINT ck_shift_time CHECK (end_at > start_at)
) ENGINE=InnoDB;

------------------------------------------
-- SHIFT SWAP REQUESTS (대타 요청)
------------------------------------------
DROP TABLE IF EXISTS shift_swap_requests;
CREATE TABLE shift_swap_requests (
  request_id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  shift_id       BIGINT UNSIGNED NOT NULL,
  from_user_id   BIGINT UNSIGNED NOT NULL,
  to_user_id     BIGINT UNSIGNED NULL,
  status         ENUM('PENDING','ACCEPTED','REJECTED','CANCELLED')
                 NOT NULL DEFAULT 'PENDING',
  note           VARCHAR(300),
  decided_by     BIGINT UNSIGNED NULL,
  decided_at     DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_swap_status (status),
  CONSTRAINT fk_swap_shift FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_swap_from FOREIGN KEY (from_user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_swap_to FOREIGN KEY (to_user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_swap_decider FOREIGN KEY (decided_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

------------------------------------------
-- MESSAGES (DM)
------------------------------------------
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
  message_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id     BIGINT UNSIGNED NOT NULL,
  sender_id    BIGINT UNSIGNED NOT NULL,
  receiver_id  BIGINT UNSIGNED NOT NULL,
  content      TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at      DATETIME NULL,

  KEY idx_msg_store (store_id, created_at),
  CONSTRAINT fk_msg_store FOREIGN KEY (store_id) REFERENCES stores(store_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

------------------------------------------
-- PAYSLIPS (급여명세서)
------------------------------------------
DROP TABLE IF EXISTS payslips;
CREATE TABLE payslips (
  payslip_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  total_minutes INT UNSIGNED NOT NULL,
  hourly_wage   DECIMAL(10,2) NOT NULL,
  gross_pay     DECIMAL(12,2) NOT NULL,
  tax_deduction DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_pay       DECIMAL(12,2) NOT NULL,
  generated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payslip_period (user_id, period_start, period_end),
  CONSTRAINT fk_payslip_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

------------------------------------------
-- 샘플 데이터 (테스트용)
------------------------------------------

-- 사장 / 직원 더미 데이터
INSERT INTO users (name, email, role, hourly_wage, password_hash)
VALUES
('사장님', 'owner@shiftmate.dev', 'OWNER', NULL, '$2b$10$dummy'),
('김알바', 'staff1@shiftmate.dev', 'STAFF', 11000, '$2b$10$dummy'),
('박알바', 'staff2@shiftmate.dev', 'STAFF', 11000, '$2b$10$dummy');

-- 매장 생성
INSERT INTO stores (owner_user_id, name, phone, address)
VALUES (1, '어썸카페 아주대점', '010-1234-5678', '경기 수원시');

-- 직원 매장 배정
UPDATE users SET store_id = 1 WHERE user_id IN (1,2,3);

-- 근무표 예시
INSERT INTO shifts (store_id, assigned_user_id, date_only, start_at, end_at, break_minutes, created_by, updated_by)
VALUES
(1, 2, CURDATE(), CONCAT(CURDATE(), ' 10:00:00'), CONCAT(CURDATE(), ' 14:00:00'), 30, 1, 1),
(1, 3, CURDATE(), CONCAT(CURDATE(), ' 14:00:00'), CONCAT(CURDATE(), ' 18:00:00'), 30, 1, 1);

SET FOREIGN_KEY_CHECKS = 1;
