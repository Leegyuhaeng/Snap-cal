# Step 2 — Docker MySQL + Prisma 연결

> **목표**: 개발용 MySQL을 Docker로 띄우고, Prisma를 연결해 설계도(`schema.prisma`)로부터
> 실제 테이블을 생성한다.

---

## 1부. Docker로 MySQL 띄우기

### 왜 Docker인가

선택지는 4개였다. Docker 로컬 / Homebrew 설치 / Railway 클라우드 / 병행.
**Docker 로컬**을 고른 이유는 하나다.

> **지금은 스키마를 부수면서 배우는 단계다.**

설계가 마음에 안 들면 갈아엎고, 마이그레이션이 꼬이면 처음부터 다시 해야 한다.
`docker compose down -v` → `up -d` 로 **30초 만에 새 DB**가 되는 환경이 학습 속도를 좌우한다.

그리고 이 선택은 **되돌리기 비용이 거의 0이다.** Prisma를 쓰기 때문에 나중에 Railway로
옮길 때 바꾸는 건 `DATABASE_URL` 한 줄뿐, 애플리케이션 코드는 한 글자도 안 바뀐다.

### Docker 개념 3개

| 개념 | 역할 | 비유 |
|---|---|---|
| **이미지** | 읽기 전용 설치 원본 | 프로그램 설치 파일 (`.dmg`) |
| **컨테이너** | 이미지를 실행한 상태 | 실행 중인 앱 |
| **볼륨** | 컨테이너 **밖**의 영속 저장소 | **외장하드** |

**볼륨이 핵심이다.** 컨테이너는 지우면 안의 데이터가 사라진다. 컨테이너가 "종이컵"이면
볼륨은 그 옆의 "물통"이다. 종이컵을 버려도 물통은 남는다.

#### ⭐ 볼륨은 컨테이너에 종속되지 않는다

```
docker volume ls
→ local  calorie-project_calorie-mysql-data     ← 독립된 객체
```

컨테이너 목록과 **완전히 별개의 목록**에 있다. 그래서 설정을 바꿀 때
"볼륨 백업 → 컨테이너 삭제 → 볼륨 복원" 같은 절차가 **필요 없다.**

```
① docker-compose.yml 수정
② docker compose up -d      ← 컨테이너만 재생성, 같은 이름의 볼륨을 자동 재연결
끝.
```

> ⚠️ 단, **볼륨 이름이 바뀌면** 새 볼륨(빈 DB)이 만들어진다.
> 이름은 `폴더이름_yml의volumes키` 로 정해지므로, 프로젝트 폴더명을 바꾸면
> 데이터가 사라진 것처럼 보인다. (실제로는 예전 볼륨이 orphan으로 남아 있다)

### 명령어 5개가 전부

```bash
docker compose up -d      # 켜기
docker compose ps         # 상태 확인 (healthy 인지)
docker compose down       # 끄기 (데이터 유지)
docker compose down -v    # ⚠️ 완전 초기화 (볼륨까지 삭제)
docker compose logs -f    # 로그 보기
```

---

### `docker-compose.yml` 핵심 설정

#### ① `image: mysql:8.0` — 버전 고정

`package.json`에서 버전 고정하는 것과 같은 이유.

**실제 사례**: 예전에 `docker run mysql` (태그 없이) 로 만든 컨테이너를 열어보니
**MySQL 9.2.0 "innovation"** 이 들어 있었다. MySQL은 두 갈래로 나온다.

- **LTS (8.0, 8.4)** — 수년간 지원. 클라우드(Railway)가 제공하는 버전
- **Innovation (9.x)** — 신기능 실험용. 다음 버전 나오면 지원 종료

태그를 생략하면 그날의 `latest`가 받아진다. 그래서 **8.0으로 못 박았다.**

#### ② `utf8mb4` — 안 하면 반드시 당한다

```yaml
command:
  - --character-set-server=utf8mb4
  - --collation-server=utf8mb4_unicode_ci
```

**MySQL의 `utf8`은 진짜 UTF-8이 아니다.** 3바이트짜리라 이모지(🍚)가 깨지거나 에러가 난다.
음식 메모에 이모지가 들어갈 게 뻔하므로 처음부터 `utf8mb4`로 시작한다.
나중에 발견하면 쌓인 데이터를 전부 변환해야 한다.

#### ③ `TZ: Asia/Seoul`

안 넣으면 컨테이너가 UTC로 돌아 **저녁 8시에 먹은 저녁이 오전 11시로 기록된다.**
식단 캘린더 앱에서는 치명적.

---

