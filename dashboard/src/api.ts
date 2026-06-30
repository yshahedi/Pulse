// Thin client for the Pulse API gateway (POST <host>:4001/api).
//
// Requests are kept as CORS "simple requests" — no custom headers and a plain
// body — so the browser never sends a preflight OPTIONS. The auth token rides
// inside the JSON body as `token`; api.js accepts it there as a fallback to the
// x-api-key header. Responses are { ok:true, result } | { ok:false, error }.

import { md5 } from './md5'

const API_KEY = 'pulse_admin_api_base'
const TOK_KEY = 'pulse_admin_token'
const USER_KEY = 'pulse_admin_user'
const UID_KEY = 'pulse_admin_uid'

export function defaultApiBase(): string {
  const host = location.hostname || '127.0.0.1'
  return `http://${host}:4001/api`
}

export function getApiBase(): string {
  return localStorage.getItem(API_KEY) || defaultApiBase()
}
export function setApiBase(v: string) {
  localStorage.setItem(API_KEY, v)
}

export function getToken(): string | null {
  return localStorage.getItem(TOK_KEY)
}
export function getUser(): string | null {
  return localStorage.getItem(USER_KEY)
}
export function getUserId(): number | null {
  const v = localStorage.getItem(UID_KEY)
  return v ? Number(v) : null
}

// Decode the (unverified) JWT payload that base/do_login issues. Authenticity is
// enforced server-side via the user_token_tab lookup; here we only read claims
// like is_admin to decide which panel tabs to show.
function decodeJwtPayload(token: string | null): any | null {
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function getIsAdmin(): boolean {
  const p = decodeJwtPayload(getToken())
  return !!(p && p.is_admin === true)
}
export function isAuthed(): boolean {
  return !!getToken()
}
export function logout() {
  localStorage.removeItem(TOK_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(UID_KEY)
}

export async function apiCall<T = any>(module: string, action: string, data: any = {}): Promise<T> {
  const token = getToken()
  const body = JSON.stringify({ module, action, data, token })
  let res: Response
  try {
    res = await fetch(getApiBase(), { method: 'POST', body })
  } catch (e) {
    throw new Error(`Network error reaching ${getApiBase()} — is Pulse running?`)
  }
  let json: any
  try {
    json = await res.json()
  } catch {
    throw new Error(`Bad response from server (HTTP ${res.status})`)
  }
  if (!json || json.ok !== true) {
    const err = (json && json.error) || `HTTP ${res.status}`
    if (err === 'UNAUTHORIZED') logout()
    throw new Error(err)
  }
  return json.result as T
}

export async function login(username: string, password: string): Promise<void> {
  const result = await apiCall<{ token: string; username: string; user_id: number }>('base', 'do_login', {
    username,
    password: md5(password),
  })
  localStorage.setItem(TOK_KEY, result.token)
  localStorage.setItem(USER_KEY, result.username || username)
  if (result.user_id != null) localStorage.setItem(UID_KEY, String(result.user_id))
}

// Verify a plaintext password for a username by attempting a login. Used to
// confirm the current password before a self-service password change. Throws on
// a bad password; returns silently on success.
export async function verifyPassword(username: string, password: string): Promise<void> {
  await apiCall('base', 'do_login', { username, password: md5(password) })
}

// ── User management (the base module's user_tab) ───────────────────────────────

export interface UserRow {
  id: number
  username: string
  is_admin: number
  status_id_fk: number | null
  last_login_date: number | null
}

export function listUsers(): Promise<ListResult<UserRow>> {
  return apiCall<ListResult<UserRow>>('base', 'get_all', {
    name: 'user_tab', limit: 500, order_fields: ['id'], order_dir: 'ASC',
  })
}

// Create a user. status_id_fk=1 (Active) is required for do_login to accept them.
export function createUser(username: string, password: string, isAdmin: boolean): Promise<number> {
  return apiCall<number>('base', 'add', {
    name: 'user_tab',
    record: { username, password: md5(password), is_admin: isAdmin ? 1 : 0, status_id_fk: 1 },
  })
}

export function setUserPassword(id: number, password: string): Promise<number> {
  return apiCall<number>('base', 'edit', { name: 'user_tab', record: { id, password: md5(password) } })
}

export function setUserActive(id: number, active: boolean): Promise<number> {
  // do_login requires status_id_fk === 1; any other value blocks sign-in.
  return apiCall<number>('base', 'edit', { name: 'user_tab', record: { id, status_id_fk: active ? 1 : 2 } })
}

export function setUserAdmin(id: number, isAdmin: boolean): Promise<number> {
  return apiCall<number>('base', 'edit', { name: 'user_tab', record: { id, is_admin: isAdmin ? 1 : 0 } })
}

export function deleteUser(id: number): Promise<boolean> {
  return apiCall<boolean>('base', 'delete', { name: 'user_tab', id })
}

// ── Convenience CRUD wrappers over the generic admin module ────────────────────

export interface ListResult<T = any> {
  rows: T[]
  total_count: number
}

export function listRows<T = any>(table: string, extra: any = {}): Promise<ListResult<T>> {
  return apiCall<ListResult<T>>('admin', 'get_all', { name: table, limit: 200, order_fields: ['id'], order_dir: 'DESC', ...extra })
}
export function addRow(table: string, record: any): Promise<number> {
  return apiCall<number>('admin', 'add', { name: table, record })
}
export function editRow(table: string, record: any): Promise<number> {
  return apiCall<number>('admin', 'edit', { name: table, record })
}
export function deleteRow(table: string, id: number): Promise<boolean> {
  return apiCall<boolean>('admin', 'delete', { name: table, id })
}
