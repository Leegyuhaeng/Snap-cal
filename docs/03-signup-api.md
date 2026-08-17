# Step 3 — 회원가입 API

> **목표**: 3계층 구조를 실제 파일로 구현하고, bcrypt 로 비밀번호를 안전하게 저장한다.
> 지금까지가 "판 깔기"였다면 여기서부터 실제 기능이다.

```
POST /api/auth/signup
{ email, password, nickname }
        ↓
201 { id, email, nickname, createdAt }   ← passwordHash 는 절대 안 나감
409 이메일 중복
400 형식 오류
```

---

## 1. 3계층 — 파일로 나누면 이렇게 된다

```
routes/auth.route.ts            주소 ↔ 담당자 연결          (로직 0줄)
controllers/auth.controller.ts  꺼내기 · 검증 · 호출 · 포장  (계산 없음)
services/auth.service.ts        모든 비즈니스 로직 · DB      (req/res 모름)
utils/AppError.ts               의도한 에러 표현
```

### Vue 대응

| 백엔드 | Vue |
|---|---|
| `auth.route.ts` | `router/index.ts` 의 `routes` 배열 |
| `auth.controller.ts` | `SignupForm.vue` 의 `handleSubmit()` |
| `auth.service.ts` | `useAuth()` composable |

```vue
<!-- Controller 가 하는 일이 정확히 이것 -->
<script setup>
const { signup } = useAuth()              // Service 가져오기
async function handleSubmit() {
  if (!isValidEmail(email.value)) return  // ② 검증
  const user = await signup({ ... })      // ③ 호출 (값만 넘김)
  router.push('/login')                   // ④ 결과 처리
}
</script>
```

### ⭐ 철칙: Service 는 `req`, `res` 를 모른다

```ts
// ❌ 나쁜 Service
async function signupUser(req, res) {
  const email = req.body.email;
  res.status(201).json(user);
}

// ✅ 좋은 Service
async function signup(input: SignupInput): Promise<PublicUser> {
  return user;   // 값을 받아 값을 반환
}
```

**왜 중요한가** — `req` 를 모르면 이런 곳에서 그대로 재사용된다.

- 테스트 코드 (HTTP 없이 함수만 호출)
- seed 스크립트 (테스트 유저 자동 생성)
- 관리자 기능 / CLI 도구

> **"HTTP 는 껍데기일 뿐, 로직은 껍데기를 몰라야 한다."**
> 잘 만든 composable 이 특정 컴포넌트에 의존하지 않는 것과 같은 이유.

### Controller 는 3줄이면 끝난다

```ts
export async function signup(req: Request, res: Response): Promise<void> {
  const input = validateSignupInput(req.body);   // ①② 꺼내기 + 검증
  const user = await authService.signup(input);  // ③ 값만 넘김
  res.status(201).json(user);                    // ④ 포장
}
```

로직이 전부 Service 에 있으므로 Controller 가 얇다. **이게 정상이다.**

### `try/catch` 가 없는 이유

**Express 5 는 async 핸들러의 에러를 자동으로 잡아** 에러 미들웨어로 넘긴다.
(Express 4 에서는 이게 안 돼서 서버가 조용히 멈췄다)

그래서 Controller 는 "정상 흐름"만 적고, 에러 응답은 `app.ts` 가 한 곳에서 책임진다.

---

## 2. bcrypt — 암호화가 아니라 해싱

### 차이

```
암호화(encryption)          해싱(hashing)
"1234" ─암호화→ "xY9#a"     "1234" ─해싱→ "$2b$10$abc..."
       ←복호화─                     ✗ 되돌릴 수 없음
```

| | 암호화 | 해싱 |
|---|---|---|
| 되돌리기 | 가능 (키가 있으면) | **불가능** |
| 털렸을 때 | 키까지 털리면 전부 노출 | 원본을 알 수 없음 |

### 핵심: 우리는 유저의 비밀번호를 알 필요가 없다

로그인 시 서버가 할 일은 **"입력한 게 가입할 때와 같은가"** 확인뿐이다.

```
가입:   "1234" → 해싱 → "$2b$10$abc..." 저장
로그인: "1234" → 해싱 → 비교 → 일치 ✅
```

