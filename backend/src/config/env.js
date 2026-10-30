/**
 * 环境变量装载（叶子模块）
 *
 * 只做一件事：按 NODE_ENV 选 `.env.production` / `.env` 并交给 dotenv。
 * 单独成模块的原因是这件事原本埋在 `config/app.js` 的模块体里——
 * 于是「想读一个日志目录」也得把整个应用配置装配跑一遍
 * （包括 JWT_SECRET / JWT_EXPIRES_IN 的启动期校验，那两个是会 throw 的）。
 *
 * Node 的 require 缓存保证 dotenv 每进程只执行一次，
 * 谁先被 require 谁触发装载，读取顺序与拆分前一致。
 * dotenv 默认不覆盖已存在的 `process.env`，所以测试里先设后引仍然生效。
 */

const path = require('path')
const dotenv = require('dotenv')

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'

dotenv.config({ path: path.join(__dirname, '../../', envFile) })
