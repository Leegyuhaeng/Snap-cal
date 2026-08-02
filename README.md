# 🍚 snapcal

**음식 사진 한 장으로 칼로리를 기록하는 식단 캘린더.**

사진을 올리면 AI 비전 API가 음식을 인식해 칼로리와 탄수화물/단백질/지방을 추출하고,
날짜별 캘린더로 기록·조회한다. 기초대사량(BMR) 대비 섭취량 비교가 핵심 기능이다.

| 영역 | 기술 |
|---|---|
| 프론트엔드 | Vue 3 + TypeScript (Vercel) |
| 백엔드 | Express 5 + TypeScript (Railway) |
| DB / ORM | MySQL 8 (Docker) + Prisma 7 |
| 인증 | JWT |
| 이미지 | Cloudinary 또는 S3 |

---

## 📁 저장소 구조 (모노레포)

```
snapcal/
├── server/          Express + Prisma API 서버
│   ├── docker-compose.yml   개발용 MySQL
│   ├── prisma/              DB 설계도 + 마이그레이션
│   └── src/                 3계층 구조 (routes → controllers → services)
├── web/             Vue 3 프론트엔드 (예정)
├── docs/            학습 노트
└── CLAUDE.md        Claude Code 인수인계서
```

**서버와 웹이 한 저장소에 있지만 독립적으로 실행·배포된다.**
저장소만 하나일 뿐, 각자 자기 `package.json`을 가진다.

<details>
<summary>왜 모노레포인가</summary>

- **원자적 커밋** — "메모 기능 추가"가 스키마 + 서버 + 화면까지 한 커밋에 담긴다.
  분리돼 있으면 배포 순서가 어긋나 잠깐 깨지는 일이 생긴다.
- **타입 공유** — 서버가 정의한 응답 타입을 프론트가 그대로 import 한다.
  API 형식이 바뀌면 프론트에서 타입 에러로 즉시 잡힌다.
- **진입점 하나** — clone 한 번, 이슈 한 곳.

배포 시에는 각 플랫폼에 Root Directory를 알려준다. (Vercel → `web`, Railway → `server`)

</details>

---

## 🚀 새 PC에서 개발 환경 세팅

`git clone` 후 아래 순서대로. **약 5분.**

### 1. Node 버전 맞추기

```bash
asdf install nodejs 24.18.1   # .tool-versions 에 적힌 버전
node -v                       # v24.18.1 확인
```

> Node 24 필수 (Prisma 7 요구사항). asdf 대신 nvm 등을 써도 된다.

### 2. 환경변수 파일 만들기

```bash
cd server
cp .env.example .env
```

`.env` 를 열어 값을 채운다. **로컬 개발용이므로 아무 값이나 정해도 되지만,
개인적으로 쓰는 비밀번호는 재사용하지 말 것.**

```bash
MYSQL_ROOT_PASSWORD=원하는비밀번호
MYSQL_DATABASE=snapcal_db
DATABASE_URL="mysql://root:원하는비밀번호@localhost:3306/snapcal_db"
```

> ⚠️ `MYSQL_ROOT_PASSWORD` 와 `DATABASE_URL` 안의 비밀번호는 **반드시 일치**해야 한다.
> Prisma 는 환경변수 참조를 지원하지 않아 직접 적어야 한다.

### 3. MySQL 실행

```bash
docker compose up -d     # server/ 에서 실행
docker compose ps        # STATUS 가 (healthy) 될 때까지 20초쯤 대기
```

### 4. 의존성 설치 + 스키마 적용

```bash
npm install
npx prisma migrate deploy   # migrations/ 의 SQL 을 순서대로 적용
npx prisma generate         # TypeScript 클라이언트 생성
```

> `migrate deploy` 는 **이미 만들어진 마이그레이션을 적용만** 한다. (협업/배포용)
> 스키마를 **변경**할 때는 `npx prisma migrate dev --name 변경내용`.

### 5. 서버 실행

```bash
npm run dev
```

→ http://localhost:4000/health 에서 `{"status":"ok"}` 확인

---

## 📦 저장소에 포함되는 것 / 안 되는 것

