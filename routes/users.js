// routes/users.js
const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users?role=STAFF
// 사장님: 내 매장 직원 목록 조회
router.get('/', requireRole('OWNER'), async (req, res) => {
  const storeId = req.user.store_id;
  const role = req.query.role;

  try {
    let sql =
      'SELECT user_id, name, email, role FROM users WHERE store_id = ?';
    const params = [storeId];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
