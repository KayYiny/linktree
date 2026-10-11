/**
 * keygen.ts — 密钥算法的服务端入口（类型化再导出）
 *
 * 算法唯一实现在 public/assets/scripts/keygen.js（UMD，前端零构建直接使用），
 * 此处只做引入与类型标注，保证服务端校验与前端地址栏归一化共享同一份逻辑。
 */
// @ts-ignore -- UMD 纯 JS 模块，无独立类型声明
import keygenImpl from '../../public/assets/scripts/keygen.js';

export interface KeygenApi {
  DEFAULT_SALT: string;
  hash(s: string): string;
  bucket(rotation: string, date?: Date): string;
  currentKey(rotation: string, salt: string): string;
  isValid(k: string, rotation: string, salt: string, permanent: string): boolean;
}

const keygen = keygenImpl as KeygenApi;

export default keygen;
