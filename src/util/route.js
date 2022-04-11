/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

/**
 * 生成 route
 * 首先获取自定义序列化 queryString 的方法
 * 对 query 进行深拷贝, 避免相互影响
 * 生成新的 route 对象
 * 如果是从其他路由重定向过来的, 则生成完整的重定向来源地址, 并赋值给新的 route 对象
 * 最后调用 Object.freeze 冻结对象, 因为 Route 对象是 immutable 的
 * @param {*} record 
 * @param {*} location 
 * @param {*} redirectedFrom 
 * @param {*} router 
 * @returns 
 */
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  // 支持传入自定义序列化 qs 方法
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    // Location.query 为引用至, 避免相互影响, 进行深拷贝
    query = clone(query)
  } catch (e) {}

  // 生成 route
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  }
  // 如果来源是重定向
  if (redirectedFrom) {
    // 生成完整的重定向来源地址赋值给 route
    route.redirectedFrom = /* 生成完整路径 */getFullPath(redirectedFrom, stringifyQuery)
  }
  // 冻结 route
  return Object.freeze(route)
}

function clone (value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {}
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
export const START = createRoute(null, {
  path: '/'
})

// 格式化匹配的路由记录, 当一个路由记录匹配了, 如果还有父路由记录, 则父路由记录肯定也是匹配的
// /foo/bar 匹配了, 则其父路由对象 /foo 肯定也匹配到了
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    // 队列头添加, 所以父 recored 永远在前面, 当前 record 永远在后面, 在 router-view 组件中获取匹配的 route-record 时会用到
    res.unshift(record)
    record = record.parent
  }
  return res
}

// 获取完整路径
function getFullPath (
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

// 是否相同 route
export function isSameRoute (a: Route, b: ?Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    // path 都存在, 比较 path, hash query 是否相同
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    // name 都存在, 比较 name, hash, query, params 是否相同
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

function isObjectEqual (a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