> 정상적인 서비스는 당신의 비밀번호를 **모른다.** 그래서 잊으면 "알려드립니다"가
> 아니라 "재설정하세요"라고 한다.
> **비밀번호를 이메일로 그대로 보내주는 사이트는 평문 저장 중이므로 즉시 탈퇴할 것.**

### salt — 같은 비밀번호도 다른 해시로

**문제**: 단순 해싱은 같은 입력 → 같은 출력.
레인보우 테이블(흔한 비밀번호의 해시를 미리 계산한 표)로 한 번에 뚫린다.

**해결**: 해싱할 때 랜덤 문자열(salt)을 섞는다.

```
유저A "1234" + salt "xY9" → "aaa111"
유저B "1234" + salt "kL2" → "bbb222"   ← 완전히 다름
```

부수 효과로 **"이 500명은 같은 비밀번호를 쓰는군"** 같은 추론도 불가능해진다.

#### 🤔 salt 를 해시에 같이 저장하면 해커도 아는 것 아닌가?

**맞다. 그런데 문제가 안 된다.** salt 의 목적은 비밀 유지가 아니라 **비용 분산 차단**이다.

```
salt 없음: 표를 한 번 만들어 유저 10,000명을 "1명 값"에 뚫음
salt 있음: 유저 1명당 처음부터 다시 계산 → 10,000배의 비용
```

해커가 salt 를 알아도, 그 salt 로 계산한 결과는 **그 유저 한 명에게만** 쓸 수 있다.

> bcrypt 의 보안은 **비밀이 아니라 "느림"에서 온다.**
> 알고리즘·salt·해시가 전부 공개돼도 안전하다.
> (**케르크호프스의 원리** — 시스템의 안전성이 설계의 비밀에 의존해서는 안 된다)

#### 참고: pepper

`.env` 에 두는 **공통 비밀값**을 추가로 섞는 기법. DB 만 털렸을 때 검증조차 불가능하게 만든다.
단점: pepper 를 잃으면 모든 유저의 비밀번호 검증이 영구 불가능. 이 프로젝트에서는 쓰지 않는다.

### cost factor — 일부러 느리게

SHA-256 같은 건 초당 수십억 번 계산된다. bcrypt 는 **의도적으로 느리게** 설계됐고,
얼마나 느릴지 조절할 수 있다. **값이 1 오르면 시간이 2배.**

| cost | 소요 (실측) |
|---|---|
| **10** | **~70ms** ← 이 프로젝트 |
| 12 | ~300ms |
| 14 | ~1.2s |

| | 유저 | 해커 |
|---|---|---|
| 0.07초 | 로그인 시 한 번 → 체감 없음 | 1억 개 시도 = **약 80일** |

#### 🤔 왜 더 높이지 않나

**느려지는 비용을 해커가 아니라 우리 서버가 낸다.**

cost 14 로 동시 로그인 100명 → 160초 분량의 CPU 작업.
bcrypt 는 Node 스레드풀(기본 4개)에서 돌기 때문에 **대기열이 쌓여 다른 요청까지 느려진다.**
즉 **스스로 DoS 를 만드는 셈**이다.

> **기준: 운영 서버에서 로그인 응답이 100~250ms 를 넘지 않는 가장 높은 cost.**
> 일반 웹 앱은 10~12 가 표준.

#### 나중에 올리는 방법

해시 문자열에 cost 가 박혀 있으므로 점진적 마이그레이션이 가능하다.

```
① 설정을 cost 12 로 올림
② 유저 로그인 → 저장된 해시의 cost 가 10 인 걸 확인
③ 비밀번호가 맞으면 cost 12 로 다시 해싱해 덮어씀
④ 활성 유저가 자연스럽게 이전됨
```

비밀번호 재설정을 요구하지 않고 보안을 강화할 수 있다.

### 해시 구조

```
$2b$10$vUHnhDSagHdvd/4OlvCZL.4iyUJ8JxuvlaptFYJANj1wMPEyKdp5W
└┬┘└┬┘└────────── salt 22자 ──────────┘└──── 해시 31자 ────┘
 │   └ cost 10
 └ 알고리즘
```

**한 문자열에 알고리즘·cost·salt·해시가 모두 들어있다.**
그래서 검증 시 salt 를 따로 찾아올 필요가 없다.

---

