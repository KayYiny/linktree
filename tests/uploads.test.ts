/**
 * uploads.test.ts — 上传校验与配额守卫单元测试（纯函数，无 DB）
 */
import { describe, expect, test } from 'vitest';
import {
  checkUpload,
  buildObjectKey,
  fileKeyFromUrl,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  QUOTA_GUARD_BYTES,
  QUOTA_BYTES,
} from '../src/lib/uploads';

describe('checkUpload', () => {
  test('合法图片通过', () => {
    const r = checkUpload('image/png', 1024, 0);
    expect(r.ok).toBe(true);
    expect(r.ext).toBe('.png');
  });

  test('类型白名单：不支持的类型拒绝', () => {
    expect(checkUpload('text/plain', 10, 0).status).toBe(415);
    expect(checkUpload('application/pdf', 10, 0).ok).toBe(false);
    expect(checkUpload('', 10, 0).ok).toBe(false);
  });

  test('图片超过 5MB 拒绝，视频上限 20MB', () => {
    expect(checkUpload('image/jpeg', MAX_IMAGE_BYTES + 1, 0).status).toBe(413);
    expect(checkUpload('image/jpeg', MAX_IMAGE_BYTES, 0).ok).toBe(true);
    expect(checkUpload('video/mp4', MAX_VIDEO_BYTES, 0).ok).toBe(true);
    expect(checkUpload('video/mp4', MAX_VIDEO_BYTES + 1, 0).status).toBe(413);
  });

  test('空文件拒绝', () => {
    expect(checkUpload('image/png', 0, 0).ok).toBe(false);
  });

  test('配额守卫：接近 10GB 拒绝上传（保证零扣费）', () => {
    expect(checkUpload('image/png', 1024, QUOTA_BYTES - 10_000_000).status).toBe(507);
    expect(checkUpload('image/png', 1024, QUOTA_GUARD_BYTES - 100_000).ok).toBe(true);
    expect(checkUpload('image/png', 1024, QUOTA_GUARD_BYTES).status).toBe(507);
  });
});

describe('buildObjectKey / fileKeyFromUrl', () => {
  test('key 形如 uploads/YYYY/MM/随机名.后缀', () => {
    const key = buildObjectKey('.png', new Date('2026-10-12T00:00:00Z'));
    expect(key).toMatch(/^uploads\/2026\/10\/[0-9a-f]{16}\.png$/);
  });

  test('key 随机不碰撞', () => {
    expect(buildObjectKey('.png')).not.toBe(buildObjectKey('.png'));
  });

  test('fileKeyFromUrl 只认 /files/ 前缀', () => {
    expect(fileKeyFromUrl('/files/uploads/2026/10/abc.png')).toBe('uploads/2026/10/abc.png');
    expect(fileKeyFromUrl('https://example.com/a.png')).toBeNull();
    expect(fileKeyFromUrl('assets/demo/a.png')).toBeNull();
    expect(fileKeyFromUrl('/files/')).toBeNull();
    expect(fileKeyFromUrl(null)).toBeNull();
  });
});
