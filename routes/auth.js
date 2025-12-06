// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// 로그인: POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password_hash, role, store_id FROM users WHERE email = ?',
      [email],
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role,
        store_id: user.store_id,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id,
      },
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res
      .status(500)
      .json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// ⭐ 회원가입: POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: '이름, 이메일, 비밀번호는 필수입니다.' });
  }

  try {
    // 이메일 중복 체크
    const [exists] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email],
    );
    if (exists.length > 0) {
      return res
        .status(409)
        .json({ error: '이미 존재하는 이메일입니다.' });
    }

    const hash = await bcrypt.hash(password, 10);

    // 데모/과제용: store_id는 일단 NULL로 두거나, 필요하면 기본 값(1) 등으로
    const storeId = null;
    const userRole = role === 'OWNER' ? 'OWNER' : 'STAFF';

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, store_id)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, hash, userRole, storeId],
    );

    res.status(201).json({ user_id: result.insertId });
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res
      .status(500)
      .json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