## 3. 프론트 검증을 믿으면 안 되는 이유

Vue 의 `type="email"`, `minlength="8"`, 직접 짠 검증 함수 — **전부 `curl` 한 줄로 우회된다.**

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"ㅋ","password":"1","nickname":""}'
```

**브라우저를 안 거치면 Vue 코드는 실행조차 되지 않는다.**

| | 목적 | 없으면 |
|---|---|---|
| 프론트 검증 | **UX** — 즉시 피드백 | 불편하지만 안전 |
| 백엔드 검증 | **보안** — 데이터 정합성 | **DB 가 오염됨** |

> 백엔드를 배우며 겪는 가장 큰 관점 전환:
> 프론트는 **"유저가 실수하지 않게 돕는다"**,
> 백엔드는 **"유저가 악의적으로 행동한다고 가정한다"**.

### 검증에서 신경 쓴 것

```ts
// body 자체가 객체가 아닐 수 있다 (문자열, 배열, null ...)
if (typeof body !== 'object' || body === null) { ... }

// 타입까지 확인한다. password 로 숫자나 객체가 올 수도 있다
if (typeof password !== 'string' || password.length < 8) { ... }

// DB 컬럼이 VARCHAR(30) 이므로 넘치기 전에 막아 친절한 메시지를 준다
if (nickname.trim().length > 30) { ... }
```

---

## 4. 상태 코드 설계

| 상황 | 코드 | 이유 |
|---|---|---|
| 가입 성공 | **201 Created** | 새 리소스가 생겼다 (200 이 아니다) |
| 형식 오류 | 400 Bad Request | 요청이 잘못됐다 |
| 이메일 중복 | 409 Conflict | 현재 상태와 충돌한다 |
| 로그인 성공 (Step 4) | 200 OK | 생성된 리소스가 없다 |

### 왜 굳이 201 인가

**상태 코드는 API 의 문서다.** 프론트가 본문을 파싱하지 않고도 판단할 수 있다.

```ts
if (res.status === 201) { /* 가입 완료 화면 */ }
else if (res.status === 409) { /* 이미 있는 이메일 */ }
```

200 으로 해도 동작은 한다. 하지만 **관례를 따르는 비용이 0**이고,
안 따르면 "이 API 는 왜 규칙이 다르지?" 하는 혼란이 생긴다.

> 관례를 지키는 이유는 "규칙이라서"가 아니라
> **"다음 사람(3개월 뒤의 나 포함)이 추측하지 않게 하려고"** 다.

### 🤔 이메일 중복을 알려주는 게 보안상 괜찮은가 — 실제 논쟁거리

**user enumeration(사용자 열거)** 취약점이다.

```
해커가 이메일 10만 개를 준비 → signup 시도
  409 → "이 사람은 회원이다"
  201 → "회원 아니다"
```

무엇이 위험한가:
1. **크리덴셜 스터핑 표적화** — 유출된 비밀번호를 회원에게만 시도 → 효율 급상승
2. **프라이버시 유출** — "이 사람이 이 서비스를 쓰는가"가 밝혀진다

2번은 서비스 성격에 따라 심각하다. 데이팅·정신과·중독치료·정치 커뮤니티라면
**"회원인 사실 자체"가 민감 정보**다.

| | 방법 | UX | 보안 |
|---|---|---|---|
| 1 | 그냥 알려준다 (`409`) | ⭐⭐⭐ | ⭐ |
| 2 | + Rate limiting | ⭐⭐⭐ | ⭐⭐ |
| 3 | + CAPTCHA | ⭐⭐ | ⭐⭐⭐ |
| 4 | 이메일 인증 방식 | ⭐ | ⭐⭐⭐⭐ |

**4번**은 회원가입 요청에 항상 "메일을 확인하세요"만 응답하고,
신규면 "가입 완료 링크", 기존이면 "이미 계정이 있어요" 메일을 보낸다.
응답만으로는 구분 불가. 대신 오타를 즉시 알 수 없어 UX 손실이 크다.

**대부분의 서비스(GitHub, Google 포함)는 1 + 2 를 쓴다.**

**이 프로젝트의 선택**: `409` 로 명확히 알려주고, Step 10 에서 rate limiting 추가.
(식단 기록 앱이라 민감도가 낮고, 학습 목적상 상태 코드 설계를 명확히 하는 게 우선)

### 🚨 단, 로그인에서는 절대 구분하지 않는다

이건 논쟁거리가 아니라 **모두가 동의하는 규칙**이다.

```ts
// ❌ 절대 금지
if (!user) throw new AppError('존재하지 않는 이메일입니다', 404);
if (!match) throw new AppError('비밀번호가 틀렸습니다', 401);

