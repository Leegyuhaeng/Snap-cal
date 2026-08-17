# 📚 학습 노트 — AI 칼로리 분석 앱 백엔드

Vue 프론트엔드 개발자가 백엔드를 처음 배우면서 남기는 기록.
**"왜 그렇게 했는지"** 를 나중에 다시 이해할 수 있게 정리한다.

---

## 목차

### 단계별 노트
| Step | 문서 | 핵심 주제 | 상태 |
|---|---|---|---|
| 0 | [00-architecture.md](./00-architecture.md) | 전체 데이터 흐름, 3계층 구조, DB 설계 | ✅ |
| 1 | [01-project-setup.md](./01-project-setup.md) | TypeScript + Express 세팅, 미들웨어, 환경변수 | ✅ |
| 2 | [02-database-setup.md](./02-database-setup.md) | Docker MySQL, 볼륨/포트 보안, Prisma 7, 커넥션 풀, 모노레포 | ✅ |
| 3 | [03-signup-api.md](./03-signup-api.md) | 회원가입 API, 3계층 실전, bcrypt, 상태 코드, 동시성 | ✅ |
| 4 | (예정) | 로그인 API, JWT 발급 | ⬜ |
| 5 | (예정) | 인증 미들웨어 | ⬜ |
| 6 | (예정) | BMR/TDEE 계산 | ⬜ |
| 7 | (예정) | 이미지 업로드 (multer + 클라우드 스토리지) | ⬜ |
| 8 | (예정) | AI 비전 API 연동, 트랜잭션 ⭐ | ⬜ |
| 9 | (예정) | 캘린더 조회 API | ⬜ |
| 10 | (예정) | 에러 핸들링, Railway 배포 | ⬜ |

### 개념 심화
| 문서 | 내용 |
|---|---|
| [concepts/orm-migration-vs-exerd.md](./concepts/orm-migration-vs-exerd.md) | ORM이 뭔지, 마이그레이션이 eXERD와 어떻게 다른지 |

---

## 🔁 프론트엔드 ↔ 백엔드 대응표 (누적)

새로운 개념을 배울 때마다 여기에 추가한다. **막힐 때 여기부터 보자.**

| 백엔드 | Vue에서 대응되는 것 |
|---|---|
| 백엔드 서버 자체 | 새로고침해도 안 날아가고, 프론트에서 열어볼 수 없는 Pinia Store |
| Router | `vue-router`의 `routes` 배열 |
| Controller | 컴포넌트 `<script setup>`의 이벤트 핸들러 |
| Service | `composable` / Pinia의 actions (**모든 로직이 여기**) |
| Prisma Client | 타입이 자동 생성되는 axios |
| 미들웨어 (`app.use`) | 전역 라우터 가드 + 플러그인 등록 (`app.use(router)`) |
| `app.ts` | `App.vue` + `main.ts`의 플러그인 등록부 |
| `server.ts` | `main.ts`의 `.mount('#app')` |
| `tsx watch` | `vite dev` (HMR) |
| morgan 로그 | 브라우저 개발자도구의 Network 탭 |
| JWT | 놀이공원 손목 밴드 (위조 방지 홀로그램 포함) |
| `schema.prisma` | eXERD의 ERD 그림 |
| 마이그레이션 파일 | DB를 위한 git commit |
| Docker 이미지 | npm 레지스트리의 패키지 (`mysql@8.0`) |
| Docker 컨테이너 | `node_modules` — 지우고 다시 만들면 되는 것 |
| Docker 볼륨 | 외장하드 — 컨테이너를 바꿔도 데이터는 남음 |
| `docker-compose.yml` | `package.json` — 뭘 설치할지 적어둔 파일 |
| `.tool-versions` | `.nvmrc` |
| PrismaClient 싱글턴 | `api.ts`에서 한 번 만든 `axios.create()` 인스턴스 |
| 커넥션 풀 | 미리 열어둔 DB 연결 묶음 (재사용해서 빠름) |
| `503 Service Unavailable` | "서버는 떴는데 DB가 죽어서 일을 못 함" |
| Controller | 컴포넌트의 `handleSubmit()` |
| Service | `useAuth()` composable |
| `AppError` | 의도한 에러 vs 예상 못 한 에러를 나누는 장치 |
| 에러 미들웨어 (인자 4개) | 전역 에러 바운더리 |
| `201 Created` | "새 리소스가 생겼다" (200과 다름) |
| `409 Conflict` | "현재 상태와 충돌" (이메일 중복) |

---

## ⚠️ 절대 잊지 말 것 (보안 철칙)

1. **AI API 키를 프론트에 두지 않는다.** Vite는 `.env` 값을 번들에 그대로 박는다.
   네트워크 탭 한 번이면 키가 털리고 청구서가 폭탄이 된다.
2. **`userId`는 JWT에서만 꺼낸다.** `?userId=3` 을 믿으면 숫자만 바꿔서 남의 식단을 다 본다.
3. **`.env`는 절대 커밋하지 않는다.** GitHub에 올라간 키는 봇이 몇 분 안에 긁어간다.
4. **비밀번호는 평문 저장 금지.** bcrypt 해시만 저장한다.
5. **프론트 검증은 UX용, 백엔드 검증이 유일한 방어선이다.** `curl` 한 줄이면 프론트는 통째로 우회된다.
6. **로그인 실패 사유를 구분해서 알려주지 않는다.** "이메일 또는 비밀번호가 올바르지 않습니다" 하나로 통일.
7. **응답 필드는 `select`로 고른다.** 빼는 방식이 아니라 고르는 방식이어야 실수로 새지 않는다.