### 🔐 보안 — 두 군데를 잠갔다

#### 잠금 ①: 비밀번호를 `docker-compose.yml`에 쓰지 않는다

`docker-compose.yml`은 **git에 커밋된다.** 여기에 비밀번호를 적으면 그대로 올라간다.

`docker compose`는 같은 폴더의 **`.env`를 자동으로 읽는다.** 그래서:

```yaml
MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?.env 에 MYSQL_ROOT_PASSWORD 가 없습니다}
```

| 파일 | git | 내용 |
|---|---|---|
| `docker-compose.yml` | ✅ 커밋 | "비밀번호가 필요하다"는 사실만 |
| `.env.example` | ✅ 커밋 | 양식 |
| `.env` | ❌ 제외 | 실제 값 |

> **`:?메시지` 문법** = 값이 없으면 그 메시지와 함께 실행 중단.
> `src/config/env.ts`의 `required()`와 같은 **Fail Fast** 원칙이다.
> 백엔드에서 이 패턴은 계속 반복된다 —
> **"잘못된 상태로 조용히 굴러가느니, 시작할 때 요란하게 죽는 게 낫다."**

#### 잠금 ②: 포트를 외부에 노출하지 않는다

```yaml
ports:
  - '127.0.0.1:3306:3306'
```

문법: `접근허용IP : 내컴퓨터포트 : 컨테이너포트`

| 작성 | 의미 | 외부 접근 |
|---|---|---|
| `'3306:3306'` | `0.0.0.0`에 개방 | ⚠️ **가능** — 같은 와이파이에서 접근 시도됨 |
| `'127.0.0.1:3306:3306'` | 루프백에만 개방 | ✅ 불가능 |

**실측 검증**:
```
Docker 매핑:      3306/tcp -> 127.0.0.1:3306
리스닝 주소:      TCP 127.0.0.1:3306 (LISTEN)   ← 0.0.0.0 아님
192.168.x.x:3306 → ✅ 접속 거부
127.0.0.1:3306   → ✅ 접속 정상
```

#### 🤔 왜 MySQL 쪽이 아니라 Docker 쪽에서 막았나

MySQL 자체 설정도 확인해보면 열려 있다:

```
root 계정: root@'%'          ← 어디서든 접속 허용
bind_address: *              ← 모든 주소에서 수신
```

**그런데 이건 MySQL 공식 이미지의 기본값이고, 바꾸면 오히려 접속이 끊긴다.**

컨테이너 입장에서 "내 맥북에서 오는 접속"은 `localhost`로 보이지 않는다.
포트 포워딩을 거치므로 **Docker 게이트웨이 IP(`172.x.x.x`)** 에서 온 것처럼 보인다.
그래서 `root@localhost`로 제한하면 우리 Express가 못 붙는다.

→ **MySQL 계층에서 막는 게 불가능하니 네트워크 계층에서 막았다.**
이것이 **심층 방어(defense in depth)** 의 실제 사례.

```
외부 네트워크
    │
    ▼
❌ 1차: Docker 포트 바인딩 (127.0.0.1) → 도달 불가
    │
내 맥북 내부
    │
    ▼
✅ 통과 → 2차: MySQL 비밀번호 인증
```

#### 남아 있는 리스크 (정직하게)

| 상황 | 이유 |
|---|---|
| 맥북에 악성 프로그램 | 로컬 프로세스는 `127.0.0.1`에 접근 가능 |
| ngrok / SSH 터널 | 외부 → localhost 경로가 생김 |
| **다른 컨테이너** | 컨테이너끼리는 포트 매핑과 무관하게 `mysql:3306` 직통 |

로컬 개발 환경으로는 충분히 안전하다.

---

### 비밀번호 변경 방법 — 상황에 따라 다르다

#### 데이터가 없을 때 (지금)

```bash
# .env 의 두 줄 수정 후
docker compose down -v
docker compose up -d
```

⚠️ **`-v`가 반드시 필요하다.** MySQL은 **데이터 폴더가 비어 있을 때만** 초기화 과정을
실행한다. 볼륨이 남아 있으면 "이미 세팅된 DB"로 판단해 초기화를 건너뛰고,
**비밀번호가 안 바뀐다.** (Docker+MySQL에서 가장 흔한 함정)

`MYSQL_ROOT_PASSWORD` 환경변수는 **컨테이너 탄생 시 딱 한 번만** 읽힌다.

#### 데이터가 있을 때 (나중)

`-v`를 쓰면 **모든 데이터가 영구 소실된다.** 대신 SQL로 바꾼다.

