/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

/**
 * 格式化 location
 * 
 * 首先将 string 类型的转换为对象形式, 方便后面统一处理
 * 如果发现地址已经做过格式化处理, 则直接返回
 * 再判断是否是命名路由
 *  - 若是, 则拷贝原始地址 raw, 拷贝 params, 直接返回
 * 处理了仅携带参数的相对路由(相对参数)的跳转, 就是 this.$router.push({ params: { id: 1 } })
 *  - 对这种地址的定义是没有 path ,仅有 params && 当前路由对象存在
 *  - 处理逻辑:
 *    1. 先合并 params
 *    2. 若是命名路由, 则使用 current.name 作为 next.name, 并赋值 params
 *    3. 非命名路由, 从当前路由对象中找到匹配的路由记录, 并取出路由记录上的 path 作为 next-path, 然后填充 params
 *    4. 返回处理好的 地址
 *  - 由于这种跳转方式, 仅有 params, 所以必须从当前路由对象 current 上获取可用字段(path, name), 作为自身值, 然后跳转
 * 处理 path 跳转的方式
 *  - 调用 parsePath 从 path 中解析出 path, query, hash
 *  - 以 current.path 为 basePath, 解析出最终 path
 *  - 对 query 进行合并操作
 *  - 对 hash 进行前追加 # 操作
 *  - 返回带有 _normalized: true 表示的 location 对象
 * @param {*} raw 
 * @param {*} current 
 * @param {*} append 
 * @param {*} router 
 * @returns 带有_normalized: true表示的 Location 类型的对象
 */
export function normalizeLocation (
  // 原始 location, 一个 string 或者 已经格式化的location
  raw: RawLocation,
  // 当前路由对象
  current: ?Route,
  // 是否是追加模式
  append: ?boolean,
  // VueRouter 实例
  router: ?VueRouter
): Location {
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  // 已经格式化过, 直接返回
  if (next._normalized) {
    return next
  } else if (next.name) {
    // 处理命名形式, 例如: { name: 'Home', params: {id: 3} }
    next = extend({}, raw)
    const params = next.params
    if (params && typeof params === 'object') {
      next.params = extend({}, params)
    }
    return next
  }

  // relative params
  // 处理相对参数形式跳转   例如: this.$router.push({ params: { id: 1 } })
  if (!next.path && next.params && current) {
    next = extend({}, next)
    next._normalized = true
    // 提取当前 route 的字段作为 next 的字段, 因为相对参数形式, 只有 params, 必须借助 current 提取一些字段
    const params: any = extend(extend({}, current.params), next.params)
    if (current.name) {
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  const parsedPath = parsePath(next.path || '')
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
