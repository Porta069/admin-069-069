/**
 * Server-side helpers to read DataTable URL state from searchParams.
 * Sort keys MUST be mapped through an allowlist before touching SQL.
 */

export interface TableParams {
  page: number;
  pageSize: number;
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function readTableParams(
  searchParams: SearchParams,
  defaults: Partial<Pick<TableParams, "pageSize" | "sort" | "dir">> = {},
): TableParams {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const page = Math.max(1, Number(first(searchParams.page)) || 1);
  const pageSize = Math.min(
    100,
    Math.max(10, Number(first(searchParams.size)) || defaults.pageSize || 25),
  );
  const q = (first(searchParams.q) ?? "").trim().slice(0, 200);
  const sort = first(searchParams.sort) ?? defaults.sort ?? null;
  const dir =
    (first(searchParams.dir) ?? defaults.dir) === "asc" ? "asc" : "desc";

  return { page, pageSize, q, sort, dir };
}

/** Resolve a sort key through an allowlist — unknown keys fall back. */
export function safeSort(
  sort: string | null,
  allowed: Record<string, string>,
  fallback: string,
): string {
  if (sort && allowed[sort]) return allowed[sort];
  return fallback;
}

export function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
