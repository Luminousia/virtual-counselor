/**
 * CloudBase JS SDK 客户端
 * 生产环境下通过 SDK 调用云函数，绕过 CORS 限制
 */

import cloudbase from '@cloudbase/js-sdk'

let _app: ReturnType<typeof cloudbase.init> | null = null
let _authReady: Promise<void> | null = null

function getApp() {
  const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID as string | undefined
  if (!envId) return null
  if (!_app) {
    _app = cloudbase.init({ env: envId })
  }
  return _app
}

async function ensureAuth(): Promise<void> {
  const app = getApp()
  if (!app) return
  if (_authReady) return _authReady

  _authReady = (async () => {
    try {
      const auth = app.auth({ persistence: 'session' })
      const loginState = await auth.getLoginState()
      if (!loginState) {
        await auth.anonymousAuthProvider().signIn()
      }
    } catch (e) {
      console.warn('[CloudBase] 匿名登录失败，将回退到 HTTP 直调', e)
      _authReady = null
    }
  })()

  return _authReady
}

export interface CallFunctionResult<T = unknown> {
  result: T
  requestId?: string
}

/** 调用云函数；若未配置 envId 则返回 null（调用方回退到 HTTP） */
export async function callCloudFunction<T = unknown>(
  name: string,
  data: Record<string, unknown>
): Promise<T | null> {
  const app = getApp()
  if (!app) return null

  try {
    await ensureAuth()
    const res = (await app.callFunction({ name, data })) as CallFunctionResult<T>
    return res.result
  } catch (e) {
    console.error(`[CloudBase] callFunction(${name}) 失败:`, e)
    return null
  }
}

/** 当前是否处于 CloudBase 生产环境（VITE_CLOUDBASE_ENV_ID 已注入） */
export function isCloudBaseEnv(): boolean {
  return !!(import.meta.env.PROD && (import.meta.env.VITE_CLOUDBASE_ENV_ID as string | undefined))
}
