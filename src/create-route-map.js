/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/**
 * 创建路由映射 map, 添加路由记录
 * pathList 中存储了 routes 中的所有 path
 * pathMap 维护的是 path 和 路由记录 RouteRecord 的映射
 * nameMap 维护的是 name 和 路由记录 RouteRecord 的映射
 *  因为 VurRouter 支持命名路由
 * @param {*} routes 
 * @param {*} oldPathList 
 * @param {*} oldPathMap 
 * @param {*} oldNameMap 
 * @returns { pathList, pathMap, nameMap }
 */
export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // the path list is used to control path matching priority
  // 若旧的路由相关映射列表及 map 存在, 则使用旧的初始化(借此实现添加路由功能)
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // 遍历路由配置对象, 生成/添加路由记录
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  // 却表 path:* 永远在最后
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  // 提示非嵌套路由的 path 必须以 / 或者 * 开头
  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

// 添加路由记录, 更新 pathList, pathMap, nameMap
function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,   // 父路由时记录
  matchAs?: String        // 处理别名路由时使用
) {
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    // route.path 不能为空
    assert(path != null, `"path" is required in a route configuration.`)
    // route.component 不能为 string
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {}
    // 生成格式化后的 path(子路由会拼接上父路由的path)
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

  // 匹配规则是否大小写敏感
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 每一条路由规则都会生成一条路由记录. 嵌套, 别名路由也都会生成一条路由记录. 是路由映射表的组成部分
  const record: RouteRecord = {
    path: normalizedPath,                                           // 常规化路径
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),  // 利用 path-to-regexp 包生成用来匹配 path 的增强正则对象, 可以用来匹配动态路由
    components: route.components || { default: route.component },   // 保存路由组件, 支持命名视图https://router.vuejs.org/zh/guide/essentials/named-views.html#命名视图
    instances: {},                                                  // 保存每个命名router-view需要渲染的路由组件
    name,
    parent,
    matchAs,                                                        // 匹配别名
    redirect: route.redirect,                                       // 重定向的路由配置对象
    beforeEnter: route.beforeEnter,                                 // 路由独享的守卫你
    meta: route.meta || {},                                         // 元信息
    props:                                                          // 动态路由传参
      route.props == null
        ? {}
        : route.components                                          // 命名视图的传参会泽需要使用 route.props 指定的规则
          ? route.props
          : { default: route.props }
  }

  // 处理子路由情况
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    // 命名路由 && 未使用重定向 && 子路由配置对象 path 为 '' 或 / 时, 使用父路由的 name 跳转子路由将不会被渲染
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        )
      }
    }
    // 遍历生成子路由记录
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // 若 pathMap 中不存在当前路径, 则更新 pathList 和 pathMap
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  // 处理别名
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      // alias 的值和 path 重复, 提示
      if (process.env.NODE_ENV !== 'production' && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }

      // 生成别名路由配置对象
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      // 添加别名路由记录
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute, // 别名路由
        parent,     // 当前路由的副路由, 因为是给当前路由取了个别名, 所以二者其实是有同个父路由的
        record.path || '/' // matchAs, 用来生成别名路由的子路由
      )
      // !总结: 当前路由设置了 alias 后, 会单独为当前路由及其子路由生成路由记录, 且子路由的 path 前缀为 matchAs(即别名路由的 path)
    }
  }

  // 处理命名路由
  if (name) {
    // 更新 nameMap
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      // 路由重名警告
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, '')
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}
