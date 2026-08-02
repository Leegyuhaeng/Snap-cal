# Step 1 — 프로젝트 초기 세팅

> **이 단계의 목표**: TypeScript + Express 서버를 띄우고, 3계층 아키텍처를 담을
> 폴더 뼈대를 만든다. "서버가 켜지고 응답한다"를 눈으로 확인하는 것이 완료 조건.

---

## 0. 사전 준비 — Node 버전

처음 확인했을 때 **Node v16.20.2**였고, 이건 진행 불가 수준이었다.

| 문제 | 영향 |
|---|---|
| Node 16은 2023-09 EOL | 보안 패치 없음 |
| Prisma 6는 Node 18.18+ 필요 | **Step 2에서 바로 막힘** |
| Express 5는 Node 18+ 필요 | 설치 시 `EBADENGINE` 경고 |

→ **asdf로 Node 20 설치 후 진행.** (현재 v20.18.3 / npm 10.8.2)

```bash
asdf install nodejs 20.18.3
asdf local nodejs 20.18.3   # 프로젝트 루트에 .tool-versions 생성
```

### `.tool-versions` 파일

프로젝트 루트에 이 파일이 생겼다.

```
nodejs 20.18.3
```

**이 폴더에 들어오면 asdf가 자동으로 Node 20.18.3으로 전환해준다.**
`.nvmrc`와 같은 역할이며, **반드시 Git에 커밋해야 한다.** 그래야 다른 사람(혹은 미래의 나)이
`git clone` 했을 때 같은 Node 버전으로 자동 맞춰진다.

> **버전 관리자를 쓰는 이유**: 프론트에서 "이 프로젝트는 Node 18, 저건 20" 상황을
> 겪어봤을 것이다. asdf/nvm은 그걸 자동으로 전환해주는 도구다.
> asdf는 Node뿐 아니라 Python, Java 등도 같은 방식으로 관리한다.

---

## 1. Vue 프로젝트와 대응시키기

| 파일 | Vue의 무엇 | 차이점 |
|---|---|---|
| `package.json` | 똑같음 | 없음 |
| `tsconfig.json` | 거의 똑같음 | **`"lib"`에 `"DOM"`이 없다.** 서버에는 `window`도 `document`도 없다 |
| `tsx watch` | `vite dev` | 저장하면 자동 재시작 (HMR과 같은 역할) |
| `app.ts` | `App.vue` + `main.ts`의 플러그인 등록부 | 미들웨어를 조립하는 곳 |
| `server.ts` | `main.ts`의 `.mount('#app')` | 실제로 켜는 곳 |

### 미들웨어 = 전역 라우터 가드

```ts
app.use(cors())        // Express
app.use(router)        // Vue — 문법까지 똑같다
```

요청이 **위에서 아래로** 미들웨어를 차례로 통과하며 가공되는 파이프라인이다.
**그래서 순서가 진짜 중요하다.**

---

## 2. 설치한 패키지

```bash
npm install cors dotenv express morgan
npm install -D @types/cors @types/express @types/morgan @types/node tsx typescript
```

| 패키지 | 역할 | 없으면 생기는 일 |
|---|---|---|
| `express` | 웹 서버 프레임워크 | — |
| `cors` | 다른 출처 요청 허용 | Vue(5173)에서 fetch 시 CORS 에러 |
| `dotenv` | `.env` 파일을 `process.env`로 로드 | 환경변수가 전부 `undefined` |
| `morgan` | 요청 로그 출력 | 터미널에서 요청이 안 보여 디버깅 지옥 |
| `tsx` | TS를 컴파일 없이 실행 + 파일 감시 | 저장할 때마다 수동 재시작 |
| `@types/*` | 타입 정의 | `import express` 에서 타입 에러 |

---

## 3. 만들어진 구조

```
Calorie-project/
├── .env                 # 실제 비밀값 (Git 제외)
├── .env.example         # 양식만 (Git 포함)
├── .gitignore
├── package.json
├── tsconfig.json
└── src/
    ├── config/env.ts    ✅ 환경변수 로드 및 검증
    ├── app.ts           ✅ 미들웨어 조립
    ├── server.ts        ✅ 포트 열기
    ├── routes/          (Step 3~)
    ├── controllers/     (Step 3~)
    ├── services/        (Step 3~)
    ├── middlewares/     (Step 5~)
    ├── utils/
    └── types/
```

---

## 4. 각 파일의 역할

### `src/config/env.ts` — 환경변수의 단일 창구

```ts
dotenv.config();   // .env 를 읽어 process.env 에 채운다. 가장 먼저 실행돼야 함

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
```

**왜 `process.env`를 코드 여기저기서 직접 쓰지 않고 이 파일로 모으나?**

- 오타 방지: `process.env.PROT` 라고 쳐도 아무도 안 알려준다. `env.port`는 자동완성된다
- 타입: `process.env.PORT`는 항상 `string | undefined`. 여기서 한 번만 `Number()` 변환
- **Fail Fast**: `required()` 함수는 값이 없으면 서버를 아예 못 켜게 막는다.
  값이 `undefined`인 채 서버가 켜지면 **새벽 3시에 유저가 API를 호출한 순간에야 터진다.**
  차라리 시작 시점에 요란하게 죽는 게 100배 낫다

### `src/app.ts` — 미들웨어 조립

```ts
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', ...);          // 헬스 체크
app.use((_req, res) => { ... });  // 404 처리 (반드시 맨 아래)
export default app;               // ⭐ listen 하지 않는다
```

