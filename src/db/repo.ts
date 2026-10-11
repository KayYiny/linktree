/**
 * repo.ts — 数据访问层：所有 SQL 集中在此（D1 prepared statements）
 *
 * SQLite 中布尔存 0/1，读出时统一转为 boolean，保持旧接口 JSON 形状不变。
 */

// ==================== 行类型 ====================

export interface PageRow {
  id: number;
  slug: string;
  title: string | null;
  background_image: string | null;
  is_active: boolean;
  gallery_enabled: boolean;
  sort_order: number;
  created_at: string | null;
}

export interface LinkRow {
  id: number;
  page_id: number | null;
  label: string;
  url: string | null;
  icon: string | null;
  qr_code: string | null;
  popup_note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
}

export interface GalleryRow {
  id: number;
  page_id: number | null;
  src: string;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
}

export interface PetRow {
  id: number;
  page_id: number | null;
  pet_image: string;
  pet_type: string | null;
  /** 单语语录数组（JSON 文本存库） */
  messages: string[];
  is_active: boolean;
  created_at: string | null;
}

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  login_failed: number;
  lockout_until: string | null;
  created_at: string | null;
}

// ==================== 工具 ====================

type DB = D1Database;

const toBool = (v: unknown): boolean => v === 1 || v === true || v === '1';
const fromBool = (v: unknown): number => (v ? 1 : 0);

const now = (): string => new Date().toISOString();

function parseMessages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ==================== pages ====================

function mapPage(r: Record<string, unknown>): PageRow {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: (r.title as string) ?? null,
    background_image: (r.background_image as string) ?? null,
    is_active: toBool(r.is_active),
    gallery_enabled: toBool(r.gallery_enabled),
    sort_order: Number(r.sort_order ?? 0),
    created_at: (r.created_at as string) ?? null,
  };
}

export async function listPages(db: DB): Promise<PageRow[]> {
  const { results } = await db.prepare('SELECT * FROM pages ORDER BY sort_order').all();
  return results.map((r) => mapPage(r as Record<string, unknown>));
}

export async function getPageBySlug(db: DB, slug: string): Promise<PageRow | null> {
  const r = await db.prepare('SELECT * FROM pages WHERE slug = ?').bind(slug).first();
  return r ? mapPage(r as Record<string, unknown>) : null;
}

export async function getPageById(db: DB, id: number): Promise<PageRow | null> {
  const r = await db.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first();
  return r ? mapPage(r as Record<string, unknown>) : null;
}

