const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shiftmate-secret-key';

// POST /api/auth/login
// body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, role, store_id, status FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '존재하지 않는 계정입니다.' });
    }

    const user = rows[0];

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: '비활성화된 계정입니다.' });
    }

    // ★ 데모용 간단 비밀번호 체크: "demo1234"만 허용
    if (password !== 'demo1234') {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다. (demo1234 사용)' });
    }

    const payload = {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      store_id: user.store_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// GET /api/auth/me
// 헤더 Authorization: Bearer <token>
router.get('/me', authRequired, (req, res) => {
  res.json(req.user);
});

module.exports = router;