// ✅ 항상 동일하게
throw new AppError('이메일 또는 비밀번호가 올바르지 않습니다.', 401);
```

**회원가입은 알려주지 않으면 유저가 가입을 못 하지만, 로그인은 알려줄 이유가 없다.**
유저에게 도움도 안 되고 해커에게만 도움이 된다.

> 함정 하나 더: **응답 시간으로도 정보가 샌다.**
> 유저가 없으면 bcrypt 를 안 돌려 빨리 응답 → "빠른 실패 = 없는 계정".
> Step 4 에서 다룬다.

---

## 5. AppError — 에러를 두 종류로 나눈다

| | 예 | 유저에게 |
|---|---|---|
| **의도한 에러** | "이메일 중복" | 그대로 보여줘야 함 |
| **예상 못 한 에러** | `TypeError`, DB 끊김 | **절대 보여주면 안 됨** |

두 번째를 그대로 내보내면:

```
Cannot read property 'email' of undefined
  at signup (/app/src/services/auth.service.ts:42:15)
```

**서버 파일 경로와 코드 구조가 통째로 노출된다.** 공격자에게 지도를 그려주는 셈.

```ts
export class AppError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) { ... }
}
```

`AppError` 로 감싼 것만 메시지를 노출하고, 나머지는 "서버 오류가 발생했습니다"로 뭉뚱그린다.

---

## 6. 동시성 — "검사했으니 괜찮겠지"가 안 통한다

```
요청 A: 중복 확인 → 없음 ✅
요청 B: 중복 확인 → 없음 ✅    ← A 가 아직 저장 전!
요청 A: 저장 → 성공
요청 B: 저장 → 💥 UNIQUE 제약 위반
```

**중복 확인과 저장 사이에 틈이 있다.** 게다가 그 사이 bcrypt 가 70ms 를 잡아먹어
틈이 생각보다 넓다.

**최종 방어선은 DB 의 UNIQUE 제약**이다. 위반 시 Prisma 가 `P2002` 를 던진다.

```ts
try {
  return await prisma.user.create({ ... });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('이미 사용 중인 이메일입니다.', 409);  // 유저에겐 같은 결과
  }
  throw error;
}
```

> 서버는 요청이 동시에 들어온다. 이 사고방식이 Step 8 트랜잭션에서 본격적으로 필요해진다.

---

## 7. 안전장치 두 가지

### `select` 로 화이트리스트

```ts
select: { id: true, email: true, nickname: true, createdAt: true }
```

**`passwordHash` 가 애초에 조회되지 않는다.**
나중에 민감한 컬럼이 추가돼도 여기 안 적으면 안 나간다.
**"빼는" 방식보다 "고르는" 방식이 안전하다.**

### 이메일 소문자 정규화

```ts
const email = input.email.trim().toLowerCase();
```

`Test@a.com` 으로 가입하고 `test@a.com` 으로 로그인하면 당연히 돼야 한다.
안 하면 같은 사람이 두 계정을 만들 수 있다.

---

## 8. 에러 처리 미들웨어

```ts
app.use('/api/auth', authRouter);          // 라우터
app.use((_req, res) => { ...404... });     // 404
app.use((err, _req, res, _next) => { ... }); // ⚠️ 인자 4개, 맨 마지막
```

### ⚠️ 인자가 4개여야 한다

**Express 는 인자 개수로 에러 핸들러를 식별한다.**
`err` 를 빼고 3개로 쓰면 일반 미들웨어가 되어 **절대 호출되지 않는다.**
그리고 반드시 맨 마지막이어야 한다.

---

## 9. 🐛 테스트로 실제 버그를 잡았다

`body` 에 JSON 문자열(`"hello"`)을 보냈더니:

```
기대: 400   실제: 500 ❌
```

서버 로그를 보니:

```
[Unhandled Error] SyntaxError: Unexpected token '"', ""hello"" is not valid JSON
    at createStrictSyntaxError (body-parser/lib/types/json.js:137:10)
    ...
  expose: true,
  statusCode: 400,
