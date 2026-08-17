# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트에서 작업을 이어받을 때 읽는 인수인계서다.
(학습용 상세 설명은 `docs/` 폴더에 있다.)

---

## 1. 프로젝트 개요 — **snapcal**

**AI 음식 사진 칼로리 분석 및 식단 캘린더 앱.** (모노레포: `server/` + `web/`)

사용자가 음식 사진을 올리면 AI 비전 API가 음식을 인식해 칼로리와 탄수화물/단백질/지방을
추출하고, 이를 날짜별 식단 캘린더로 기록·조회한다. 유저의 기초대사량(BMR) 대비
섭취량을 비교하는 것이 핵심 가치다.

**이 프로젝트의 성격**: 단순 토이 프로젝트가 아니라 **"확장 가능한 구조를 학습"** 하는 것이 목적.
따라서 당장 불필요해 보여도 확장을 고려한 설계(3계층 분리, 상태 컬럼, 이력 테이블 등)를 유지한다.

---

## 2. ⭐ 멘토링 진행 규칙 (매우 중요 — 반드시 준수)

사용자는 **Vue 프론트엔드 3년 경력**이지만 **백엔드/인프라는 완전 입문자**다.

1. **절대 모든 코드를 한 번에 작성하지 않는다. 한 번에 하나의 Step만 진행한다.**
2. **코드를 주기 전에 반드시 개념을 먼저 설명한다.** "왜 이 기술이 필요한가",
   "데이터가 어떻게 흐르는가"를 **프론트엔드(Vue) 경험에 빗대어** 비유로 설명한다.
   - 예: JWT = 놀이공원 손목 밴드 / 미들웨어 = 전역 라우터 가드 /
     Service = composable / Prisma = 타입이 자동 생성되는 axios
3. 각 Step이 끝나면 **사용자에게 진행 여부를 묻고 답변을 기다린다.**
4. **Step 완료 시마다 `docs/NN-제목.md` 학습 노트를 작성**하고 `docs/README.md`의
   진행 현황과 이 파일의 §6을 갱신한다.
5. 사용자가 개념 질문을 하면 (예: "eXERD랑 뭐가 다른데?") **진도를 멈추고 충분히 설명**한다.
   설명이 길어지면 `docs/concepts/`에 별도 문서로 남긴다.

### 조직 정책 (준수 필수)
- **DB 스키마/데이터 변경 명령은 Claude가 직접 실행하지 않는다.**
  `prisma migrate dev`, `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE` 등은
  **명령문만 제시하고 사용자가 직접 실행**하게 안내한다. (조회성 쿼리는 실행 가능)
- 소스 코드의 Git/SVN 실제 반영은 사용자의 검토와 승인을 거친다. 요청 없이 커밋하지 않는다.

---

## 3. 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | Vue 3 (별도 저장소, 아직 미착수) |
| 백엔드 | Express 5 + TypeScript (CommonJS) |
| DB / ORM | MySQL 8 + Prisma |
| 인증 | JWT (Access Token) |
| 이미지 스토리지 | Cloudinary 또는 AWS S3 (미확정) |
| AI | 비전 API (모델 미확정 — Step 8에서 결정) |
| 배포 | Vercel(프론트) / Railway(백엔드 + DB) |
| 런타임 | **Node.js v24.18.1 (Active LTS), npm 11.16.0** (asdf 관리 — `.tool-versions`) |

### ⚠️ Prisma 7 주의사항 (튜토리얼 대부분은 6.x 기준이라 다름)

실제로 `prisma validate`로 검증하며 확인한 사항이다. **추측하지 말 것.**

| 항목 | Prisma 6 이하 (구 정보) | **Prisma 7 (이 프로젝트)** |
|---|---|---|
| 접속 URL 위치 | `schema.prisma`의 `datasource.url` | **`prisma.config.ts`** (루트) — schema에 `url` 쓰면 P1012 에러 |
| generator provider | `prisma-client-js` | **`prisma-client`** |
| 클라이언트 출력 위치 | `node_modules/.prisma` | **`src/generated/prisma`** (gitignore됨) |
| CJS 대응 | 자동 | **`moduleFormat = "cjs"`** 명시 필요 |
| 런타임 접속 | URL 자동 | **드라이버 어댑터 필요** → `@prisma/adapter-mariadb` (MySQL 호환) |
| Node 요구사항 | 18.18+ | **20.19+ / 22.12+ / 24.0+** |

