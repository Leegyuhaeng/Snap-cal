import app from './app';
import { env } from './config/env';
import { disconnectPrisma } from './config/prisma';

/**
 * 이 파일의 유일한 책임: 포트를 열고 서버를 켜는 것.
 *
 * app.ts 와 굳이 나눈 이유:
 * 나중에 테스트 코드를 짤 때 "실제 포트를 열지 않고" app 만 가져다
 * 요청을 흉내내고 싶기 때문이다. (supertest 라는 도구를 쓰게 된다)
 * 한 파일에 다 있으면 import 하는 순간 포트가 열려버려서 테스트가 꼬인다.
 */
const server = app.listen(env.port, () => {
  console.log('');
  console.log(`  🚀 서버 실행 중`);
  console.log(`  ➜  http://localhost:${env.port}`);
  console.log(`  ➜  헬스체크: http://localhost:${env.port}/health`);
  console.log(`  ➜  환경: ${env.nodeEnv}`);
  console.log('');
});

/**
 * Graceful Shutdown (우아한 종료)
 *
 * 서버를 끌 때 그냥 죽이면, 처리 중이던 요청이 중간에 끊긴다.
 * 결제 처리 중이었다면? 끔찍하다.
 * 이 코드는 "새 요청은 안 받되, 처리 중인 건 끝내고 죽어라" 는 뜻이다.
 * 배포 환경(Railway)에서 재배포될 때마다 실제로 동작한다.
 */
const shutdown = (signal: string) => {
  console.log(`\n${signal} 수신. 서버를 종료합니다...`);
  server.close(async () => {
    // 처리 중인 요청이 끝난 뒤에 DB 커넥션 풀도 정리한다.
    // 순서가 중요하다. 먼저 끊으면 진행 중인 쿼리가 실패한다.
    await disconnectPrisma();
    console.log('✅ 서버와 DB 연결이 정상 종료되었습니다.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl + C
process.on('SIGTERM', () => shutdown('SIGTERM')); // 배포 플랫폼의 종료 신호
