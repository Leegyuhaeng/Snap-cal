// ─────────────────────────────────────────────────────────────
// Prisma CLI 설정 파일 (Prisma 7 부터 도입)
//
// Prisma 6 까지는 schema.prisma 안에 datasource url 을 적었지만,
// 7 부터는 "설계도(schema.prisma)" 와 "접속 정보(이 파일)" 를 분리한다.
//
// 이 파일은 CLI 전용이다.
//   - npx prisma migrate dev
//   - npx prisma studio
// 같은 명령이 DB 에 접속할 때 여기의 url 을 쓴다.
//
// 애플리케이션 코드(Express)가 쓰는 접속은 별개이며,
// PrismaClient 를 만들 때 어댑터로 따로 넘긴다. (src/config/prisma.ts)
// ─────────────────────────────────────────────────────────────

// .env 를 읽어 process.env 에 채운다. env() 보다 먼저 실행돼야 한다.
import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    // .env 의 DATABASE_URL 을 읽는다. 값이 없으면 명령이 실패한다.
    url: env('DATABASE_URL'),
  },
});
