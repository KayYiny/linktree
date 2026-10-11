/** cloudflare:test 环境绑定类型增强 */
import type { Env } from '../src/lib/env';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
