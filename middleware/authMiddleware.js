const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shiftmate-secret-key';

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: '인증 정보가 없습니다.(토큰 없음)' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { user_id, name, role, store_id }
    next();
  } catch (err) {
    console.error('authRequired error:', err.message);
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

// 역할 체크 (사장/알바 구분)
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증 필요' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };
