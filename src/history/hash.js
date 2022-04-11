/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

/**
 * 继承父类 History
 * 检查了 fallback, 是否需要回退, 传入的 fallback 只有在用户设置了 history && 又不支持 pushstate && 启用了回退时才为 true
 * 如果 fallback 为 true, 则通过 checkFallback 将 history 模式的 url 替换成 hash 模式, 即加上 #
 * 如果 fallback 为 false, 则直接调用 ensureSlash, 确保 url 是以 / 开头的
 * 
 * 
 * hashHistory 少了滚动支持和监听 hashChange 相关逻辑 这是因为 hashChange 存在一些特殊场景, 需要等到 mounted 后才能监听
 *  - 这一块的逻辑全放在了 setupListeners 方法中, setupListeners 会在 VueRouter 调用 init 时 被调用
 */
export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    // 实例化父类
    super(router, base)
    // check history fallback deeplinking
    // 如果需要回退, 则将 url 换为 hash 模式(/#开头)
    // this.base 来自父类
    if (fallback && checkFallback(this.base)) {
      return
    }
    // 确保 url 是以 / 开头的
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  // 如果钩子函数 beforeEnter 是异步的话, beforeEnter 钩子就会被触发两次, 因为在初始化时, 如果此时的 hash 值不是以 / 开头的话就会补上 #/, 这个过程会触发 hashChange 事件, 就会再走一次声明周期钩子, 也就意味着会再次调用 beforeEnter 钩子函数
  setupListeners () {
    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    window.addEventListener(
      supportsPushState ? 'popstate' : 'hashchange',
      () => {
        const current = this.current
        if (!ensureSlash()) {
          return
        }
        this.transitionTo(getHash(), route => {
          if (supportsScroll) {
            handleScroll(this.router, route, current, true)
          }
          if (!supportsPushState) {
            replaceHash(route.fullPath)
          }
        })
      }
    )
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) {
    window.history.go(n)
  }

  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  getCurrentLocation () {
    return getHash()
  }
}

// 检查回退, 将 url 转换为 hash 模式(添加 /#)
function checkFallback (base) {
  const location = getLocation(base)
  // 地址不以 /# 开头, 则添加
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

// 确保 url 是以 / 开头的
function ensureSlash (): boolean {
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path)
  return false
}

/**
 * 获取 # 之后的内容
 * http://localhost:8080/#/center/test?subjectCode=03&phaseCode=04&hwType=6
 * /center/test?subjectCode=03&phaseCode=04&hwType=6
 * @returns 
 */
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href
  const index = href.indexOf('#')
  // empty path
  if (index < 0) return ''

  href = href.slice(index + 1)
  // decode the hash but not the search or hash
  // as search(query) is already decoded
  // https://github.com/vuejs/vue-router/issues/2708
  // 不 decode qs 和 hash 之后的内容
  const searchIndex = href.indexOf('?')
  if (searchIndex < 0) {
    const hashIndex = href.indexOf('#')
    if (hashIndex > -1) {
      href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
    } else href = decodeURI(href)
  } else {
    href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
  }

  return href
}

function getUrl (path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash (path) {
  if (supportsPushState) {
    pushState(getUrl(path))
  } else {
    window.location.hash = path
  }
}

// 替换 hash 记录
function replaceHash (path) {
  // 支持 pushstate, 则优先使用 replaceState
  if (supportsPushState) {
    replaceState(getUrl(path))
  } else {
    window.location.replace(getUrl(path))
  }
}
