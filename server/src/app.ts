import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { checkDatabaseConnection } from './config/prisma';
import authRouter from './routes/auth.route';
import { isAppError, isHttpErrorLike } from './utils/AppError';

const app = express();

/* ────────────────────────────────────────────
 * 미들웨어 조립 구간
 *
 * Vue 비유: main.ts 에서 app.use(router), app.use(pinia) 하는 것과
 * 문법도 개념도 똑같다. 다만 여기서는 "순서"가 진짜 중요하다.
 * 요청이 위에서 아래로 한 줄씩 통과하기 때문이다.
 * ──────────────────────────────────────────── */

// 1. CORS — 브라우저의 "다른 출처 차단" 정책을 뚫어주는 허가증.
//    Vue(5173) 와 서버(4000) 는 포트가 달라서 브라우저 입장에선 '남'이다.
//    이게 없으면 Vue에서 fetch 하는 순간 CORS 에러를 만나게 된다.
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);

// 2. JSON 파서 — 요청 body 는 원래 그냥 바이트 덩어리다.
//    이 줄이 있어야 req.body 가 객체로 변신한다. 없으면 undefined.
app.use(express.json({ limit: '1mb' }));

// 3. 요청 로거 — 터미널에 "POST /auth/login 200 15ms" 를 찍어준다.
//    브라우저 개발자도구의 Network 탭을 터미널에 옮겨놓은 것이라고 보면 된다.
app.use(morgan('dev'));

/* ────────────────────────────────────────────
 * 라우트
 * Step 3부터 여기에 app.use('/api/auth', authRouter) 형태로 붙는다.
 * ──────────────────────────────────────────── */

// 헬스 체크: "서버 살아있니?" 를 확인하는 관례적인 엔드포인트.
// 나중에 Railway 같은 배포 플랫폼이 이 주소를 주기적으로 찔러본다.
//
// ⭐ 서버 프로세스가 살아있어도 DB 가 죽어 있으면 아무 일도 못 한다.
//    그래서 "나 살아있어" 가 아니라 "나도 살아있고 DB 도 붙는다" 를 확인한다.
app.get('/health', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();

  // DB 가 죽었으면 200 이 아니라 503(Service Unavailable) 을 준다.
  // 배포 플랫폼이 이걸 보고 "이 인스턴스로 트래픽 보내지 말자" 고 판단한다.
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// 인증 관련 API — 이 아래로 POST /api/auth/signup 등이 붙는다
app.use('/api/auth', authRouter);

// 위의 어떤 라우트에도 걸리지 않은 요청 = 404
app.use((_req, res) => {
  res.status(404).json({ message: '존재하지 않는 API 경로입니다.' });
});

/* ────────────────────────────────────────────
 * 에러 처리 미들웨어
 *
 * ⚠️ 반드시 맨 마지막에, 그리고 인자가 4개여야 한다.
 *    Express 는 "인자 4개짜리 미들웨어"를 에러 핸들러로 식별한다.
 *    (err 를 빼고 3개로 쓰면 일반 미들웨어가 되어 절대 호출되지 않는다)
 *
 * Express 5 는 async 핸들러의 에러도 자동으로 여기로 보내준다.
 * 그래서 Controller 마다 try/catch 를 쓰지 않아도 된다.
 *
 * 지금은 최소 버전이다. Step 10 에서 로깅·에러 코드 체계를 붙여 제대로 만든다.
 * ──────────────────────────────────────────── */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // ① 우리가 의도적으로 던진 에러 → 메시지를 그대로 전달해도 안전하다
  if (isAppError(err)) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // ② express.json() 등 우리 코드보다 먼저 실행되는 미들웨어의 에러.
  //    잘못된 JSON, 본문 크기 초과 등 "클라이언트 잘못"이므로 4xx 를 유지한다.
  //    이걸 빠뜨리면 명백한 400 요청에 500 을 돌려주게 된다.
  if (isHttpErrorLike(err)) {
    res.status(err.statusCode).json({ message: '요청 본문을 해석할 수 없습니다.' });
    return;
  }

  // ③ 예상 못 한 에러 → 내부 정보를 숨긴다
  //
  // 스택 트레이스에는 서버 파일 경로, 라이브러리 버전, 때로는 쿼리까지 담긴다.
  // 그대로 응답하면 공격자에게 지도를 그려주는 셈이다.
  // 서버 로그에는 남기고, 유저에게는 뭉뚱그려 답한다.
  console.error('[Unhandled Error]', err);

  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

// app 을 export 만 하고 listen 은 하지 않는다. (server.ts 가 담당)
export default app;
