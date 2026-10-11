/**
 * uploads.ts — 上传校验与配额守卫（纯函数，便于测试）
 *
 * 限制双层防护：前端选文件即校验，此处为后端最终防线（Content-Length 之外再验实际字节数）。
 * 平台 Worker 请求体上限 100MB 永远不会被触及。
 */

// 允许的 MIME → 扩展名（扩展名由 MIME 推导，不信任文件名）
export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB

// 应用层存储配额：R2 免费额度 10 GB·月为账号级共享，
// 本站只用 1 GB，给其他 R2 项目留足空间；95% 起拒绝上传（约 0.95GB）
export const QUOTA_BYTES = 1_000_000_000;
export const QUOTA_GUARD_BYTES = Math.floor(QUOTA_BYTES * 0.95);

export function maxBytesFor(mime: string): number {
  return mime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export interface UploadCheck {
  ok: boolean;
  status: number;
  error: string;
  ext: string;
}

/** 上传前校验：类型白名单 + 大小上限 + 配额守卫 */
export function checkUpload(mime: string, size: number, totalBytes: number): UploadCheck {
  const ext = ALLOWED_MIME[mime];
  if (!ext) return { ok: false, status: 415, error: '不支持的文件类型（仅支持 jpg/png/gif/webp/svg/webm/mp4）', ext: '' };
  if (size <= 0) return { ok: false, status: 400, error: '文件为空', ext };
  const limit = maxBytesFor(mime);
  if (size > limit) {
    return {
      ok: false,
      status: 413,
      error: mime.startsWith('video/') ? '视频不能超过 20MB' : '图片不能超过 5MB',
      ext,
    };
  }
  if (totalBytes + size > QUOTA_GUARD_BYTES) {
    return { ok: false, status: 507, error: '存储空间不足（免费额度 10GB），请到文件库清理未使用文件', ext };
  }
  return { ok: true, status: 200, error: '', ext };
}

/** 对象 key：uploads/YYYY/MM/随机名.后缀（防碰撞、防猜测） */
export function buildObjectKey(ext: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `uploads/${y}/${m}/${hex}${ext}`;
}

/** 图片字段值（/files/<key>）→ 对象 key；非本域路径返回 null */
export function fileKeyFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/files/')) return null;
  const key = value.slice('/files/'.length);
  return key || null;
}
