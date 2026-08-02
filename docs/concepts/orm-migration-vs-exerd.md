# 개념 — ORM과 마이그레이션 (eXERD 경험자를 위한 설명)

> eXERD를 써봤다면 이미 절반은 알고 있는 상태다. 딱 하나만 바꿔 끼우면 된다.

---

## 1. ORM이 뭔가

DB와 대화하는 원래 방식:

```sql
SELECT * FROM meals WHERE user_id = 'abc' AND eaten_at > '2026-08-01';
```

**이건 그냥 문자열이다.** 그래서:
- `user_id`를 `userid`로 오타 내도 에디터가 아무 말 안 함
- 실행하는 순간에야 터짐
- 결과가 뭐가 돌아오는지 타입 정보가 없음

Prisma(ORM)를 쓰면:

```ts
const meals = await prisma.meal.findMany({
  where: { userId: 'abc', eatenAt: { gt: new Date('2026-08-01') } },
});
// meals 의 타입: Meal[]  ← 자동으로 붙는다
```

자동완성이 되고, 오타는 빨간 줄로 즉시 잡히고, 결과 타입까지 추론된다.

### Vue로 비유하면

백엔드 API를 그냥 `axios.get('/api/user')`로 호출하면 응답이 `any`다.
그런데 누군가 OpenAPI 스키마로 타입을 자동 생성해줘서
`const user = await api.getUser()` 하면 `User` 타입이 딱 붙는 경험 —

**Prisma는 DB에 대해 정확히 그 일을 해준다.**
- `schema.prisma` = 스키마 정의서
- `prisma generate` = 타입 생성기

---

## 2. 마이그레이션은 "로그"가 아니다

**결론부터**: 읽으라고 남기는 텍스트 기록이 아니라, **DB에 실제로 실행되는 SQL 파일**이다.
그리고 Prisma가 "어디까지 실행했는지"를 DB에 기록해 관리한다.

> 일기장이 아니라 **레시피 카드**에 가깝다.

---

## 3. eXERD 방식 vs 마이그레이션 방식

### 회사에서 eXERD로 일할 때의 흐름

```
1. eXERD에서 ERD 그림 수정 (meals 테이블에 memo 컬럼 추가)
2. 포워드 엔지니어링 → ALTER TABLE meals ADD COLUMN memo TEXT; 생성
3. 개발 DB에 실행
4. 운영 반영 시 → DBA에게 "이 SQL 좀 태워주세요" 요청
5. 그 SQL 파일은... 메일함? 사내 위키? 어딘가에 있음
```

**3~5번이 사람 손에 달려 있다.** 그래서 이런 사고가 난다:

- 개발 DB엔 컬럼을 넣었는데 **스테이징 DB에 넣는 걸 깜빡함**
- 새 팀원이 "DB 세팅 어떻게 해요?" → "제 .exerd 파일 드릴게요"
- 3개월 전 그 컬럼을 **누가 왜 추가했는지** 추적 불가
- 코드는 롤백했는데 DB는 롤백 안 됨 → 배포 터짐

### Prisma 마이그레이션의 흐름

```
1. schema.prisma 에서 memo 필드 한 줄 추가        ← eXERD 그림 수정에 해당
2. npx prisma migrate dev --name add_memo
       ↓ Prisma가 자동으로:
   ├─ 현재 DB 상태와 스키마를 비교
   ├─ 차이만큼의 ALTER TABLE SQL을 "파일로" 생성
   ├─ 그 SQL을 DB에 실행
   └─ TypeScript 타입 재생성
3. 그 SQL 파일을 코드와 함께 git commit          ← ⭐ 여기가 핵심
```

**3번이 결정적이다.** DB 변경 이력이 소스코드와 같은 저장소, 같은 커밋에 들어간다.

"memo 기능 추가" 커밋을 열면 그 안에 Vue 컴포넌트, Express 라우터,
**그리고 `ALTER TABLE` SQL이 같이 있다.** 이 커밋을 되돌리면 코드도 스키마도 함께 돌아간다.

---

## 4. 파일이 실제로 어떻게 생겼나