export async function createPage(
  db: DB,
  input: {
    slug: string;
    title?: string | null;
    background_image?: string | null;
    is_active?: boolean;
    gallery_enabled?: boolean;
    sort_order?: number;
  }
): Promise<PageRow> {
  const r = await db
    .prepare(
      `INSERT INTO pages (slug, title, background_image, is_active, gallery_enabled, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      input.slug,
      input.title ?? null,
      input.background_image ?? null,
      fromBool(input.is_active ?? true),
      fromBool(input.gallery_enabled ?? true),
      input.sort_order ?? 0,
      now()
    )
    .first();
  return mapPage(r as Record<string, unknown>);
}

export async function updatePage(
  db: DB,
  id: number,
  input: {
    slug: string;
    title?: string | null;
    background_image?: string | null;
    is_active?: boolean;
    gallery_enabled?: boolean;
    sort_order?: number;
  }
): Promise<PageRow | null> {
  const r = await db
    .prepare(
      `UPDATE pages SET slug=?, title=?, background_image=?, is_active=?, gallery_enabled=?, sort_order=?
       WHERE id=? RETURNING *`
    )
    .bind(
      input.slug,
      input.title ?? null,
      input.background_image ?? null,
      fromBool(input.is_active ?? true),
      fromBool(input.gallery_enabled ?? true),
      input.sort_order ?? 0,
      id
    )
    .first();
  return r ? mapPage(r as Record<string, unknown>) : null;
}

export async function deletePage(db: DB, id: number): Promise<void> {
  await db.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
}

// ==================== links ====================

function mapLink(r: Record<string, unknown>): LinkRow {
  return {
    id: Number(r.id),
    page_id: r.page_id == null ? null : Number(r.page_id),
    label: String(r.label),
    url: (r.url as string) ?? null,
    icon: (r.icon as string) ?? null,
    qr_code: (r.qr_code as string) ?? null,
    popup_note: (r.popup_note as string) ?? null,
    sort_order: Number(r.sort_order ?? 0),
    is_active: toBool(r.is_active),
    created_at: (r.created_at as string) ?? null,
  };
}

export interface LinkInput {
  page_id: number | null;
  label: string;
  url?: string | null;
  icon?: string | null;
  qr_code?: string | null;
  popup_note?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export async function listLinks(db: DB, pageId?: number): Promise<LinkRow[]> {
  const sql =
    pageId == null
      ? 'SELECT * FROM links ORDER BY sort_order'
      : 'SELECT * FROM links WHERE page_id = ? ORDER BY sort_order';
  const stmt = pageId == null ? db.prepare(sql) : db.prepare(sql).bind(pageId);
  const { results } = await stmt.all();
  return results.map((r) => mapLink(r as Record<string, unknown>));
}

export async function createLink(db: DB, input: LinkInput): Promise<LinkRow> {
  const r = await db
    .prepare(
      `INSERT INTO links (page_id, label, url, icon, qr_code, popup_note, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      input.page_id,
      input.label,
      input.url ?? null,
      input.icon ?? null,
      input.qr_code ?? null,
      input.popup_note ?? null,
      input.sort_order ?? 0,
      fromBool(input.is_active ?? true),
      now()
    )
    .first();
  return mapLink(r as Record<string, unknown>);
}

export async function updateLink(db: DB, id: number, input: LinkInput): Promise<LinkRow | null> {
  const r = await db
    .prepare(
      `UPDATE links SET page_id=?, label=?, url=?, icon=?, qr_code=?, popup_note=?, sort_order=?, is_active=?
       WHERE id=? RETURNING *`
    )
    .bind(
      input.page_id,
      input.label,
      input.url ?? null,
      input.icon ?? null,
      input.qr_code ?? null,
      input.popup_note ?? null,
      input.sort_order ?? 0,
      fromBool(input.is_active ?? true),
      id
    )
    .first();
  return r ? mapLink(r as Record<string, unknown>) : null;
}

export async function deleteLink(db: DB, id: number): Promise<void> {
  await db.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
}

// ==================== gallery ====================

function mapGallery(r: Record<string, unknown>): GalleryRow {
  return {
    id: Number(r.id),
    page_id: r.page_id == null ? null : Number(r.page_id),
    src: String(r.src),
    sort_order: Number(r.sort_order ?? 0),
    is_active: toBool(r.is_active),
    created_at: (r.created_at as string) ?? null,
  };
}

export interface GalleryInput {
  page_id: number | null;
  src: string;
  sort_order?: number;
  is_active?: boolean;
}

export async function listGallery(db: DB, pageId?: number): Promise<GalleryRow[]> {
  const sql =
    pageId == null
      ? 'SELECT * FROM gallery_images ORDER BY sort_order'
      : 'SELECT * FROM gallery_images WHERE page_id = ? ORDER BY sort_order';
  const stmt = pageId == null ? db.prepare(sql) : db.prepare(sql).bind(pageId);
  const { results } = await stmt.all();
  return results.map((r) => mapGallery(r as Record<string, unknown>));
}

export async function createGallery(db: DB, input: GalleryInput): Promise<GalleryRow> {
  const r = await db
    .prepare(
      `INSERT INTO gallery_images (page_id, src, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(input.page_id, input.src, input.sort_order ?? 0, fromBool(input.is_active ?? true), now())
    .first();
  return mapGallery(r as Record<string, unknown>);
}

export async function updateGallery(
  db: DB,
  id: number,
  input: GalleryInput
): Promise<GalleryRow | null> {
  const r = await db
    .prepare(
      `UPDATE gallery_images SET page_id=?, src=?, sort_order=?, is_active=? WHERE id=? RETURNING *`
    )
    .bind(input.page_id, input.src, input.sort_order ?? 0, fromBool(input.is_active ?? true), id)
    .first();
  return r ? mapGallery(r as Record<string, unknown>) : null;
}

export async function deleteGallery(db: DB, id: number): Promise<void> {
  await db.prepare('DELETE FROM gallery_images WHERE id = ?').bind(id).run();
}

// ==================== pet ====================

function mapPet(r: Record<string, unknown>): PetRow {
  return {
    id: Number(r.id),
    page_id: r.page_id == null ? null : Number(r.page_id),
    pet_image: String(r.pet_image),
    pet_type: (r.pet_type as string) ?? null,
    messages: parseMessages(r.messages),
    is_active: toBool(r.is_active),
    created_at: (r.created_at as string) ?? null,
  };
}

export interface PetInput {
  page_id: number | null;
  pet_image: string;
  pet_type?: string | null;
  messages?: string[];
  is_active?: boolean;
}

export async function listPets(db: DB, pageId?: number): Promise<PetRow[]> {
  const sql =
    pageId == null
      ? 'SELECT * FROM pet_config'
      : 'SELECT * FROM pet_config WHERE page_id = ?';
  const stmt = pageId == null ? db.prepare(sql) : db.prepare(sql).bind(pageId);
  const { results } = await stmt.all();
  return results.map((r) => mapPet(r as Record<string, unknown>));
}

export async function createPet(db: DB, input: PetInput): Promise<PetRow> {
  const r = await db
    .prepare(
      `INSERT INTO pet_config (page_id, pet_image, pet_type, messages, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      input.page_id,
      input.pet_image,
      input.pet_type ?? null,
      JSON.stringify(input.messages ?? []),
      fromBool(input.is_active ?? true),
      now()
    )
    .first();
  return mapPet(r as Record<string, unknown>);
}

export async function updatePet(db: DB, id: number, input: PetInput): Promise<PetRow | null> {
  const r = await db
    .prepare(
      `UPDATE pet_config SET pet_image=?, pet_type=?, messages=?, is_active=? WHERE id=? RETURNING *`
    )
    .bind(
      input.pet_image,
      input.pet_type ?? null,
      JSON.stringify(input.messages ?? []),
      fromBool(input.is_active ?? true),
      id
    )
    .first();
  return r ? mapPet(r as Record<string, unknown>) : null;
}

export async function deletePet(db: DB, id: number): Promise<void> {
  await db.prepare('DELETE FROM pet_config WHERE id = ?').bind(id).run();
}

// ==================== site_config ====================

export async function getAllConfig(db: DB): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM site_config').all();
  const config: Record<string, string> = {};
  for (const r of results) config[String(r.key)] = String(r.value);
  return config;
}

export async function upsertConfig(db: DB, entries: Record<string, string>): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .bind(key, value, now())
  );
  if (stmts.length) await db.batch(stmts);
}

