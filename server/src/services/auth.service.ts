import bcrypt from 'bcrypt';

import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../utils/AppError';

/**
 * ─────────────────────────────────────────────────────────
 * ⭐ 이 파일의 철칙: req 와 res 를 절대 모른다.
 *
 * HTTP 는 껍데기일 뿐이다. 이 함수는 값을 받아 값을 반환한다.
 * 그래야 테스트 코드, seed 스크립트, 관리자 기능, CLI 에서
 * 그대로 재사용할 수 있다.
 * (Vue 의 잘 만든 composable 이 특정 컴포넌트에 의존하지 않는 것과 같다)
 * ─────────────────────────────────────────────────────────
 */

/**
 * bcrypt cost factor.
 *
 * 값이 1 오를 때마다 계산 시간이 2배가 된다.
 *   10 → 약 0.07초  (현재)
 *   12 → 약 0.3초
 *   14 → 약 1.2초
 *
 * 이 비용은 해커가 아니라 "우리 서버"가 낸다.
 * 로그인 응답이 100~250ms 를 넘지 않는 선에서 가장 높게 잡는 것이 기준이며,
 * 일반 웹 앱은 10~12 가 표준이다.
 */
const SALT_ROUNDS = 10;

export type SignupInput = {
  email: string;
  password: string;
  nickname: string;
};

/**
 * 외부에 공개해도 되는 유저 정보.
 * passwordHash 가 여기 없다는 점이 중요하다.
 */
export type PublicUser = {
  id: string;
  email: string;
  nickname: string;
  createdAt: Date;
};

/**
 * 회원가입.
 *
 * @throws {AppError} 409 - 이미 사용 중인 이메일
 */
export async function signup(input: SignupInput): Promise<PublicUser> {
  // 이메일은 대소문자를 구분하지 않는 게 상식적이다.
  // Test@a.com 으로 가입하고 test@a.com 으로 로그인하면 당연히 되어야 한다.
  // → 저장 시점에 소문자로 통일한다. (검증도 항상 이 형태로)
  const email = input.email.trim().toLowerCase();
  const nickname = input.nickname.trim();

  // ① 중복 확인
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true }, // 존재 여부만 알면 되므로 최소한만 읽는다
  });

  if (existing) {
    throw new AppError('이미 사용 중인 이메일입니다.', 409);
  }

  // ② 비밀번호 해싱
  //
  // 암호화(복호화 가능)가 아니라 해싱(단방향)이다.
  // 우리는 유저의 비밀번호를 "알" 필요가 없다. "같은지"만 확인하면 된다.
  // bcrypt 는 salt 를 자동 생성해서 해시 문자열 안에 함께 담아준다.
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // ③ 저장
  try {
    return await prisma.user.create({
      data: { email, passwordHash, nickname },

      // ⭐ select 로 반환할 필드를 "화이트리스트" 방식으로 지정한다.
      //    이렇게 하면 passwordHash 가 실수로 새어나갈 수 없다.
      //    (나중에 컬럼이 추가돼도 여기 안 적으면 안 나간다)
      select: { id: true, email: true, nickname: true, createdAt: true },
    });
  } catch (error) {
    // ④ 동시성 대비
    //
    // ①의 중복 확인과 ③의 저장 사이에는 아주 짧지만 틈이 있다.
    // 같은 이메일로 두 요청이 거의 동시에 들어오면 둘 다 ①을 통과할 수 있다.
    // (bcrypt 해싱에 70ms 나 걸리므로 그 틈이 생각보다 넓다)
    //
    // 최종 방어선은 DB 의 UNIQUE 제약이다. 위반 시 Prisma 가 P2002 를 던진다.
    // 이 경우도 유저 입장에서는 "중복"이므로 같은 응답으로 바꿔준다.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('이미 사용 중인 이메일입니다.', 409);
    }
    throw error;
  }
}
