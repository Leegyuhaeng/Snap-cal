import type { Request, Response } from 'express';

import * as authService from '../services/auth.service';
import { AppError } from '../utils/AppError';

/**
 * ─────────────────────────────────────────────────────────
 * Controller 의 책임은 딱 4가지다.
 *   ① req 에서 값 꺼내기
 *   ② 형식 검증
 *   ③ Service 호출 (값만 넘긴다)
 *   ④ 결과를 HTTP 응답으로 포장
 *
 * 계산도, DB 접근도 하지 않는다.
 * Vue 로 치면 컴포넌트의 handleSubmit() 에 해당한다.
 * ─────────────────────────────────────────────────────────
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const NICKNAME_MAX_LENGTH = 30;

/**
 * 회원가입 입력 검증.
 *
 * ⚠️ 프론트에서 이미 검증했더라도 여기서 반드시 다시 한다.
 *    브라우저를 거치지 않으면 Vue 검증 코드는 실행조차 되지 않는다.
 *
 *      curl -X POST .../signup -d '{"email":"ㅋ","password":"1"}'
 *
 *    프론트 검증은 UX 용이고, 백엔드 검증이 유일한 실질적 방어선이다.
 */
function validateSignupInput(body: unknown): authService.SignupInput {
  // body 가 객체가 아닐 수도 있다. (문자열, 배열, null, undefined ...)
  if (typeof body !== 'object' || body === null) {
    throw new AppError('요청 본문이 올바르지 않습니다.', 400);
  }

  const { email, password, nickname } = body as Record<string, unknown>;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('올바른 이메일 형식이 아닙니다.', 400);
  }

  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`, 400);
  }

  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    throw new AppError('닉네임을 입력해주세요.', 400);
  }

  if (nickname.trim().length > NICKNAME_MAX_LENGTH) {
    // DB 컬럼이 VARCHAR(30) 이므로 넘치면 DB 에러가 난다.
    // DB 까지 가기 전에 여기서 막아 친절한 메시지를 준다.
    throw new AppError(`닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`, 400);
  }

  return { email, password, nickname };
}

/**
 * POST /api/auth/signup
 *
 * 201 Created — 새 리소스(유저)가 생성되었으므로 200 이 아니다.
 */
export async function signup(req: Request, res: Response): Promise<void> {
  const input = validateSignupInput(req.body); // ①②

  const user = await authService.signup(input); // ③ 값만 넘긴다

  res.status(201).json(user); // ④ passwordHash 는 애초에 담겨 있지 않다
}

/**
 * 💡 try/catch 가 없는 이유
 *
 * Express 5 는 async 핸들러에서 발생한 에러를 자동으로 잡아
 * 에러 처리 미들웨어로 넘겨준다. (Express 4 에서는 서버가 조용히 멈췄다)
 *
 * 그래서 Controller 는 "정상 흐름"만 적으면 되고,
 * 에러 응답은 app.ts 의 에러 핸들러가 한 곳에서 책임진다.
 */