---

## 4. 아키텍처 원칙 (코드 작성 시 반드시 지킬 것)

### 3계층 구조
```
Router → Controller → Service → Prisma → MySQL
```

| 계층 | 책임 | 금지 사항 |
|---|---|---|
| Router | 경로와 핸들러 연결 | 비즈니스 로직 |
| Controller | req 파싱, 입력 검증, 응답 포장 | 계산, DB 직접 접근 |
| Service | **모든 비즈니스 로직**, DB 접근 | `req` / `res` 참조 |

**철칙**: Service는 `req`, `res`를 절대 몰라야 한다. HTTP는 껍데기일 뿐이며,
로직은 껍데기를 몰라야 재사용·테스트가 가능하다.

### 보안 철칙
- **`userId`는 반드시 JWT 토큰에서만 꺼낸다.** 쿼리스트링/body의 userId는 절대 신뢰하지 않는다.
- AI API 키, DB 비밀번호 등은 서버에만 존재한다. 프론트에서 AI API를 직접 호출하지 않는다.
- 비밀번호는 bcrypt 해시로만 저장한다. 평문 저장 절대 금지.
- `.env`는 절대 커밋하지 않는다. `.env.example`에는 키 이름만 남긴다.

### 이미지 처리 원칙
DB에는 이미지 바이너리를 저장하지 않는다. 클라우드 스토리지에 업로드 후
**URL(`imageUrl`)과 삭제용 식별자(`imageKey`)만** MySQL에 저장한다.

---

## 5. 디렉터리 구조

**모노레포 구조.** 저장소는 하나지만 `server/`와 `web/`은 독립 실행·독립 배포된다.
(로컬 폴더명은 아직 `Calorie-project`이지만 프로젝트명은 **snapcal**이다.)

```
snapcal/
├── CLAUDE.md              # 이 파일 (Claude용 인수인계)
├── README.md              # 프로젝트 소개 + 새 PC 세팅 절차
├── .gitignore             # 모노레포 공통 (하위 폴더 전체 적용)
├── .tool-versions         # asdf Node 버전 고정 (git 포함)
├── docs/                  # 사용자용 학습 노트
│   ├── README.md          # 목차 + 진행 현황 + 프론트↔백 대응표
│   ├── 00-architecture.md
│   ├── 01-project-setup.md
│   ├── 02-database-setup.md
│   └── concepts/          # 개념 심화 문서
├── web/                   # Vue 3 (아직 비어 있음)
└── server/                # ⭐ 백엔드 작업은 전부 여기서
    ├── docker-compose.yml # 개발용 MySQL (compose 프로젝트명: snapcal)
    ├── .env               # 실제 비밀값 (git 제외)
    ├── .env.example       # 양식 (git 포함)
    ├── prisma.config.ts   # Prisma 7 접속 설정 (URL은 여기)
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/    # 20260802164337_init 적용됨
    ├── src/
    │   ├── config/env.ts  # 환경변수 로드 및 검증
    │   ├── app.ts         # 미들웨어 조립 (listen 하지 않음)
    │   ├── server.ts      # 포트 listen + graceful shutdown
    │   ├── generated/     # Prisma Client (git 제외, 재생성 가능)
    │   ├── routes/auth.route.ts
    │   ├── controllers/auth.controller.ts
    │   ├── services/auth.service.ts
    │   ├── utils/AppError.ts
    │   ├── middlewares/   # (Step 5~)
    │   └── types/
    ├── tsconfig.json
    └── package.json       # name: snapcal-server
```

