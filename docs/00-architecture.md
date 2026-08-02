# Step 0 — 아키텍처 설계

> **이 단계의 목표**: 코드를 한 줄도 쓰기 전에, 데이터가 어디서 어디로 흐르는지와
> DB 테이블 구조를 확정한다. 설계 없이 시작하면 나중에 전부 뒤엎게 된다.

---

## 1. 왜 백엔드가 필요한가

Vue에서는 이 구조에 익숙하다.

```
컴포넌트(화면) → Pinia Store(상태) → axios(외부와 통신)
```

문제는 **Pinia Store는 새로고침하면 날아가고, 개발자도구를 열면 누구나 다 본다**는 것.

우리 앱에는 두 종류의 데이터가 있다.

| 종류 | 예시 | 필요한 것 |
|---|---|---|
| 날아가면 안 되는 것 | 유저의 3개월 치 식단 기록 | 영구 저장소 (DB) |
| 남에게 보이면 안 되는 것 | AI API 키, DB 비밀번호 | 프론트에서 못 여는 공간 (서버) |

> **한 줄 정의**: 백엔드는 **"절대 초기화되지 않고, 프론트에서 절대 열어볼 수 없는 Pinia Store"** 다.

### ⚠️ 이 프로젝트에서 백엔드가 반드시 필요한 결정적 이유

**AI 비전 API를 프론트에서 직접 호출하면 안 된다.**

Vite의 `.env`에 넣어도 빌드 시 번들에 그대로 박힌다. 브라우저 네트워크 탭이나
소스맵 한 번이면 키가 노출되고, 남이 내 키로 API를 호출해 요금이 청구된다.

**AI 호출은 무조건 서버에서.** 프론트는 "이 사진 분석해줘"라고 우리 서버에 요청할 뿐,
AI 업체와 직접 대화하지 않는다.

---

## 2. 데이터 흐름도

### 흐름 A. 로그인 (JWT)

```
[Vue]                    [Express]                      [MySQL]
  │                          │                             │
  │  POST /auth/login        │                             │
  │  {email, password}       │                             │
  ├─────────────────────────>│                             │
  │                          │  email로 유저 조회           │
  │                          ├────────────────────────────>│
  │                          │<────────────────────────────┤
  │                          │  bcrypt.compare(입력, 해시)  │
  │                          │  ✅ 일치 → JWT 발급          │
  │<─────────────────────────┤                             │
  │  { accessToken }         │                             │
  │                          │                             │
  │  이후 모든 요청에         │                             │
  │  Authorization: Bearer xxx                             │
  ├─────────────────────────>│ (미들웨어가 토큰 검증)        │
```

#### JWT = 놀이공원 손목 밴드

- 매표소(로그인)에서 **한 번만** 신분 확인 → 밴드를 채워줌
- 이후 놀이기구(API)를 탈 때는 밴드만 보여주면 됨. 신분증 재확인 불필요
- 밴드에는 **위조 방지 홀로그램(서명)** 이 있어서, "일반권"을 "VIP권"으로 고치면 즉시 들통남
- 그래서 서버는 발급한 밴드 목록을 DB에 저장할 필요조차 없다 → **무상태(stateless)**
  → 나중에 서버를 여러 대로 늘려도 아무 문제가 없다 (확장성의 핵심)

Vue 쪽에서는 `axios.interceptors.request`로 토큰을 자동 첨부하게 된다. 익숙한 작업.

---

### 흐름 B. 사진 업로드 → AI 분석 ⭐ (이 프로젝트의 심장)

