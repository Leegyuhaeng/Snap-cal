import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { checkDatabaseConnection } from './config/prisma';

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

// 위의 어떤 라우트에도 걸리지 않은 요청 = 404
app.use((_req, res) => {
  res.status(404).json({ message: '존재하지 않는 API 경로입니다.' });
});

// app 을 export 만 하고 listen 은 하지 않는다. (server.ts 가 담당)
export default app;