```sql
ALTER USER 'root'@'%' IDENTIFIED BY '새비밀번호';
ALTER USER 'root'@'localhost' IDENTIFIED BY '새비밀번호';
FLUSH PRIVILEGES;
```

전체 절차:
```
① 백업             mysqldump -uroot -p'비번' --databases calorie_db > dump.sql
② ALTER USER       DB 안의 비밀번호만 변경
③ .env 수정        두 줄 (MYSQL_ROOT_PASSWORD, DATABASE_URL)
④ docker compose up -d    ⚠️ -v 없이! 컨테이너만 재생성, 볼륨 유지
```

**④가 필요한 이유**: 컨테이너 환경변수는 생성 시점에 박힌다. healthcheck가
`$MYSQL_ROOT_PASSWORD`를 쓰므로, 재생성하지 않으면 옛 비밀번호로 물어봐서 `unhealthy`가 된다.

> **"위험한 명령 전엔 무조건 백업"** — 백엔드 개발자의 반사신경.

---

### 검증 결과 ✅

| 설정 | 실제 |
|---|---|
| `mysql:8.0` | **8.0.46** |
| `utf8mb4` | `utf8mb4` / `utf8mb4_unicode_ci` |
| `TZ: Asia/Seoul` | **KST**, `2026-08-01 22:23` |
| `MYSQL_DATABASE` | `calorie_db` 생성됨 |
| 포트 바인딩 | `127.0.0.1:3306->3306/tcp` |
| healthcheck | `Up (healthy)` |

---

## 2부. Node 버전 — 백엔드는 런타임에 민감하다

Prisma 설치 중 막혔다.

```
Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+.
```

우리는 20.18.3. **0.0.1 차이로 실패.**

### 왜 Node 24를 골랐나

| 버전 | 상태 (2026-08 기준) | 지원 종료 |
|---|---|---|
| 20.x | ❌ **EOL** | 2026-04 (지남) |
| 22.x | 🟡 유지보수 | 2027-04 |
| **24.18.1** | ✅ **Active LTS** | 2028-04 |

**"EOL이면 서비스가 끊기나?"** → 아니다. Node 16도 여전히 돌아간다.
**EOL의 실제 의미는 "보안 취약점이 발견돼도 고쳐주지 않는다"** 이다.

| 상황 | 위험도 |
|---|---|
| 로컬 개발만 | 낮음 |
| **배포 + 유저 비밀번호 저장** | 높음 |

이 프로젝트는 Step 10에서 배포하고 비밀번호 해시를 다루므로 후자다.

**그리고 지금이 올리기 가장 싸다.** 코드가 3개 파일이고 데이터가 0건이다.
버전 업그레이드는 미룰수록 비싸진다.

### 프로젝트별 버전 격리

```
~/.tool-versions          nodejs 16.20.2   ← 전역 기본값
├── backend/              고정 없음 → 16.20.2 사용
├── frontend/             고정 없음 → 16.20.2 사용
└── Calorie-project/      .tool-versions: nodejs 24.18.1   ← 이 폴더만
```

`asdf local`은 **현재 폴더에만** `.tool-versions`를 쓴다.
(전역을 바꾸는 건 `asdf global`)

asdf의 탐색 규칙:
```
현재 폴더에 .tool-versions 있나?
  ├─ 있음 → 그 버전
  └─ 없음 → 상위 폴더로 계속 → 끝까지 없으면 ~/.tool-versions
```

**`.tool-versions`는 반드시 git에 커밋한다.** 프론트의 `.nvmrc`와 같은 역할.

> **프론트와 백의 차이**: Vite는 웬만한 Node 버전에서 다 돈다.
> 백엔드는 네이티브 바이너리(Prisma 쿼리 엔진)와 DB 드라이버를 쓰기 때문에
> OS/아키텍처/런타임 버전을 훨씬 많이 탄다.

---

## 3부. Prisma 연결

### Prisma는 도구 3개다

| 구성요소 | 역할 | Vue 비유 |
|---|---|---|
| `schema.prisma` | 설계도 | eXERD의 ERD 그림 |
| Prisma Migrate | 설계도 → 실제 테이블 | 포워드 엔지니어링 |
| Prisma Client | 코드에서 DB 다루기 | 타입이 자동 생성되는 axios |

```
                  schema.prisma
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
   migrate dev                     generate
   → SQL 생성 & 실행                → TypeScript 타입 생성
```

**설계도 하나를 고치면 DB와 타입이 동시에 따라온다.** 이것이 Prisma의 핵심 가치.

---

### ⚠️ Prisma 7은 6.x와 구조가 다르다