```
[Vue]              [Express]           [Cloudinary]      [AI Vision]      [MySQL]
  │                    │                    │                 │              │
  │ ① FormData(이미지) │                    │                 │              │
  ├───────────────────>│                    │                 │              │
  │                    │ ② 메모리에 임시 보관 │                 │              │
  │                    │   (multer)         │                 │              │
  │                    │ ③ 이미지 업로드     │                 │              │
  │                    ├───────────────────>│                 │              │
  │                    │<───────────────────┤                 │              │
  │                    │   https://.../a.jpg│                 │              │
  │                    │ ④ "이 URL 분석해줘" + 프롬프트         │              │
  │                    ├─────────────────────────────────────>│              │
  │                    │<─────────────────────────────────────┤              │
  │                    │   JSON: [{김치찌개, 250kcal, ...}]    │              │
  │                    │ ⑤ Meal + MealItem 저장 (트랜잭션)     │              │
  │                    ├────────────────────────────────────────────────────>│
  │<───────────────────┤                    │                 │              │
  │ ⑥ 분석 결과 JSON    │                    │                 │              │
```

#### 왜 이미지를 DB에 넣지 않는가

Vue에서 이미지를 `base64`로 바꿔 Pinia state에 넣으면 상태가 몇 MB로 부풀고 devtools가 버벅인다.
DB도 똑같다.

MySQL에 이미지 바이너리를 넣으면 **"김치찌개 250kcal"이라는 20바이트 정보를 읽으려고
매번 3MB짜리 행을 디스크에서 통째로 끌어올려야 한다.** 캘린더에서 한 달 치 30장을
조회하면 90MB를 읽는 셈.

→ **이미지는 Cloudinary(창고)에, DB에는 200바이트짜리 URL(택배 송장번호)만 저장.**

#### 왜 AI 응답을 쪼개서 저장하는가

AI는 사진 한 장에서 여러 음식을 찾는다. "제육볶음 + 밥 + 김치".
이걸 `foods` 컬럼에 JSON 문자열로 통째로 넣으면 당장은 편하지만,
**"이번 달에 제일 많이 먹은 음식 TOP 5"** 같은 기능에서 막힌다. 문자열을 뒤져야 하니까.

→ **식사(Meal) 1개 : 음식항목(MealItem) N개** 로 분리. 이것이 확장 가능한 구조의 핵심.

#### 지금은 동기, 나중에는 비동기

현재는 ①~⑥을 **한 요청 안에서 동기 처리**한다. AI 응답까지 5~10초 걸리므로
Vue는 로딩 스피너를 돌린다. 학습 단계에서는 이게 맞다.

트래픽이 늘면:
- **업로드**: 서버 경유 대신 **Presigned URL**로 프론트가 스토리지에 직접 업로드 (서버 부하 0)
- **분석**: 즉시 `202 Accepted` 응답 → **큐(BullMQ 등)** 에 작업 투입 → 완료 시 폴링/웹소켓 알림

👉 그래서 `Meal.status` 컬럼을 **미리** 넣어뒀다. 지금은 항상 `COMPLETED`지만,
나중에 비동기로 바꿀 때 **스키마를 안 고쳐도 된다.** 이런 게 "확장을 고려한 설계".

---

### 흐름 C. 캘린더 조회

```
[Vue] GET /meals?from=2026-08-01&to=2026-08-31
                    ↓
[Express] JWT에서 userId 추출 → "내 것만" 조회  ⭐ 보안 핵심
                    ↓
[MySQL] WHERE userId = ? AND eatenAt BETWEEN ? AND ?
                    ↓
[Express] 날짜별 그룹핑 + 기초대사량 대비 섭취율 계산
                    ↓
[Vue] 캘린더 렌더링
```

> ⚠️ **초보자가 100% 하는 실수**: 프론트가 보낸 `userId`를 그대로 믿는 것.
> `GET /meals?userId=3` 이면 유저가 숫자만 바꿔서 남의 식단을 전부 볼 수 있다.
> **`userId`는 반드시 JWT 토큰에서만 꺼낸다. 예외 없음.**

---

## 3. 3계층 아키텍처

이미 Vue에서 쓰고 있는 구조다. 이름만 다르다.

