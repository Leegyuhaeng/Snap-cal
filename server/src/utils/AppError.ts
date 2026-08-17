/**
 * 우리가 "의도적으로" 발생시키는 에러.
 *
 * ─────────────────────────────────────────────────────────
 * 왜 따로 만드나
 *
 * 에러에는 두 종류가 있다.
 *   ① 예상한 에러 — "이메일 중복", "비밀번호 8자 미만"
 *      → 유저에게 그대로 보여줘도 되고, 보여줘야 한다
 *   ② 예상 못 한 에러 — DB 연결 끊김, 코드 버그(TypeError)
 *      → 유저에게 보여주면 안 된다. 내부 구조가 노출된다
 *
 * 둘을 구분하지 않으면 이런 응답이 나간다:
 *   "Cannot read property 'email' of undefined at /app/src/services/..."
 * 서버 파일 경로와 코드 구조가 그대로 새어나가는 것이다.
 *
 * AppError 는 ①에만 쓴다. 이걸로 감싸지 않은 에러는 전부 ②로 취급해
 * "서버 오류가 발생했습니다" 로 뭉뚱그려 응답한다.
 * ─────────────────────────────────────────────────────────
 */
export class AppError extends Error {
  /** 이 에러에 대응하는 HTTP 상태 코드 */
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;

    // 스택 트레이스에서 이 생성자 자체는 빼준다 (에러가 "발생한 곳"이 잘 보이도록)
    Error.captureStackTrace?.(this, AppError);
  }
}

/** unknown 타입의 에러가 AppError 인지 좁혀주는 타입 가드 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Express 생태계 미들웨어가 던지는 에러.
 *
 * express.json() 같은 미들웨어는 우리 Controller 보다 먼저 실행되므로
 * AppError 를 쓸 수 없다. 대신 http-errors 규약을 따라
 * statusCode 와 expose 를 달고 온다.
 *
 *   잘못된 JSON  → statusCode 400, expose true
 *   본문 크기 초과 → statusCode 413, expose true
 *
 * expose: true 는 "이 에러는 클라이언트 잘못이므로 알려줘도 안전하다" 는 뜻이다.
 * 이걸 구분하지 않으면 명백한 400 요청에 500 을 돌려주게 된다.
 */
export type HttpErrorLike = { statusCode: number; expose: boolean };

export function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  if (typeof error !== 'object' || error === null) return false;

  const e = error as Record<string, unknown>;
  return (
    typeof e.statusCode === 'number' &&
    e.statusCode >= 400 &&
    e.statusCode < 500 &&
    e.expose === true
  );
}
