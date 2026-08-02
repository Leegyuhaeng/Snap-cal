import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

/**
 * Prisma Client 싱글턴
 *
 * ─────────────────────────────────────────────────────────
 * 왜 하나만 만드는가
 *
 * PrismaClient 는 내부에 "커넥션 풀"(미리 열어둔 DB 연결 묶음)을 가진다.
 * 요청마다 new PrismaClient() 를 하면 풀이 요청 수만큼 생기고,
 * MySQL 의 기본 최대 연결 수(151개)를 금방 넘겨 서버가 죽는다.
 *
 * Vue 로 치면 axios.create() 를 컴포넌트마다 하지 않고
 * api.ts 에서 한 번 만들어 export 하는 것과 같은 이유다.
 * ─────────────────────────────────────────────────────────
 */

// Prisma 7 부터는 "드라이버 어댑터"를 통해 DB 에 접속한다.
// (6 까지는 URL 만 주면 내부 엔진이 알아서 붙었다)
// MySQL 은 mariadb 드라이버와 호환되므로 이 어댑터를 쓴다.
const adapter = new PrismaMariaDb(env.databaseUrl);

export const prisma = new PrismaClient({
  adapter,

  // 개발 중에는 실행되는 SQL 을 눈으로 보는 게 학습에 큰 도움이 된다.
  // 운영에서는 쿼리 로그가 너무 많고 민감정보가 찍힐 수 있어 끈다.
  log: env.isProduction ? ['error'] : ['query', 'warn', 'error'],
});

/**
 * DB 연결 확인용 헬퍼.
 *
 * SELECT 1 은 "아무 데이터도 안 읽지만 서버가 응답은 하는지" 를
 * 확인하는 관용적인 최소 쿼리다. 헬스체크에 쓰인다.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * 서버 종료 시 커넥션 풀을 정리한다.
 * 이걸 안 하면 DB 쪽에 연결이 남아 "좀비 커넥션"이 쌓인다.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