| 백엔드 계층 | Vue 대응 | 하는 일 | 하면 안 되는 일 |
|---|---|---|---|
| **Router** | `vue-router`의 `routes` | 주소와 담당자 연결 | 로직 작성 |
| **Controller** | 컴포넌트의 이벤트 핸들러 | 요청 꺼내기, 검증, 응답 포장 | 계산, DB 접근 |
| **Service** | `composable` / Pinia actions | **모든 비즈니스 로직** | `req`, `res` 만지기 |
| **Prisma** | `axios` 인스턴스 | 데이터 가져오기 | — |

### 철칙 하나만 기억하면 된다

> **Service는 `req`와 `res`를 절대 몰라야 한다.**

`calculateBMR()`이 `req.body`에 의존하면, 이 함수를 배치 작업이나 테스트에서 재사용할 수 없다.
잘 만든 composable이 특정 컴포넌트에 의존하지 않는 것과 같은 이유.

**"HTTP는 껍데기일 뿐, 로직은 껍데기를 몰라야 한다."**

---

## 4. 데이터베이스 설계

### 테이블 관계

```
User (1) ──< (N) BodyRecord     체중/기초대사량 변화 이력
  │
  └──< (N) Meal (1) ──< (N) MealItem
              │              └─ 음식 하나하나 (칼로리, 탄단지)
              └─ 사진 1장 = 식사 1건
              └──< (N) AiAnalysisLog
```

### 설계 의도

#### ① 왜 키/몸무게를 User에 안 넣고 `BodyRecord`로 뺐나

다이어트 앱인데 체중이 안 변할 리 없다. `User.weight`를 UPDATE로 덮어쓰면
**"3개월 전 나는 몇 kg이었지?"** 를 영원히 알 수 없다. 체중 변화 그래프는
이런 앱의 핵심 기능이 될 텐데.

→ **"덮어쓰기" 대신 "쌓기"**. 현재 체중은 `recordedAt` 기준 최신 1건.
BMR도 그때그때 재계산하지 않고 **그 시점 값을 스냅샷으로 저장** — 나중에 계산 공식을
바꿔도 과거 기록이 왜곡되지 않는다.

#### ② 왜 `Meal.totalCalories`를 중복 저장하나

원칙대로면 `MealItem`을 SUM 하면 되니 "중복"이다. 하지만 캘린더는
**한 달 30일 × 3끼 = 90건**의 합계를 매번 계산해야 한다. 미리 계산해두면 조회가 빠르다.

Vue로 치면 `computed`를 매번 돌리는 대신 캐시를 두는 것. 이를 **비정규화(denormalization)** 라
하고 실무에서 흔한 성능 트레이드오프다.
**대가**: MealItem이 바뀌면 이 값도 반드시 함께 갱신해야 한다 → 트랜잭션으로 묶는다.

#### ③ 왜 `AiAnalysisLog`를 따로 두나

AI가 이상한 답을 줬을 때 원본을 볼 수 없으면 디버깅이 불가능하다.
원본 응답을 보관하면 프롬프트 개선, 다른 모델과의 정확도 비교에 귀중한 데이터가 된다.

---

### Prisma 스키마 (확정본)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─────────────── 유저 ───────────────
model User {
  id            String        @id @default(uuid())
  email         String        @unique
  passwordHash  String        // ⚠️ 평문 비밀번호는 절대 저장 안 함
  nickname      String        @db.VarChar(30)
  gender        Gender?
  birthDate     DateTime?     @db.Date
  activityLevel ActivityLevel @default(SEDENTARY)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  bodyRecords   BodyRecord[]
  meals         Meal[]

  @@map("users")
}

// ─────────── 신체 기록 (이력형) ───────────
model BodyRecord {
  id         String   @id @default(uuid())
  userId     String
  heightCm   Decimal  @db.Decimal(5, 2)   // 175.50
  weightKg   Decimal  @db.Decimal(5, 2)   // 68.30
  bmr        Int                          // 기초대사량 (계산 결과 스냅샷)
  tdee       Int                          // 활동대사량 = bmr × 활동계수
  recordedAt DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt])           // "내 최신 기록" 조회 최적화
  @@map("body_records")
}

