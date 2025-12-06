const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// STAFF: 내 대타 요청들
// GET /api/requests/my
router.get('/my', requireRole('STAFF'), async (req, res) => {
  const userId = req.user.user_id;

  try {
    const [rows] = await pool.query(
      `SELECT 
         r.request_id, r.shift_id, r.from_user_id, r.to_user_id,
         r.status, r.note, r.created_at, r.updated_at,
         s.start_at, s.end_at,
         fu.name AS from_user_name,
         tu.name AS to_user_name
       FROM shift_swap_requests r
       JOIN shifts s ON s.shift_id = r.shift_id
       JOIN users fu ON fu.user_id = r.from_user_id
       LEFT JOIN users tu ON tu.user_id = r.to_user_id
       WHERE r.from_user_id = ? OR r.to_user_id = ?
       ORDER BY r.created_at DESC`,
      [userId, userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/requests/my error:', err);
    res.status(500).json({ error: '대타 요청 조회 중 오류가 발생했습니다.' });
  }
});

// OWNER: 매장 전체 대타 요청들
// GET /api/requests/store
router.get('/store', requireRole('OWNER'), async (req, res) => {
  const storeId = req.user.store_id;

  try {
    const [rows] = await pool.query(
      `SELECT 
         r.request_id, r.shift_id, r.from_user_id, r.to_user_id,
         r.status, r.note, r.created_at, r.updated_at,
         s.start_at, s.end_at,
         fu.name AS from_user_name,
         tu.name AS to_user_name
       FROM shift_swap_requests r
       JOIN shifts s ON s.shift_id = r.shift_id
       JOIN users fu ON fu.user_id = r.from_user_id
       LEFT JOIN users tu ON tu.user_id = r.to_user_id
       WHERE s.store_id = ?
       ORDER BY r.created_at DESC`,
      [storeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/requests/store error:', err);
    res.status(500).json({ error: '매장 대타 요청 조회 중 오류가 발생했습니다.' });
  }
});

// STAFF: 대타 요청 생성
// POST /api/requests
// body: { shift_id, to_user_id? }
router.post('/', requireRole('STAFF'), async (req, res) => {
  const userId = req.user.user_id;
  const { shift_id, to_user_id = null, note = null } = req.body;

  if (!shift_id) {
    return res.status(400).json({ error: 'shift_id는 필수입니다.' });
  }

  try {
    // 해당 근무가 진짜 이 알바에게 배정된 건지 확인
    const [shifts] = await pool.query(
      'SELECT shift_id, assigned_user_id FROM shifts WHERE shift_id = ?',
      [shift_id]
    );

    if (shifts.length === 0) {
      return res.status(404).json({ error: '해당 근무를 찾을 수 없습니다.' });
    }

    if (shifts[0].assigned_user_id !== userId) {
      return res.status(403).json({ error: '본인 근무에 대해서만 대타 요청이 가능합니다.' });
    }

    const [result] = await pool.query(
      `INSERT INTO shift_swap_requests (shift_id, from_user_id, to_user_id, note)
       VALUES (?, ?, ?, ?)`,
      [shift_id, userId, to_user_id, note]
    );

    const [rows] = await pool.query(
      `SELECT 
         r.request_id, r.shift_id, r.from_user_id, r.to_user_id,
         r.status, r.note, r.created_at, r.updated_at
       FROM shift_swap_requests r
       WHERE r.request_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/requests error:', err);
    res.status(500).json({ error: '대타 요청 생성 중 오류가 발생했습니다.' });
  }
});

// OWNER: 대타 요청 승인/거절
// PATCH /api/requests/:id
// body: { status }  // ACCEPTED, REJECTED, CANCELLED
router.patch('/:id', requireRole('OWNER'), async (req, res) => {
  const requestId = req.params.id;
  const { status } = req.body;
  const deciderId = req.user.user_id;

  if (!['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'status 값이 올바르지 않습니다.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM shift_swap_requests WHERE request_id = ?',
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    const reqRow = rows[0];

    await pool.query(
      `UPDATE shift_swap_requests
       SET status = ?, decided_by = ?, decided_at = NOW()
       WHERE request_id = ?`,
      [status, deciderId, requestId]
    );

    // 승인 시: 해당 근무의 assigned_user_id를 to_user_id로 변경
    if (status === 'ACCEPTED' && reqRow.to_user_id) {
      await pool.query(
        'UPDATE shifts SET assigned_user_id = ? WHERE shift_id = ?',
        [reqRow.to_user_id, reqRow.shift_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/requests/:id error:', err);
    res.status(500).json({ error: '대타 요청 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
