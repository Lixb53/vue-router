/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError, isExtendedError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import { NavigationDuplicated } from './errors'

// 父类
/**
 * 父类
 * 主要干了下面几件事
 *  1. 保存了 router 实例
 *  2. 规范化了 base, 确保 base 是以 / 开头
 *  3. 初始化了当前路由指向, 默认指向 START 初始路由; 在路由跳转时, this.current 代表的是 from
 *  4. 初始化了路由跳转时的下个路由, 默认为 null, 在路由跳转时, this.pending 代表的是 to
 *  5. 初始化了一些回调相关的属性
 */
export class History {
  router: Router
  base: string
  current: Route
  pending: ?Route
  cb: (r: Route) => void
  ready: boolean
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>

  // implemented by sub-classes
  // 需要子类实现的方法
  +go: (n: number) => void
  +push: (loc: RawLocation) => void
  +replace: (loc: RawLocation) => void
  +ensureURL: (push?: boolean) => void
  +getCurrentLocation: () => string

  constructor (router: Router, base: ?string) {
    this.router = router
    // 格式化 base, 保证 base 是以 / 开头
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"

    // 当前指向的 route 对象, 默认为 START, 即 from
    this.current = START
    // 记录将要跳转的 route, 即 to
    this.pending = null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
  }

  // 设置监听器, 在 updateRoute 时回调被调用
  listen (cb: Function) {
    this.cb = cb
  }

  // 注册 ready 回调
  onReady (cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  // 注册 error 回调
  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }

  // 路由跳转
  transitionTo (
    // 原始 Location, 一个 url 或者是一个 Location interface(自定义)
    location: RawLocation,
    // 跳转成功回调
    onComplete?: Function,
    // 跳转失败回调
    onAbort?: Function
  ) {
    // 传入需要跳转的 location 和当前路由对象, 返回 to 的 Route
    const route = this.router.match(location, this.current)
    // 确认跳转
    this.confirmTransition(
      route,
      () => {   // onComplete 完成
        // 更新route, 会触发 afterEach 钩子
        this.updateRoute(route)
        // 调用 onComplete 回调
        onComplete && onComplete(route)
        // 确认 url 是以 / 开头
        this.ensureURL()

        // fire ready cbs once
        // 触发 ready 回调
        if (!this.ready) {
          this.ready = true
          this.readyCbs.forEach(cb => {
            cb(route)
          })
        }
      },
      err => {
        if (onAbort) {
          onAbort(err)
        }
        if (err && !this.ready) {
          this.ready = true
          this.readyErrorCbs.forEach(cb => {
            cb(err)
          })
        }
      }
    )
  }

  // 确认路由跳转
  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    // 取消
    const abort = err => {
      // after merging https://github.com/vuejs/vue-router/pull/2771 we
      // When the user navigates through history through back/forward buttons
      // we do not want to throw the error. We only throw it if directly calling
      // push/replace. That's why it's not included in isError
      if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err)
          })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    // 相同 route 报重复错误
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      // 防止 route map 被动态改变了
      route.matched.length === current.matched.length
    ) {
      // ensureURL 由子类实现, 主要根据传参确定是添加还是替换一个记录
      this.ensureURL()
      return abort(new NavigationDuplicated(route))
    }

    // 对比前后 route 的 RouteRecord, 找出需要更新, 失活, 激活的路由记录
    const { updated, deactivated, activated } = resolveQueue(
      this.current.matched,
      route.matched
    )

    // 生成需要执行的守卫, 钩子队列
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      // 提取路由组件中所有 beforeRouteLeave 守卫
      extractLeaveGuards(deactivated),
      // global before hooks
      // 全局的 beforeEach 守卫
      this.router.beforeHooks,
      // in-component update hooks
      // 提取路由组件中所有 beforeRouteUpdate 守卫
      extractUpdateHooks(updated),
      // in-config enter guards
      // 路由独享的 beforeEnter 守卫
      activated.map(m => m.beforeEnter),
      // async components
      // 解析异步组件
      resolveAsyncComponents(activated)
    )

    // 记录将要跳转的 route, 方便取消对比用
    this.pending = route
    // 迭代函数
    const iterator = (hook: NavigationGuard, next) => {
      // 当发现 to 发生变化, 则代表需要取消
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            // 取消跳转, 添加一个新历史记录(但由于 url 地址为发生变化, 所以并未添加记录)
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    // 执行队列
    runQueue(queue, iterator, /* 执行结束回调 */() => {
      // 保存 beforeRouteEnter 中传给 next 的回调函数
      const postEnterCbs = []
      // 表示跳转结束
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      // 等待异步组件解析完毕后, 再抽取组件内的 beforeRouteEnter 守卫
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, /* 执行结束回调 */() => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        // 执行 onComplete 回到, onComplete 中会调用 updateRoute 方法, 内部会触发 afterEach 钩子
        onComplete(route)
        if (this.router.app) {
          // 调用 beforeRouteEnter 守卫中传给 next 的回调函数
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
              cb()
            })
          })
        }
      })
    })
  }

  // 更新路由, 触发 afterEach 钩子
  updateRoute (route: Route) {
    const prev = this.current
    // 更新 current
    this.current = route
    // 调用 updateRoute 回调, 回调中会重新为 _routerRoot._route 赋值, 进而触发 router-view 的重新渲染
    this.cb && this.cb(route)
    // 触发 afterEach 钩子
    this.router.afterHooks.forEach(hook => {
      hook && hook(/* to */route, /* from */prev)
    })
  }
}