| 대상 | git | 이유 |
|---|---|---|
| `server/docker-compose.yml` | ✅ | 환경 구성 (비밀값은 `${변수}` 참조만) |
| `server/.env.example` | ✅ | 양식 |
| `.tool-versions` | ✅ | Node 버전 고정 |
| `server/prisma/schema.prisma` | ✅ | DB 설계도 |
| `server/prisma/migrations/` | ✅ | **스키마 변경 이력. 반드시 커밋** |
| `package-lock.json` | ✅ | 의존성 버전 고정 |
| `CLAUDE.md`, `docs/` | ✅ | 인수인계 + 학습 노트 |
| `server/.env` | ❌ | **실제 비밀값. 절대 커밋 금지** |
| `node_modules/` | ❌ | `npm install` 로 재생성 |
| `server/src/generated/` | ❌ | `prisma generate` 로 재생성 |
| Docker 볼륨 데이터 | ❌ | 로컬 DB 내용. 환경마다 별개 |

> **원칙: 구조는 커밋하고, 값은 분리한다.**
>
> 데이터가 안 따라가는 건 의도된 설계다. 스키마는 마이그레이션으로 재현되고,
> 테스트 데이터는 seed 스크립트로 재현한다. **옮기는 게 아니라 코드로 재현한다.**

---

## 🛠 명령어

모두 `server/` 에서 실행한다.

### 애플리케이션
```bash
npm run dev         # 개발 서버 (저장 시 자동 재시작)
npm run typecheck   # 타입 검사만
npm run build       # dist/ 로 컴파일
npm start           # 컴파일 결과 실행
```

### 데이터베이스 (Docker)
```bash
docker compose up -d      # DB 켜기
docker compose ps         # 상태 확인
docker compose down       # 끄기 (데이터 유지)
docker compose down -v    # ⚠️ 완전 초기화 (데이터 삭제)
docker compose logs -f    # 로그 보기
```

### Prisma
```bash
npx prisma migrate dev --name 변경내용   # 스키마 변경 → SQL 생성 + 적용
npx prisma migrate deploy                # 기존 마이그레이션 적용만 (배포용)
npx prisma generate                      # 타입 재생성
npx prisma studio                        # 브라우저 DB 뷰어
npx prisma validate                      # 스키마 문법 검증
```

---

## 📚 문서

| 문서 | 내용 |
|---|---|
| [docs/README.md](./docs/README.md) | 학습 노트 목차 + 진행 현황 |
| [docs/00-architecture.md](./docs/00-architecture.md) | 데이터 흐름, 3계층 구조, DB 설계 |
| [docs/01-project-setup.md](./docs/01-project-setup.md) | TypeScript + Express 세팅 |
| [docs/02-database-setup.md](./docs/02-database-setup.md) | Docker MySQL, 보안, Prisma 7 |
| [docs/concepts/](./docs/concepts/) | 개념 심화 (ORM/마이그레이션 등) |
| [CLAUDE.md](./CLAUDE.md) | Claude Code 인수인계서 |

---

## ⚠️ 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 꺼짐 | 앱 실행 |
| `port 3306 is already allocated` | 3306 사용 중 | `docker-compose.yml` 을 `127.0.0.1:3307:3306` 으로 바꾸고 `.env` 의 `DATABASE_URL` 도 3307로 |
| `ECONNREFUSED` | DB 부팅 중 | `docker compose ps` 가 `(healthy)` 될 때까지 대기 |
| 비밀번호를 바꿨는데 접속 안 됨 | 볼륨이 남아 초기화를 건너뜀 | `docker compose down -v && docker compose up -d` (⚠️ 데이터 삭제) |
| `Prisma only supports Node.js 20.19+...` | Node 버전 낮음 | `asdf install nodejs 24.18.1` |
| `P1012 datasource url no longer supported` | Prisma 6 방식 사용 | 접속 URL 은 `prisma.config.ts` 에 (Prisma 7 변경사항) |
| 마이그레이션 후 타입이 없음 | Prisma 7 은 자동 생성 안 함 | `npx prisma generate` 실행 |
