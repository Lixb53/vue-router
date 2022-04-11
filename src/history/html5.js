/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

/**
 * h5History类, 继承父类 History, 在支持 pushstate 的浏览器中使用该类实例化
 * 主要做了一下几件事
 * 1. 调用父类构造函数(super(router, base))
 * 2. 检查了是否支持滚动行为, 如果支持, 则初始化滚动相关逻辑
 * 3. 监听了 popstate 事件, 并在 popstate 事件触发时, 调用 transitionTo 方法实现跳转
 * 注意: 这里处理了一个异常场景
 *  - 某些浏览器下, 页面打开会触发一次 popstate, 此时如果路由组件是异步的, 就会出现 popstate 事件触发了, 但异步组件还没解析完成, 导致 route 没更新
 *  - 所以对这种情况做了屏蔽
 */
export class HTML5History extends History {
  constructor (router: Router, base: ?string) {
    // 初始化父类 History
    super(router, base)

    // 检测是否需要支持 scroll
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    // 若支持 scroll, 初始化 scroll 相关逻辑
    if (supportsScroll) {
      setupScroll()
    }

    // 获取初始 Location
    const initLocation = getLocation(this.base)
    // 监听 popstate 事件
    window.addEventListener('popstate', e => {
      const current = this.current

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      // 某些浏览器会在打开页面时触发一次 popstate
      // 此时如果初始路由是异步路由, 就会出现 popstate 先触发, 初始路由后解析完成, 进而导致 route 未更新
      // 所以需要避免
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }

      // 路由地址发生变化, 则跳转, 并在跳转后处理滚动
      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go (n: number) {
    window.history.go(n)
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  ensureURL (push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}

export function getLocation (base: string): string {
  let path = decodeURI(window.location.pathname)
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}
