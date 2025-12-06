// routes/stores.js
const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/stores/my
router.get('/my', requireRole('OWNER'), async (req, res) => {
  const storeId = req.user.store_id;
  if (!storeId) {
    return res.status(400).json({ error: 'store_id가 없는 계정입니다.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT store_id, name, phone, address FROM stores WHERE store_id = ?',
      [storeId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '가게 정보를 찾을 수 없습니다.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/stores/my error:', err);
    res.status(500).json({ error: '가게 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