// ─────────── 식사 1건 (사진 1장) ───────────
model Meal {
  id            String         @id @default(uuid())
  userId        String
  mealType      MealType
  eatenAt       DateTime                          // 실제 먹은 시각
  imageUrl      String?        @db.VarChar(500)
  imageKey      String?        @db.VarChar(255)   // 스토리지 삭제용 식별자
  memo          String?        @db.Text
  totalCalories Int            @default(0)        // 비정규화 캐시
  status        AnalysisStatus @default(PENDING)  // 비동기 확장 대비
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  items         MealItem[]
  analysisLogs  AiAnalysisLog[]

  @@index([userId, eatenAt])   // ⭐ 캘린더 조회의 핵심 인덱스
  @@map("meals")
}

// ─────────── 음식 항목 (탄단지) ───────────
model MealItem {
  id         String   @id @default(uuid())
  mealId     String
  name       String   @db.VarChar(100)     // "김치찌개"
  quantity   String?  @db.VarChar(50)      // "1인분", "150g"
  calories   Int
  carbsG     Decimal  @db.Decimal(6, 2)    // 탄수화물
  proteinG   Decimal  @db.Decimal(6, 2)    // 단백질
  fatG       Decimal  @db.Decimal(6, 2)    // 지방
  confidence Decimal? @db.Decimal(4, 3)    // AI 확신도 0.000~1.000
  isEdited   Boolean  @default(false)      // 유저가 수정했는지

  meal       Meal     @relation(fields: [mealId], references: [id], onDelete: Cascade)

  @@index([mealId])
  @@map("meal_items")
}

// ─────────── AI 원본 응답 로그 ───────────
model AiAnalysisLog {
  id          String   @id @default(uuid())
  mealId      String
  provider    String   @db.VarChar(50)
  model       String   @db.VarChar(100)
  rawResponse Json                          // AI가 뱉은 원본 그대로
  latencyMs   Int
  createdAt   DateTime @default(now())

  meal        Meal     @relation(fields: [mealId], references: [id], onDelete: Cascade)

  @@index([mealId])
  @@map("ai_analysis_logs")
}

enum Gender {
  MALE
  FEMALE
}

enum ActivityLevel {
  SEDENTARY      // 거의 안 움직임 ×1.2
  LIGHT          // 주 1~3회  ×1.375
  MODERATE       // 주 3~5회  ×1.55
  ACTIVE         // 주 6~7회  ×1.725
  VERY_ACTIVE    // 육체노동   ×1.9
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
  SNACK
}

enum AnalysisStatus {
  PENDING
  COMPLETED
  FAILED
}
```

---

### 세부 선택의 이유 (실무에서 자주 데이는 것들)

| 선택 | 이유 |
|---|---|
| `Decimal` (Float 아님) | Float은 `0.1 + 0.2 = 0.30000000000000004`. 영양성분처럼 정확해야 하는 값에 부적합. 단, Prisma가 Decimal 객체를 반환하므로 응답 직전 `Number()` 변환 필요 |
| `id`를 `uuid` | `1, 2, 3` 자동증가는 URL만 봐도 "유저 47명이구나"가 드러나고 타인 id 추측이 쉬움 |
| `onDelete: Cascade` | 유저 탈퇴 시 관련 데이터 자동 삭제. **단 Cloudinary의 실제 이미지 파일은 안 지워지므로** 서비스 로직에서 별도 처리 (`imageKey`를 저장한 이유) |
| `eatenAt` / `createdAt` 분리 | 어젯밤 야식을 오늘 아침에 기록하는 경우. 캘린더는 `eatenAt` 기준으로 그린다 |
| `@@map`으로 snake_case | MySQL 세계의 관례. 코드에서는 camelCase, 실제 테이블만 snake_case |
| `@@index([userId, eatenAt])` | 캘린더 조회 쿼리의 WHERE 조건과 정확히 일치. 인덱스가 없으면 전체 스캔 |
