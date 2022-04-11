/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
// 缓存
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

/**
 * 填充动态路由参数, 可以看做是 matchRoute 的逆操作, 是一个借助动态路径, 使用参数生成 url 的过程
 * 例如: 将 user/:id + { id: 123 } => user/123
 * 整个逆解析的逻辑是借助 regexp.compile 结合 regexpCompileCache 实现
 * regexp.compile 接收一个 动态路由 path, 返回一个函数, 可以用这个函数做逆解析
 * 例如: const toPath = Regexp.compile('/user/:id'); toPath({id:123}) => '/user/123'
 * 
 * 整个流程如下:
 *  首先对 regexp.compile() 返回的函数做了缓存
 *  然后将 matchRoute 中添加的 pathMatch 赋值给 param[0]
 *  调用 regexp.compile 返回函数, 以 params 为入参, 逆解析 url 并返回
 *  最终删除 params[0]
 * @param {*} path 
 * @param {*} params 
 * @param {*} routeMsg 
 * @returns 
 */
export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  params = params || {}
  try {
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // and fix #3106 so that you can work with location descriptor object having params.pathMatch equal to empty string
    if (typeof params.pathMatch === 'string') params[0] = params.pathMatch

    return filler(params, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // Fix #3072 no warn if `pathMatch` is string
      warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  } finally {
    // delete the 0 if it was added
    delete params[0]
  }
}