### 명령어 (전부 `server/`에서 실행)
```bash
npm run dev        # tsx watch — 저장 시 자동 재시작
npm run typecheck  # tsc --noEmit (타입만 검사)
npm run build      # dist/ 로 컴파일

docker compose up -d          # DB 켜기
docker compose down -v        # ⚠️ DB 완전 초기화

npx prisma migrate dev --name 변경내용   # 스키마 변경 (사용자가 실행)
npx prisma generate                      # 타입 재생성 (Prisma 7은 자동 아님)
npx prisma studio                        # 브라우저 DB 뷰어
```

---

## 6. 진행 현황

| Step | 내용 | 상태 |
|---|---|---|
| 0 | 아키텍처 설계 + DB 스키마 설계 | ✅ 완료 |
| 1 | 프로젝트 초기 세팅 (TS + Express + 3계층 폴더) | ✅ 완료 (검증됨) |
| 2 | Prisma 연결 + 첫 마이그레이션 | ✅ 완료 (검증됨) |
| 3 | 회원가입 API (bcrypt + 3계층 첫 실습) | ✅ 완료 (검증됨) |
| 4 | 로그인 API (JWT 발급) | ⬜ **← 다음 시작 지점** |
| 5 | 인증 미들웨어 (토큰 검증) | ⬜ |
| 6 | 신체정보 등록 + BMR/TDEE 계산 | ⬜ |
| 7 | 이미지 업로드 (multer + Cloudinary) | ⬜ |
| 8 | AI 분석 연동 + 트랜잭션 저장 ⭐ | ⬜ |
| 9 | 캘린더 조회 API | ⬜ |
| 10 | 에러 핸들링 + Railway 배포 | ⬜ |

### Step 2 진행 상황 (상세)

**완료된 것**
- DB 환경: **Docker 로컬 MySQL 8.0** 채택 (배포용 Railway는 Step 10에서)
- `docker-compose.yml` 작성 → 컨테이너 `calorie-mysql` 실행 중 (healthy 확인)
  - 검증됨: MySQL 8.0.46 / utf8mb4 / KST / `calorie_db` 생성 / `127.0.0.1` 바인딩
  - 비밀번호는 `.env`의 `${MYSQL_ROOT_PASSWORD}` 참조 (compose 파일에 평문 없음)
- Node 16 → 20 → **24.18.1** 업그레이드 (Prisma 7 요구사항)
- `prisma` 7.9.1 + `@prisma/client` 7.9.1 설치
- `prisma/schema.prisma` 작성 완료 → **`prisma validate` 통과**
- `prisma.config.ts` 작성 (Prisma 7의 새 접속 설정 방식)

- ✅ **첫 마이그레이션 완료** — `20260802164337_init`
  - 테이블 5개 생성: `users`, `body_records`, `meals`, `meal_items`, `ai_analysis_logs`
  - `_prisma_migrations` 기록 확인됨
  - ⚠️ Prisma 7은 `migrate dev`가 클라이언트를 자동 생성하지 않는다.
    `npx prisma generate`를 따로 실행해야 `src/generated/prisma`가 만들어진다.
- ✅ **모노레포로 재구성** — 백엔드를 `server/`로 이동, 프로젝트명 `snapcal` 확정
  - compose에 `name: snapcal` 명시 → 폴더명이 바뀌어도 볼륨 이름이 안 변함
  - 컨테이너 `snapcal-mysql` / 볼륨 `snapcal_snapcal-mysql-data` / DB `snapcal_db`

- ✅ **Express ↔ DB 연결 완료**
  - `@prisma/adapter-mariadb` 설치 → `new PrismaMariaDb(env.databaseUrl)`
  - `src/config/prisma.ts` — PrismaClient **싱글턴** + `checkDatabaseConnection()` + `disconnectPrisma()`
  - `/health`가 `SELECT 1`로 DB 확인 → 실패 시 **503** 반환
  - `server.ts` graceful shutdown에서 커넥션 풀 정리
  - 개발 환경에서 `log: ['query']` 켜둠 → 실행 SQL이 터미널에 찍힘
  - **검증됨**: `GET /health` → 200 `{"status":"ok","database":"connected"}`
    첫 요청 108ms → 두 번째 1.7ms (커넥션 풀 재사용 확인)