인터넷 튜토리얼 대부분은 6.x 기준이다. **그대로 따라 하면 막힌다.**

실제로 처음 작성한 스키마가 이 에러로 거부됐다:

```
Error code: P1012
The datasource property `url` is no longer supported in schema files.
```

| 항목 | Prisma 6 이하 | **Prisma 7** |
|---|---|---|
| 접속 URL | `schema.prisma`의 `datasource.url` | **`prisma.config.ts`** |
| generator | `prisma-client-js` | **`prisma-client`** |
| 클라이언트 출력 | `node_modules/.prisma` | **`src/generated/prisma`** |
| CJS | 자동 | `moduleFormat = "cjs"` 명시 |
| 런타임 접속 | URL 자동 | **드라이버 어댑터** 필요 |

**왜 분리했을까**: 설계도는 어느 환경에서나 같지만, 접속 주소는
로컬/스테이징/운영마다 다르다. 자연스러운 분리다.

> **교훈**: 최신 버전은 기억에 의존하지 말고 **`prisma validate`로 확인한다.**
> 에러 메시지가 정확히 답을 알려준다. (`P1012` + 해결 링크)

### 파일 구성

```
prisma/schema.prisma   설계도 (모델 5개 + enum 4개)
prisma.config.ts       CLI 접속 설정 (루트)
src/generated/prisma   자동 생성 클라이언트 (gitignore)
```

```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
});
```

### 생성된 클라이언트를 gitignore 하는 이유

`schema.prisma`로부터 **언제든 재생성**되기 때문. 빌드 산출물은 커밋하지 않는다.
(`dist/`를 커밋하지 않는 것과 같은 이유)

`git clone` 후에는 `npx prisma generate`로 만들면 된다.

---

## 4부. 첫 마이그레이션

```bash
npx prisma migrate dev --name init
```

이 명령 하나가 네 가지를 한다:

```
① schema.prisma 와 실제 DB 비교
② prisma/migrations/2026XXXX_init/migration.sql 파일 생성   ← git에 커밋됨
③ 그 SQL 을 MySQL 에 실행 → 테이블 5개 + _prisma_migrations
④ src/generated/prisma 에 TypeScript 타입 생성
```

> **조직 정책**: 스키마를 변경하는 명령(`CREATE`, `ALTER` 등)은 Claude가 실행하지 않고
> 사용자가 직접 실행한다. 자세한 배경은
> [concepts/orm-migration-vs-exerd.md](./concepts/orm-migration-vs-exerd.md) 참고.

---

---

## 5부. Express ↔ DB 연결

### 드라이버 어댑터 (Prisma 7의 변경점)

Prisma 6까지는 URL만 있으면 내부 엔진이 알아서 붙었다.
**7부터는 "드라이버 어댑터"를 `PrismaClient` 생성자에 넘겨야 한다.**

MySQL은 mariadb 드라이버와 호환되므로 `@prisma/adapter-mariadb`를 쓴다.

```bash
npm install @prisma/adapter-mariadb
```

```ts
const adapter = new PrismaMariaDb(env.databaseUrl);
export const prisma = new PrismaClient({ adapter });
```

### ⭐ 왜 싱글턴인가

`PrismaClient`는 내부에 **커넥션 풀**(미리 열어둔 DB 연결 묶음)을 가진다.

```ts
// ❌ 요청마다 새 클라이언트
app.get('/meals', async (req, res) => {
  const prisma = new PrismaClient({ adapter });  // 매번 풀 생성!
});
```

요청 100개 → 커넥션 풀 100개 → MySQL 기본 최대 연결 수(151)를 넘겨 서버가 죽는다.

> **Vue 비유**: `axios.create()`를 컴포넌트마다 하지 않고 `api.ts`에서 한 번 만들어
> export 하는 것과 같은 이유. Pinia store가 앱 전체에서 하나인 것과도 같다.

**실측 증거** — 같은 엔드포인트를 두 번 호출했을 때:

```
prisma:query SELECT 1
GET /health 200 108.728 ms    ← 첫 요청: 커넥션 새로 염
prisma:query SELECT 1
GET /health 200 1.781 ms      ← 두 번째: 풀에서 재사용 (60배 빠름)
```

### 쿼리 로그를 켜두면 ORM이 블랙박스가 아니게 된다

```ts
log: env.isProduction ? ['error'] : ['query', 'warn', 'error'],
```

개발 중에는 Prisma가 만든 **실제 SQL이 터미널에 그대로 찍힌다.**
`prisma.user.findMany()`가 어떤 `SELECT`로 번역되는지 눈으로 볼 수 있다.

