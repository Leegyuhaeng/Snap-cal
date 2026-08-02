import dotenv from 'dotenv';

// .env 파일을 읽어서 process.env 에 채워 넣는다.
// ⚠️ 이 코드는 앱 전체에서 "가장 먼저" 실행돼야 한다.
dotenv.config();

/**
 * 필수 환경변수를 꺼낸다. 없으면 서버를 아예 못 켜게 막는다.
 *
 * 왜 이렇게까지 하냐면:
 * 값이 undefined 인 채로 서버가 켜지면, 새벽 3시에 유저가 API를 호출한
 * 순간에야 터진다. 차라리 서버 시작 시점에 요란하게 죽는 게 100배 낫다.
 * (Fail Fast 원칙)
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ 환경변수 ${key} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Vue 개발 서버 주소. 여기 없는 곳에서 온 요청은 브라우저가 막는다.
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // DB 접속 주소. 없으면 서버를 아예 못 켜게 막는다.
  // (기본값을 두지 않는 이유: 잘못된 DB 에 조용히 붙는 것보다 죽는 게 낫다)
  databaseUrl: required('DATABASE_URL'),

  isProduction: process.env.NODE_ENV === 'production',
};

// 앞으로 여기에 추가될 것들
// jwtSecret: required('JWT_SECRET'),   ← Step 4
export { required };