- ✅ **git 초기화 + GitHub 푸시 완료**
  - 저장소: `git@github.com-master:Leegyuhaeng/Snap-cal.git` (main 브랜치, 28개 파일)
  - ⚠️ **SSH alias 주의**: 사용자는 개인/회사 GitHub 계정을 `~/.ssh/config`로 분리해 씀.
    - `github.com-master` → 개인 (Leegyuhaeng)
    - `github.com-greenit` → 회사 (GreenIT-Aaron)
    - 그냥 `github.com`은 **매핑이 없어 Permission denied가 난다.**
      clone/remote 주소에 반드시 `-master`를 붙일 것.
  - SSH 키에 passphrase가 걸려 있어 push 시 입력이 필요하다.
    (비대화형 셸에서는 `git ls-remote` 등이 실패하니, 원격 확인은 사용자에게 요청할 것)

**⬜ 참고 사항**
- 로컬 폴더명은 아직 `Calorie-project` (프로젝트명은 snapcal, 저장소는 Snap-cal).
  compose에 `name: snapcal`이 있어 폴더명을 바꿔도 볼륨은 안 깨진다.
- `web/`은 빈 폴더. Vue 프로젝트는 아직 시작 안 함.

---

### Step 3 완료 내용 (회원가입 API)

**만든 파일**
```
src/routes/auth.route.ts            POST /signup 연결만
src/controllers/auth.controller.ts  검증 + service 호출 + 201 포장
src/services/auth.service.ts        중복확인 → bcrypt → prisma.create
src/utils/AppError.ts               AppError + isAppError + isHttpErrorLike
src/app.ts                          authRouter 연결 + 에러 미들웨어 추가
```

**설치**: `bcrypt` 6.0.0 + `@types/bcrypt` (네이티브 모듈, Node 24에서 정상 동작 확인 / cost 10 = 약 70ms)

**핵심 구현 사항**
- `SALT_ROUNDS = 10` (로그인 응답 100~250ms 기준. 올릴 땐 서버 CPU 비용 고려)
- 이메일은 `trim().toLowerCase()` 로 정규화 후 저장·조회
- 응답은 `select` 화이트리스트 → `passwordHash` 가 애초에 조회되지 않음
- 동시성: 중복확인과 create 사이 틈 → `P2002` 도 409로 변환 (DB UNIQUE가 최종 방어선)
- 에러 미들웨어는 **인자 4개**, 맨 마지막. Express 5라 Controller에 try/catch 불필요

**⚠️ 테스트로 잡은 버그 (재발 주의)**
`express.json()` 이 던지는 파싱 에러는 Controller보다 먼저 발생하며
`statusCode` + `expose: true` 를 달고 온다. 이걸 AppError만 보고 500으로 처리하면
명백한 400 요청에 500을 돌려주게 된다 → `isHttpErrorLike()` 로 처리함.

**검증**: 11개 시나리오 전부 통과 (201/409/400 × 형식오류·중복·대문자이메일·깨진JSON 등)
테스트 유저 2명이 DB에 남아 있음 (`test@snapcal.com`, `second@snapcal.com`, 둘 다 `password123`)

---

### Step 4 시작 시 할 일 (다음 세션)

1. **작업 재개**: `cd /Users/igyuhaeng/project/Calorie-project/server && docker compose up -d`
   (⚠️ 셸 cwd가 루트로 리셋되는 경우가 잦음. **명령은 항상 절대 경로로 안내할 것**)
2. **개념 설명 먼저**:
   - JWT = 놀이공원 손목 밴드 (위조 방지 서명, 무상태)
   - 토큰 저장 위치 트레이드오프: localStorage(XSS 취약) vs httpOnly 쿠키(CSRF 고려)
   - **타이밍 공격** — 유저가 없으면 bcrypt를 안 돌려 빨리 응답 → "빠른 실패 = 없는 계정"이 샌다
