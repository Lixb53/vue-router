/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

// Matcher 工厂函数
export function createMatcher (
  // 路由配置列表
  routes: Array<RouteConfig>,
  // VueRouter 实例
  router: VueRouter
): Matcher {
  // 创建路由映射表
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  // 添加路由
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  // 传入 Location, 返回匹配的 Route 对象
  /**
   * 对传入的 url 地址, 进行格式化(规范化)
   * 取出格式化地址中的 name
   * name 存在, 判断是否通过 name 在 nameMap 中找到对应的路由记录 RouteCord
   *  - 无法找到, 创建一个新的 route 返回
   *  - 可以找到, 则填充 params, 并使用此路由记录创建一个新的 Route 对象返回
   * name 不存在, 则判断 path 是否存在
   *  - 存在, 则利用 pathList, pathMap 调用 watchRoute 判断是否匹配, 进而找到匹配的路由记录, 然后使用此路由记录创建新 route 对象返回
   * name 和 path 都不存在, 则直接创建一个新 route 返回
   * @param {*} raw 
   * @param {*} currentRoute 
   * @param {*} redirectedFrom 
   * @returns 
   */
  function match (
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    // 常规化 location 主要将 string 常规化
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    // 通过 name 匹配
    if (name) {
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 未找到路由记录, 直接返回一个空的 route
      if (!record) return _createRoute(null, location)
      // 获取动态路由参数名
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      // 获取当前 route 中符合动态路由参数名的值赋值给 location
      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      // 填充 params, 主要通过 参数 生成 url
      location.path = fillParams(record.path, location.params, `named route "${name}"`)
      // 创建 route
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {}
      // 遍历 pathList, 找到能匹配到的记录, 生成 route
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

  /**
   * 创建重定向 route
   *    - 首先对 record.redirect 进行规范化, 统一生成一个 redirect 对象(因为 redirect 支持多种形式, 所以需要进行 规范化)
   *    - 优先取 redirect 的 query hash params 值来做 match, 不存在时才会取 初始地址 locatioin 的 query hash params
   *    - 接下来会判断重定向目标是 命名形式 还是 path 形式
   *    - 命名形式:
   *      - 先判断 nameMap 中有没有目标路由记录, 没有则中断, 并给予提示
   *      - 再重走 match 流程, 并将 location 作为 redirectedFrom 传入, 这样就完成了 redirectedFrom 的传递闭环
   *      - match 里面会继续判断是否有重定向, 这样就覆盖了多重重定向的场景
   *    - path 形式:
   *      - 拿 path 匹配, 需要获取完整路径, 所以先从 record 拿出原始路径 rawPath 并填充前面解析出的 params 得出完整路径
   *      - 再拿完整路径重走 match 流程, 同时也将 location 作为 redirectFrom 传入, 完成 redirectedFrom 的传递闭环
   *    - 如果既不是 命名形式, 也不是 path 形式, 则直接创建一个新路由对象返回
   * @param {*} record 触发重定向的路由记录(需要进行重定向的路由记录, 包含 redirect)
   * @param {*} location 触发重定向的初始地址
   * @returns 
   */
  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    // 原始重定向
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    // originalRedirect 函数返回的是一个 !string | !object 的值时, 警告, 并创建一个空 route
    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params
    
    // 重定向时命名路由形式
    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {    // 重定向是 path 形式
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  /**
   * 创建别名路由
   * 
   * 1. 先拿 matchAs 得到 aliasedPath
   * 2. 拿 aliasedPath 再走一遍 match 得到 aliasedMatch 路由对象
   * 3. aliasedMatch 如果存在, 拿 aliasedMatch 精准匹配的 路由记录对象 和 location, 生成路由对象返回
   * 4. 不存在, 则创建一个新的 路由对象 返回
   * @param {*} record 
   * @param {*} location 
   * @param {*} matchAs 
   * @returns 
   */
  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    // 获取别名的完整路径
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    // 获取别名匹配的原始 route
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  /**
   * 
   * @param {*} record 用来生成 Route 对象的目标路由记录
   * @param {*} location 目标地址
   * @param {*} redirectedFrom 重定向的来源地址, 这个参数只在发生重定向时才有值
   * @returns route 对象
   */
  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    // 路由记录栈被标记为 重定向
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    // 路由记录栈被标记为别名路由
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    // 正常路由记录
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}

/**
 * 地址是否匹配
 * 首先调用 path.match(regexp)
 * 无法匹配则直接返回 false
 * 可以匹配 && !params 则返回 true
 * 可以匹配 && params 存在, 此时需要对 params 进行正确赋值
 *  - 整个赋值主要遍历 path.match(regexp) 返回值并取出 regepx 中存储的 key, 然后依次赋值
 * ** 赋值时的 pathMatch 是什么
 *  -- pathMatch会代表通配符匹配到的路径
 * @param {*} regex 
 * @param {*} path 
 * @param {*} params 
 * @returns boolean
 */
function matchRoute (
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  const m = path.match(regex)

  if (!m) {
    // 无法匹配
    return false
  } else if (!params) {
    // 符合正则 && params 不存在, 表示可以匹配
    return true
  }

  /**
   * 符合正则 && params 存在, 需要对 params 进行正确赋值
   * path-to-regexp 会将每个动态路由标记处理成正则的一个组
   * 所以 i 从 1 开始
   */
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