| 줄 | 없으면 |
|---|---|
| `cors(...)` | Vue에서 요청 시 브라우저가 차단 |
| `express.json()` | **`req.body`가 `undefined`** ← 입문자가 제일 많이 헤매는 지점 |
| `morgan('dev')` | 터미널에 요청이 안 찍힘 |
| 404 미들웨어 | 없는 경로 요청 시 Express 기본 HTML 에러 페이지가 나감 |

> **404 미들웨어는 반드시 맨 아래.** 위에 있으면 모든 요청을 먼저 잡아채서 전부 404가 된다.
> 미들웨어가 위→아래로 흐르기 때문.

`/health`는 관례적인 엔드포인트다. 나중에 Railway 같은 배포 플랫폼이 이 주소를
주기적으로 찔러 서버 생존을 확인한다.

### `src/server.ts` — 포트 열기 + 우아한 종료

```ts
const server = app.listen(env.port, () => { ... });

const shutdown = (signal: string) => {
  server.close(() => process.exit(0));  // 새 요청은 안 받되, 처리 중인 건 끝내고 종료
};
process.on('SIGINT', () => shutdown('SIGINT'));    // Ctrl + C
process.on('SIGTERM', () => shutdown('SIGTERM'));  // 배포 플랫폼의 종료 신호
```

**Graceful Shutdown이 왜 필요한가**: 서버를 그냥 죽이면 처리 중이던 요청이 중간에 끊긴다.
결제 처리 중이었다면? 끔찍하다. 배포할 때마다(Railway가 재시작할 때마다) 실제로 동작한다.

---

## 5. 왜 `app.ts`와 `server.ts`를 나눴나 ⭐

나중에 테스트 코드를 짤 때 **실제 포트를 열지 않고 `app`만 가져다** 요청을 흉내내고 싶기 때문.
(`supertest`라는 도구를 쓰게 된다.)

한 파일에 다 있으면 `import` 하는 순간 포트가 열려버려서 테스트가 꼬인다.
사소해 보이지만 이런 게 쌓여 "확장 가능한 구조"가 된다.

---

## 6. 주요 설정 결정과 이유

### `module: "commonjs"` (ESM 아님)

프론트에서는 `import/export`(ESM)가 당연하지만, Node 서버 생태계는 아직 과도기다.
ESM을 쓰면 **TS 파일인데도 `import { env } from './config/env.js'` 처럼 `.js` 확장자를
붙여야 하는** 규칙에 부딪힌다. 입문자가 크게 좌절하는 지점.

CommonJS로 하면 코드는 `import`로 똑같이 쓰면서 이 함정을 피한다.

### Express 5 (4 아님)

Express 4 튜토리얼이 훨씬 많지만, 5에는 결정적 장점이 있다.
**async 함수 안에서 에러가 나면 자동으로 잡아준다.**

Express 4에서는 이게 안 돼서 `try/catch`로 감싸거나 `express-async-handler`를 붙여야 했고,
안 하면 **서버가 조용히 멈춘다.** Step 8의 AI 호출처럼 실패 가능한 비동기가 많은
이 프로젝트에서는 5가 확실히 유리하다.

### `noUncheckedIndexedAccess: true`

`arr[0]`의 타입을 `T`가 아니라 `T | undefined`로 만든다. 배열이 비어 있을 수 있으니
이게 정직한 타입이다. 처음엔 성가시지만 Step 8에서 AI가 준 배열을 다룰 때 도움이 된다.
너무 불편하면 `tsconfig.json`에서 꺼도 된다.

### `.env` / `.env.example` 분리

Vue에서도 `.env`를 썼지만 **백엔드는 위험도가 차원이 다르다.**
Vue의 `VITE_` 변수는 어차피 공개되는 값이지만, 백엔드 `.env`에는
**DB 비밀번호와 AI API 키**가 들어간다.

GitHub에 실수로 올리면 봇이 몇 분 안에 긁어가 API 키로 결제를 태운다. 매우 흔한 사고다.
→ `.gitignore` 맨 위에 `.env`를 넣었다. `.env.example`은 "이런 값이 필요하다"는 목차 역할.

---

## 7. 실행 명령어

```bash
npm run dev        # tsx watch — 저장 시 자동 재시작
npm run typecheck  # tsc --noEmit — 타입만 검사 (빌드 없이 빠르게)
npm run build      # dist/ 로 컴파일
npm start          # 컴파일 결과 실행 (배포 환경)
```

---

## 8. 검증 결과 ✅

| 항목 | 결과 |
|---|---|
| `npm install` | 93개 패키지, 취약점 0개, EBADENGINE 경고 없음 |
| `npm run typecheck` | 통과 (에러 0) |
| 서버 기동 | 4000 포트 정상 |
| `GET /health` | `{"status":"ok","env":"development","timestamp":"..."}` |
| 없는 경로 | `404 {"message":"존재하지 않는 API 경로입니다."}` |
| morgan 로그 | `GET /health 200 1.620 ms - 74` |

마지막 항목이 중요하다. **터미널이 브라우저 Network 탭 역할을 하기 시작했다는 뜻**이다.
앞으로 Vue에서 요청을 쏠 때마다 이 로그가 실시간으로 찍힌다. 디버깅의 생명줄.

---

## 9. 다음 단계에서 추가될 것들

- `prisma/` 폴더 (Step 2)
- `routes/`, `controllers/`, `services/`에 실제 파일 (Step 3)
- `middlewares/authGuard.ts` (Step 5)
- `middlewares/errorHandler.ts` — 지금은 없다. Step 10에서 제대로 만든다