운영에서는 끈다. 로그가 너무 많고 쿼리에 민감정보가 섞일 수 있다.

### 헬스체크는 DB까지 확인해야 한다

서버 프로세스가 살아있어도 **DB가 죽어 있으면 아무 일도 못 한다.**

```ts
app.get('/health', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();   // SELECT 1
  res.status(dbConnected ? 200 : 503).json({ ... });
});
```

DB가 죽으면 **200이 아니라 503(Service Unavailable)** 을 준다.
배포 플랫폼이 이걸 보고 "이 인스턴스로 트래픽 보내지 말자"고 판단한다.

> `SELECT 1` 은 "아무 데이터도 안 읽지만 서버가 응답은 하는지" 확인하는 관용 쿼리.

### 종료 시 커넥션 정리

```ts
server.close(async () => {
  await disconnectPrisma();   // 처리 중인 요청이 끝난 뒤에
  process.exit(0);
});
```

**순서가 중요하다.** 먼저 끊으면 진행 중인 쿼리가 실패한다.
정리하지 않으면 DB 쪽에 "좀비 커넥션"이 쌓인다.

---

## 6부. 모노레포 재구성

프로젝트 이름을 **snapcal** 로 정하고 구조를 바꿨다.

```
snapcal/
├── docs/, CLAUDE.md, README.md, .gitignore, .tool-versions   ← 공통
├── server/     ← 백엔드 전부 (docker-compose.yml 포함)
└── web/        ← Vue (예정)
```

### 명령 실행 위치가 갈린다 (모노레포의 유일한 실질적 불편)

| 명령 | 위치 |
|---|---|
| `git *` | **루트** |
| `npm *`, `npx prisma *`, `docker compose *` | **server/** |

> 터미널 탭을 두 개 열어두면 편하다. 하나는 루트(git), 하나는 `server/`(개발).

### ⭐ `name: snapcal` 을 compose 에 박은 이유

```yaml
name: snapcal
```

생략하면 Compose 는 **"파일이 있는 폴더 이름"** 을 프로젝트 이름으로 쓴다.
그러면 볼륨이 `server_snapcal-mysql-data` 가 되어:

- 다른 프로젝트에도 `server/` 폴더가 있으면 **충돌**
- 폴더 이름을 바꾸는 순간 볼륨 이름이 달라져 **데이터가 사라진 것처럼 보임**

명시해두면 폴더를 어디로 옮기든 항상 같은 볼륨을 찾는다.

### 실험: 빈 DB에서 스키마 복원

컨테이너와 볼륨을 완전히 삭제하고 새로 만든 뒤:

```bash
npx prisma migrate deploy
```

```
BEFORE                    AFTER
(테이블 0개)      ──→     users, body_records, meals,
                          meal_items, ai_analysis_logs,
                          _prisma_migrations
```

**이것이 "다른 PC에서 git clone 했을 때" 벌어지는 일과 정확히 같다.**
데이터(행)는 안 따라가지만, **설계는 파일에 있어서 명령 한 줄로 재현된다.**

`migrate dev` 와 `migrate deploy` 의 차이:

| | `migrate dev` | `migrate deploy` |
|---|---|---|
| 새 SQL 생성 | ✅ | ❌ (기존 파일만 적용) |
| 대화형 확인 | 있음 | 없음 |
| 용도 | 개발 중 스키마 변경 | **배포 / 협업 / 환경 복원** |

Step 10에서 Railway 배포할 때도 `migrate deploy` 를 쓴다.

### ⚠️ Prisma 7 은 마이그레이션 후 타입을 자동 생성하지 않는다

Prisma 6까지는 `migrate dev` 가 클라이언트까지 만들어줬지만, 7은 아니다.

```bash
npx prisma generate   # 따로 실행해야 src/generated/prisma 가 만들어진다
```

---

## 이 단계에서 얻은 사고방식

| 손으로 하면 | 파일로 선언하면 | 얻는 것 |
|---|---|---|
| `docker run` 직접 입력 | `docker-compose.yml` | 재현 가능한 DB 환경 |
| eXERD DDL 수동 실행 | `migrations/*.sql` | 재현 가능한 스키마 |
| Node 버전 각자 알아서 | `.tool-versions` | 재현 가능한 런타임 |

**"손으로 한 건 기억에 남고, 파일로 적은 건 git에 남는다."**

그리고 여기서 항상 따라오는 질문 — **"그럼 비밀값은?"**
답은 **구조는 커밋하고, 값은 분리한다.**

이 사고방식을 **IaC(Infrastructure as Code)** 라고 부른다.