// ==================== admin（单行表） ====================

function mapAdmin(r: Record<string, unknown>): AdminRow {
  return {
    id: Number(r.id),
    username: String(r.username),
    password_hash: String(r.password_hash),
    login_failed: Number(r.login_failed ?? 0),
    lockout_until: (r.lockout_until as string) ?? null,
    created_at: (r.created_at as string) ?? null,
  };
}

export async function getAdmin(db: DB): Promise<AdminRow | null> {
  const r = await db.prepare('SELECT * FROM admin WHERE id = 1').first();
  return r ? mapAdmin(r as Record<string, unknown>) : null;
}

export async function createAdmin(db: DB, username: string, passwordHash: string): Promise<void> {
  await db
    .prepare('INSERT INTO admin (id, username, password_hash, created_at) VALUES (1, ?, ?, ?)')
    .bind(username, passwordHash, now())
    .run();
}

export async function recordLoginFailure(
  db: DB,
  loginFailed: number,
  lockoutUntil: string | null
): Promise<void> {
  await db
    .prepare('UPDATE admin SET login_failed = ?, lockout_until = ? WHERE id = 1')
    .bind(loginFailed, lockoutUntil)
    .run();
}

export async function resetLoginFailures(db: DB): Promise<void> {
  await db.prepare('UPDATE admin SET login_failed = 0, lockout_until = NULL WHERE id = 1').run();
}

export async function updateAdminPassword(db: DB, passwordHash: string): Promise<void> {
  await db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').bind(passwordHash).run();
}

export async function updateAdminUsername(db: DB, username: string): Promise<void> {
  await db.prepare('UPDATE admin SET username = ? WHERE id = 1').bind(username).run();
}
