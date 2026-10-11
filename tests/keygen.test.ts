/**
 * keygen.test.ts — 密钥轮换/校验单元测试（与前端共享的同一份算法）
 */
import { describe, expect, test } from 'vitest';
import keygen from '../src/lib/keygen';

const SALT = 'unit-test-salt';

describe('keygen', () => {
  test('currentKey 为 6 位字符串', () => {
    const k = keygen.currentKey('daily', SALT);
    expect(k).toMatch(/^[0-9a-z]{6}$/);
  });

  test('同一时间桶内密钥稳定', () => {
    expect(keygen.currentKey('daily', SALT)).toBe(keygen.currentKey('daily', SALT));
  });

  test('不同盐值产生不同密钥', () => {
    expect(keygen.currentKey('daily', SALT)).not.toBe(keygen.currentKey('daily', SALT + '2'));
  });

  test('isValid：当前轮换密钥有效，乱填无效', () => {
    const k = keygen.currentKey('daily', SALT);
    expect(keygen.isValid(k, 'daily', SALT, '')).toBe(true);
    expect(keygen.isValid('xxxxxx', 'daily', SALT, '')).toBe(false);
    expect(keygen.isValid('', 'daily', SALT, '')).toBe(false);
  });

  test('isValid：永久密钥永远有效', () => {
    expect(keygen.isValid('my-perma', 'daily', SALT, 'my-perma')).toBe(true);
    expect(keygen.isValid(keygen.currentKey('daily', SALT), 'daily', SALT, 'my-perma')).toBe(true);
  });

  test('bucket：UTC 时间桶边界', () => {
    const d1 = new Date('2026-01-01T23:59:59Z');
    const d2 = new Date('2026-01-02T00:00:00Z');
    expect(keygen.bucket('hourly', d1)).not.toBe(keygen.bucket('hourly', d2));
    expect(keygen.bucket('daily', d1)).not.toBe(keygen.bucket('daily', d2));
    expect(keygen.bucket('monthly', d1)).toBe(keygen.bucket('monthly', d2));
    expect(keygen.bucket('never', d1)).toBe('static');
    expect(keygen.bucket('daily', d1)).toBe('2026-01-01');
    expect(keygen.bucket('hourly', d1)).toBe('2026-01-01-23');
    expect(keygen.bucket('monthly', d1)).toBe('2026-01');
    expect(keygen.bucket('weekly', new Date('2026-01-04T12:00:00Z'))).toMatch(/2026-W0?1/);
  });
});
