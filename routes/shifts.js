const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/shifts
// 사장님: 본인 매장의 전체 근무표
router.get('/', requireRole('OWNER'), async (req, res) => {
  const storeId = req.user.store_id;
  if (!storeId) {
    return res.status(400).json({ error: '사장 계정에 store_id가 없습니다.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 
         s.shift_id, s.store_id, s.assigned_user_id, s.date_only,
         s.start_at, s.end_at, s.break_minutes,
         s.status, s.duration_minutes,
         u.name AS assigned_user_name
       FROM shifts s
       LEFT JOIN users u ON u.user_id = s.assigned_user_id
       WHERE s.store_id = ?
       ORDER BY s.start_at`,
      [storeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/shifts error:', err);
    res.status(500).json({ error: '근무표 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/shifts/my
// 알바생: 내 근무표
router.get('/my', async (req, res) => {
  const userId = req.user.user_id;

  try {
    const [rows] = await pool.query(
      `SELECT 
         s.shift_id, s.store_id, s.assigned_user_id, s.date_only,
         s.start_at, s.end_at, s.break_minutes,
         s.status, s.duration_minutes,
         st.name AS store_name
       FROM shifts s
       JOIN stores st ON st.store_id = s.store_id
       WHERE s.assigned_user_id = ?
       ORDER BY s.start_at`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/shifts/my error:', err);
    res.status(500).json({ error: '내 근무표 조회 중 오류가 발생했습니다.' });
  }
});

// POST /api/shifts
// 사장님: 새 근무 생성
// body: { start_at, end_at, assigned_user_id?, break_minutes? }
router.post('/', requireRole('OWNER'), async (req, res) => {
  const storeId = req.user.store_id;
  const creatorId = req.user.user_id;
  const { start_at, end_at, assigned_user_id = null, break_minutes = 0 } = req.body;

  if (!start_at || !end_at) {
    return res.status(400).json({ error: 'start_at과 end_at은 필수입니다.' });
  }

  try {
    const dateOnly = start_at.substring(0, 10); // 'YYYY-MM-DD'

    const [result] = await pool.query(
      `INSERT INTO shifts (store_id, assigned_user_id, date_only, start_at, end_at, break_minutes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [storeId, assigned_user_id, dateOnly, start_at, end_at, break_minutes, creatorId, creatorId]
    );

    const [rows] = await pool.query(
      `SELECT 
         s.*, u.name AS assigned_user_name
       FROM shifts s
       LEFT JOIN users u ON u.user_id = s.assigned_user_id
       WHERE s.shift_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/shifts error:', err);
    res.status(500).json({ error: '근무 생성 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/shifts/:id
// 사장님: 근무 일부 수정
router.patch('/:id', requireRole('OWNER'), async (req, res) => {
  const shiftId = req.params.id;
  const updaterId = req.user.user_id;
  const { start_at, end_at, assigned_user_id, status, break_minutes } = req.body;

  const fields = [];
  const values = [];

  if (start_at) { fields.push('start_at = ?'); values.push(start_at); }
  if (end_at) { fields.push('end_at = ?'); values.push(end_at); }
  if (assigned_user_id !== undefined) { fields.push('assigned_user_id = ?'); values.push(assigned_user_id); }
  if (status) { fields.push('status = ?'); values.push(status); }
  if (break_minutes !== undefined) { fields.push('break_minutes = ?'); values.push(break_minutes); }

  if (fields.length === 0) {
    return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  }

  fields.push('updated_by = ?');
  values.push(updaterId);

  values.push(shiftId);

  try {
    await pool.query(
      `UPDATE shifts SET ${fields.join(', ')} WHERE shift_id = ?`,
      values
    );

    const [rows] = await pool.query(
      `SELECT s.*, u.name AS assigned_user_name
       FROM shifts s
       LEFT JOIN users u ON u.user_id = s.assigned_user_id
       WHERE s.shift_id = ?`,
      [shiftId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/shifts/:id error:', err);
    res.status(500).json({ error: '근무 수정 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/shifts/:id
// 사장님: 근무 삭제(물리 삭제)
router.delete('/:id', requireRole('OWNER'), async (req, res) => {
  const shiftId = req.params.id;

  try {
    await pool.query('DELETE FROM shifts WHERE shift_id = ?', [shiftId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/shifts/:id error:', err);
    res.status(500).json({ error: '근무 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