```

**원인**: `express.json()` 이 우리 Controller 보다 **먼저** 실행되며 던진 에러였다.
`statusCode: 400`, `expose: true` 를 달고 왔는데 우리 핸들러가
"AppError 가 아니네 → 500" 으로 처리해버렸다.

**해결**: http-errors 규약을 따르는 에러를 인식한다.

```ts
export function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  const e = error as Record<string, unknown>;
  return typeof e?.statusCode === 'number'
    && e.statusCode >= 400 && e.statusCode < 500
    && e.expose === true;
}
```

`expose: true` 는 **"클라이언트 잘못이므로 알려줘도 안전하다"** 는 뜻이다.

### 왜 중요한가

**`5xx` 는 "우리 잘못", `4xx` 는 "요청 잘못"이다.** 이 구분이 흐려지면:

- 프론트가 "서버 장애인가?" 하고 재시도 로직을 돌린다
- 모니터링에 서버 장애로 집계돼 **진짜 장애를 놓친다**

> **정상 케이스만 확인했으면 못 찾았을 버그다.**
> 실패 케이스를 일부러 만들어보는 습관이 중요한 이유.

---

## 10. 검증 결과

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| ① | 정상 가입 | 201 | ✅ |
| ② | 이메일 중복 | 409 | ✅ |
| ③ | **대문자 이메일** `TEST@SnapCal.com` | 409 | ✅ 정규화 동작 |
| ④ | 이메일 형식 오류 | 400 | ✅ |
| ⑤ | 비밀번호 7자 | 400 | ✅ |
| ⑥ | 닉네임 공백 | 400 | ✅ |
| ⑦ | 닉네임 31자 | 400 | ✅ |
| ⑧ | body 가 문자열 | 400 | ✅ (버그 수정 후) |
| ⑨ | 깨진 JSON | 400 | ✅ |
| ⑩ | `Second@SnapCal.com` | 201 → `second@snapcal.com` | ✅ |
| ⑪ | 중복 회귀 | 409 | ✅ |

### 실제 저장된 데이터

```
test@snapcal.com    $2b$10$vUHnhDSagHdvd/4OlvCZL.4iyUJ8JxuvlaptFYJANj1wMPEyKdp5W
second@snapcal.com  $2b$10$cR0sdCyB08ifjb7ntYFpdusgtCHUrSomzbiUeUKau3Brbtc2do29i
```

**둘 다 `password123` 으로 가입했는데 해시가 완전히 다르다.** salt 덕분이다.

---

## 11. 💡 mysql CLI 의 한글 깨짐 (표시 문제)

```bash
docker exec snapcal-mysql mysql ... -e "SELECT nickname FROM users;"
# nickname: ???
```

**저장은 멀쩡하다.** CLI 클라이언트가 기본 문자셋을 latin1 로 잡아서 표시만 깨진다.

```bash
docker exec snapcal-mysql mysql --default-character-set=utf8mb4 ...
# nickname: 테스터   HEX: ED858CEC8AA4ED84B0  ← 정상 UTF-8
```

**서버 문자셋과 클라이언트 문자셋은 별개**라는 사례.
Prisma Studio 나 DBeaver 로 보면 정상으로 나온다.

---

## 12. 다음 단계에서 이어질 것

- **Step 4**: 로그인 API — 여기서 만든 `passwordHash` 를 `bcrypt.compare` 로 검증하고 JWT 발급
- **Step 5**: 인증 미들웨어 — 토큰을 검증해 `req.user` 주입
- **Step 10**: 에러 핸들러 고도화(로깅·에러 코드), rate limiting

### 남은 개선 여지

| 항목 | 지금 | 나중에 |
|---|---|---|
| 입력 검증 | 손으로 작성한 함수 | **zod** 같은 스키마 검증 라이브러리 |
| 에러 핸들러 | 최소 버전 | 로깅 + 에러 코드 체계 (Step 10) |
| rate limiting | 없음 | `express-rate-limit` (Step 10) |
| 테스트 | curl 수동 | supertest 자동화 |
