const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/messages
// 나와 관련된 DM 모두
router.get('/', async (req, res) => {
  const userId = req.user.user_id;

  try {
    const [rows] = await pool.query(
      `SELECT 
         m.message_id,
         m.sender_id, m.receiver_id, m.content,
         m.created_at, m.read_at,
         su.name AS sender_name,
         ru.name AS receiver_name
       FROM messages m
       JOIN users su ON su.user_id = m.sender_id
       JOIN users ru ON ru.user_id = m.receiver_id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [userId, userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/messages error:', err);
    res.status(500).json({ error: '메시지 조회 중 오류가 발생했습니다.' });
  }
});

// POST /api/messages
// body: { receiver_id, content }
router.post('/', async (req, res) => {
  const senderId = req.user.user_id;
  const storeId = req.user.store_id; // 사장/직원 모두 같은 매장이라고 가정
  const { receiver_id, content } = req.body;

  if (!receiver_id || !content) {
    return res.status(400).json({ error: 'receiver_id와 content는 필수입니다.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO messages (store_id, sender_id, receiver_id, content)
       VALUES (?, ?, ?, ?)`,
      [storeId, senderId, receiver_id, content]
    );

    const [rows] = await pool.query(
      `SELECT 
         m.message_id, m.sender_id, m.receiver_id, m.content,
         m.created_at, m.read_at,
         su.name AS sender_name,
         ru.name AS receiver_name
       FROM messages m
       JOIN users su ON su.user_id = m.sender_id
       JOIN users ru ON ru.user_id = m.receiver_id
       WHERE m.message_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/messages error:', err);
    res.status(500).json({ error: '메시지 전송 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