3. **만들 것**: `POST /api/auth/login`, `utils/jwt.ts`, `.env`에 `JWT_SECRET`
4. **🚨 철칙**: 로그인 실패 사유를 구분하지 말 것.
   이메일 없음/비밀번호 틀림 모두 `401 이메일 또는 비밀번호가 올바르지 않습니다.`
5. 완료 후 `docs/04-login-jwt.md` 작성 + `docs/README.md`·이 파일 §6 갱신

---

## 7. 주요 의사결정 기록

| 결정 | 이유 |
|---|---|
| `module: "commonjs"` (ESM 아님) | ESM은 TS 파일에 `.js` 확장자를 붙여야 하는 함정이 있어 입문자에게 불필요한 고통을 줌 |
| Express **5** (4 아님) | async 핸들러의 에러를 자동으로 캐치. AI 호출 등 비동기가 많은 이 프로젝트에 유리 |
| `app.ts` / `server.ts` 분리 | 테스트 시 포트를 열지 않고 app만 import 하기 위함 (supertest 대비) |
| `noUncheckedIndexedAccess: true` | AI 응답 배열 처리 시 안전. 성가시면 해제 가능 |
| id를 `uuid` | 자동증가 정수는 유저 수가 노출되고 타인 id 추측이 쉬움 |
| 영양성분에 `Decimal` | Float은 `0.1+0.2=0.30000000000000004` 문제 발생 |
| 키/몸무게를 `BodyRecord`로 분리 | 덮어쓰면 체중 변화 이력이 사라짐. 다이어트 앱의 핵심 기능이 됨 |
| `Meal` : `MealItem` = 1:N | 사진 1장에 음식이 여러 개. JSON 통짜 저장 시 "많이 먹은 음식 TOP5" 같은 집계 불가 |
| `Meal.totalCalories` 비정규화 | 캘린더가 월 90건의 합계를 매번 계산하는 비용 회피 (변경 시 트랜잭션으로 함께 갱신할 것) |
| `Meal.status` 컬럼 선반영 | 현재는 동기 처리지만, 향후 큐 기반 비동기 전환 시 스키마 변경 없이 대응 |
| `AiAnalysisLog` 테이블 | AI 원본 응답 보관. 프롬프트 개선·모델 비교·디버깅에 필수 |
| `eatenAt` / `createdAt` 분리 | 어젯밤 야식을 오늘 아침에 기록하는 경우. 캘린더는 `eatenAt` 기준 |
| bcrypt cost 10 | 실측 70ms. cost 비용은 해커가 아니라 **우리 서버**가 냄. 동시 로그인 시 스레드풀 포화 → 자체 DoS 위험 |
| 이메일 소문자 정규화 | `Test@a.com` 과 `test@a.com` 이 다른 계정이 되면 안 됨 |
| 응답에 `select` 화이트리스트 | "빼는" 방식은 컬럼 추가 시 새어나감. "고르는" 방식이 안전 |
| 회원가입 중복은 409로 명시 | user enumeration 위험은 있으나 UX 손실이 더 큼. GitHub/Google도 동일. Step 10에서 rate limiting으로 보완 |
| 입력 검증을 손으로 작성 | zod를 쓰면 편하지만, 검증이 왜 필요한지 먼저 체득하는 게 학습에 나음. 나중에 교체 가능 |

---

## 8. 사용자 배경 메모

- Vue 3 프론트엔드 실무 3년. Pinia, vue-router, composable, axios 인터셉터에 익숙하다.
- **백엔드/인프라는 처음.** Docker, Express, ORM 모두 미경험.
- 회사에서 **eXERD**(ERD 모델링 툴)를 사용한 경험이 있다.
  → DB 설명 시 "ERD 그림 = `schema.prisma`", "포워드 엔지니어링 DDL = 마이그레이션 파일"로
    대응시키면 이해가 빠르다. (`docs/concepts/orm-migration-vs-exerd.md` 참고)
- 개념이 명확하지 않으면 진도를 나가지 않고 질문한다. **좋은 신호이므로 충분히 답할 것.**