// 格式化 base, 保证 base 地址是以 / 开头, 尾部无 /
function normalizeBase (base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

// 对比 current, next的路由记录列表, 找出需要更新, 失活, 激活的路由记录
function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  // 找到首个不相等的路由记录索引
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  /**
   * current: [1,2,3]
   * next: [1,2,3,4,5]
   * i 为 3
   * 需要更新的为 [1,2,3]
   * 需要激活的为 [4, 5]
   * 需要失活的为 []
   */
  return {
    // 索引左侧是需要更新的
    updated: next.slice(0, i),
    // 索引右侧是需要激活的
    activated: next.slice(i),
    // 当前索引右侧是需要失活的
    deactivated: current.slice(i)
  }
}

// 提取守卫
function extractGuards (
  records: Array<RouteRecord>,
  // 要提取的守卫名
  name: string,
  // 绑定守卫上下文函数
  bind: Function,
  // 是否需要逆序
  reverse?: boolean
): Array<?Function> {
  const guards = flatMapComponents(records, (/* 路由组件定义 */def, /* router-view 实例 */instance, /* 路由记录 */match, /* 视图名 */key) => {
    // 提取出路由组件中的守卫函数
    const guard = extractGuard(def, name)
    // 为守卫绑定上下文
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  // 扁平化 + 逆序
  return flatten(reverse ? guards.reverse() : guards)
}

// 提取单个守卫
function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

// 传入路由记录列表, 提取出 beforeRouteLeave 守卫并逆序输出
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

// 传入路由记录列表, 提取出 beforeRouteUpdate 钩子
function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

// 将守卫的上下文绑定到 vue 实例(路由组件)
function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    // 已经绑定过上下文的守卫函数
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

// 提取组件的 beforeROuteEnter 守卫
function extractEnterGuards (
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => {
      // 绑定 beforeRouteEnter 的执行上下文
      return bindEnterGuard(guard, match, key, cbs, isValid)
    }
  )
}

// 绑定 beforeRouteEnter 的执行上下文
function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  // 对组件内的 beforeRouteEnter 进行了包装
  return function routeEnterGuard (to, from, next) {
    // 调用组件内 beforeRouteEnter 守卫
    return guard(to, from, /* beforeRouteEnter next 函数, cb为 next 中回调 */cb => {
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          // 如果 router-view 被 out-in transition 包裹
          // 在确认路由, 准备调用 beforeRouteEnter 守卫时, router-view 实例可能还不存在
          // 但是此时 this.current 已经为 to
          // 所以必须轮训调用 cb 知道 instance 存在
          poll(cb, match.instances, key, isValid)
        })
      }
      next(cb)
    })
  }
}

// 轮训调用 cb
function poll (
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
