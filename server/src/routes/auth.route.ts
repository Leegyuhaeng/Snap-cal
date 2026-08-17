import { Router } from 'express';

import * as authController from '../controllers/auth.controller';

/**
 * 인증 관련 라우트.
 *
 * Router 의 책임은 "주소 ↔ 담당자 연결" 이 전부다. 로직은 한 줄도 없다.
 * Vue 의 router/index.ts 에 있는 routes 배열과 같은 역할이다.
 *
 *   { path: '/signup', component: SignupView }   ← Vue
 *   router.post('/signup', authController.signup) ← Express
 *
 * app.ts 에서 '/api/auth' 아래에 붙이므로
 * 여기서는 그 뒤의 경로만 적는다. (최종: POST /api/auth/signup)
 */
const router = Router();

router.post('/signup', authController.signup);

// Step 4 에서 추가될 것
// router.post('/login', authController.login);

export default router;