```
prisma/migrations/
├── 20260801103000_init/
│   └── migration.sql
└── 20260815142200_add_memo/
    └── migration.sql
```

`20260815142200_add_memo/migration.sql` 내용:

```sql
-- AlterTable
ALTER TABLE `meals` ADD COLUMN `memo` TEXT NULL;
```

**eXERD에서 뽑던 그 DDL과 똑같다.** 달라진 건 두 가지뿐:
1. 사람이 GUI로 뽑는 게 아니라 **Prisma가 자동 생성**
2. 메일이 아니라 **git에 남는다**

---

## 5. 🔑 "로그가 아니다"의 진짜 증거

Prisma는 DB 안에 `_prisma_migrations`라는 관리용 테이블을 만든다.

| migration_name | finished_at |
|---|---|
| `20260801103000_init` | 2026-08-01 10:30 |
| `20260815142200_add_memo` | 2026-08-15 14:22 |

**DB가 자기 자신이 어디까지 적용됐는지 기억한다.**

그래서 배포 서버에서 `prisma migrate deploy`를 실행하면 Prisma가 이 테이블을 읽고
**"아직 실행 안 된 것만, 순서대로"** 돌린다.

- 두 번 실행해도 중복 적용 안 됨
- 새 팀원이 빈 DB에서 실행하면 처음부터 전부 재생 → **내 DB와 완전히 동일한 상태**

단순 텍스트 로그로는 절대 안 되는 부분이다.
`git log`가 그냥 기록이 아니라 **실제로 코드를 그 시점으로 되돌릴 수 있는 것**과 같은 원리.

---

## 6. eXERD ↔ Prisma 대응표

| eXERD | Prisma | 비고 |
|---|---|---|
| `.exerd` 파일 (ERD 그림) | `schema.prisma` | **현재 설계도.** 둘 다 "지금 상태"를 선언 |
| GUI로 그리기 | 텍스트로 쓰기 | 그림 대신 코드 → **diff와 코드리뷰가 가능** |
| 포워드 엔지니어링 → DDL | `migrate dev`가 SQL 자동 생성 | 결과물은 똑같은 DDL |
| 뽑은 DDL을 수동 실행 | 자동 실행 + **파일로 보관** | ⭐ 결정적 차이 |
| (대응물 없음) | `_prisma_migrations` 테이블 | 어디까지 적용했는지 DB가 기억 |
| (대응물 없음) | **타입 자동 생성** | ERD가 곧 TypeScript 타입이 됨 |
| 리버스 엔지니어링 | `prisma db pull` | 기존 DB → 스키마 파일로 역추출 |

> **정리**: `schema.prisma`가 eXERD 그림이고,
> `migrations/` 폴더는 eXERD에 없던 **"변경 이력 + 자동 반영"** 기능이 얹힌 것이다.
> 완전히 새로운 개념을 배우는 게 아니라, 익숙한 것 위에 하나가 추가되는 것.

---

## 7. "그럼 ERD 그림은 못 보나?"

볼 수 있다. 두 가지 방법:

1. **`prisma-erd-generator`** — `schema.prisma`에서 ERD 다이어그램을 자동 생성
2. **DBeaver 등의 툴** — 실제 DB에 접속해서 ERD 보기

오히려 **그림이 코드에서 자동 생성되므로 항상 최신**이다.
eXERD 파일이 실제 DB와 어긋나는 문제가 구조적으로 발생하지 않는다.

---

## 8. 이 프로젝트에서의 실행 주체

조직 정책상 **스키마를 변경하는 명령은 Claude가 직접 실행하지 않는다.**

| 작업 | 담당 |
|---|---|
| `schema.prisma` 작성 (소스코드) | Claude |
| `docker-compose.yml` 작성 | Claude |
| 조회성 쿼리 (`SELECT`) | Claude 실행 가능 |
| **`npx prisma migrate dev`** (실제 테이블 생성) | **사용자가 직접 실행** |
| `INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` | **사용자가 직접 실행** |

어차피 이 명령을 직접 쳐보는 게 학습에도 낫다. 터미널 출력을 눈으로 봐야 감이 온다.
