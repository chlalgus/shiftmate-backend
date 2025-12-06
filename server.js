require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const shiftRoutes = require('./routes/shifts');
const requestRoutes = require('./routes/requests');
const messageRoutes = require('./routes/messages');
const { authRequired } = require('./middleware/authMiddleware');
const userRoutes = require('./routes/users');

const app = express();

// CORS 설정 (프론트가 Vite라면 5173)
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// DB 테스트용
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json(rows);
  } catch (err) {
    console.error('test-db error:', err);
    res.status(500).json({ error: 'DB 연결 오류', detail: err.message });
  }
});

// 라우터 등록
app.use('/api/auth', authRoutes);
// 아래 API들은 전부 인증 필요
app.use('/api/shifts', authRequired, shiftRoutes);
app.use('/api/requests', authRequired, requestRoutes);
app.use('/api/messages', authRequired, messageRoutes);
app.use('/api/users', authRequired, userRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
