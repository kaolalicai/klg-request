import * as request from 'superagent'
import * as _ from 'lodash'
import {Logger} from 'klg-logger'
import {Retry} from 'klg-retry'

const logger = new Logger({
  level: 'info',
  dateformat: 'yyyy-mm-dd HH:MM:ss.L'
})

export interface RequestData {
  interfaceName?: string,
  server?: string,
  query?: object,
  body?: object,
  options?: {
    accept: string,
    postType?: string,
    headers?: object,
    httpMethod: string
  }
}

export type HandleFunBefore = (data: RequestData) => Promise<RequestData>
export type HandleFunAfter = (data: any) => Promise<any>

export interface RequestConfig {
  retries?: number
  factor?: number
  minTimeout?: number
  retryWhen50x?: boolean
  retryWhenTimeout?: boolean
  retryWhenConnectError?: boolean
  timeOut?: number
  afterSend?: HandleFunAfter
  beforeSend?: HandleFunBefore
}

export type ResponseData = { err: string, status: string } & object

const HTTP_METHOD = {
  POST: 'post',
  GET: 'get',
  PUT: 'put'
}

export class Request {
  private config: RequestConfig
  private retry: Retry

  constructor (config?: RequestConfig) {
    // 默认配置
    this.config = {
      retries: 4,
      factor: 2,
      minTimeout: 1000,
      timeOut: 60000,
      retryWhen50x: true,
      retryWhenTimeout: false,
      retryWhenConnectError: true
    }
    Object.assign(this.config, config)
    this.retry = new Retry()
  }

  async sendData (url, data: RequestData): Promise<ResponseData> {
    if (this.config.beforeSend) {
      data = await this.config.beforeSend(data)
    }
    let {interfaceName, server, body, query, options} = data
    if (!interfaceName) {
      interfaceName = _.last(url.split('/'))
    }
    let response = null
    let httpMethod = options.httpMethod
    try {
      logger.info(`request[${httpMethod}] to ${url}`)
      let operate
      if (httpMethod === HTTP_METHOD.POST || httpMethod === HTTP_METHOD.PUT) {
        operate = request[httpMethod](url)
          .type(options.postType || '')
          .send(body)
      }
      if (httpMethod === HTTP_METHOD.GET) {
        operate = request.get(url).query(query)
      }
      const res = await operate
        .timeout(this.config.timeOut)
        .set('Accept', options.accept)
        .set(options.headers || {})
      response = JSON.parse(res.text)
    } catch (err) {
      logger.info('request err', url || interfaceName || server || 'none', err.message)
      logger.info('request err', err.stack)
      response = {err: err.message, status: err.status}
    }
    if (this.config.afterSend) {
      response = await this.config.afterSend(response)
    }
    return response
  }

  async sendDataRetry (url, data: RequestData) {
    let res: ResponseData = null
    try {
      await this.retry.using(async () => {
        res = await this.sendData(url, data)
        if (this.shouldRetry(res)) throw new Error('need retry')
      }, this.config)
    } catch (e) {
      logger.info('重试超过最大次数 exit')
    } finally {
      return res
    }
  }

  shouldRetry (res) {
    if (!res || !res.err) return false
    const config = this.config
    return Boolean(shouldRetryConnectError(res.err) || shouldRetryStatus50x(res) || shouldRetryTimeOut(res.err))

    function shouldRetryConnectError (err) {
      return config.retryWhenConnectError && (
        ~err.indexOf('getaddrinfo ENOTFOUND') ||
        ~err.indexOf('connect ECONNREFUSED') ||
        ~err.indexOf('connect ETIMEDOUT') ||
        ~err.indexOf('read ECONNRESET')
      )
    }

    function shouldRetryStatus50x (res) {
      return config.retryWhen50x && res.status && (res.status.toString().match(/5\d{2}/))
    }

    function shouldRetryTimeOut (err) {
      return config.retryWhenTimeout && (
        ~err.indexOf('timeout') ||
        ~err.indexOf('Timeout')
      )
    }
  }

  async get (url, data: RequestData) {
    data.options = data.options || {} as any
    Object.assign(data.options, {
      accept: 'application/json',
      httpMethod: HTTP_METHOD.GET
    })
    return await this.sendDataRetry(url, data)
  }

  async post (url, data: RequestData) {
    data.options = data.options || {} as any
    Object.assign(data.options, {
      accept: 'application/json',
      postType: 'json',
      httpMethod: HTTP_METHOD.POST
    })
    return await this.sendDataRetry(url, data)
  }

  async put (url, data: RequestData) {
    data.options = data.options || {} as any
    Object.assign(data.options, {
      accept: 'application/json',
      postType: 'json',
      httpMethod: HTTP_METHOD.PUT
    })
    return await this.sendDataRetry(url, data)
  }
}
