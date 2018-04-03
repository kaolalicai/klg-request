import * as request from 'superagent'
import * as _ from 'lodash'
import {Logger} from 'klg-logger'

const logger = new Logger({
  level: 'info',
  dateformat: 'yyyy-mm-dd HH:MM:ss.L'
})

export interface RequestData {
  userId: string,
  requestId: string,
  currentAttempt?: number,
  url: string,
  interfaceName?: string,
  server?: string,
  body: object,
  options?: {
    accept: string,
    postType: string,
    headers?: object,
    httpMethod: string
  }
}

type HandleFunBefore = (data: RequestData) => Promise<RequestData>
type HandleFunAfter = (data: any) => Promise<any>

export interface RequestConfig {
  retryWhen500?: boolean
  retryWhenTimeout?: boolean
  retryWhenConnectError?: boolean
  timeOut?: number
  afterSend?: HandleFunAfter
  beforeSend?: HandleFunBefore
}

type ResponseData = { err: string, status: string } & object

export class Request {
  private config: RequestConfig

  constructor (config?: RequestConfig) {
    // 默认配置
    this.config = {
      timeOut: 60000,
      retryWhen500: true,
      retryWhenTimeout: false,
      retryWhenConnectError: true
    }
    Object.assign(this.config, config)
    // if (config) {
    //   if (config.timeOut !== undefined) this.config.timeOut = config.timeOut
    //   if (config.retryWhen500 !== undefined) this.config.retryWhen500 = config.retryWhen500
    //   if (config.retryWhenTimeout !== undefined) this.config.retryWhenTimeout = config.retryWhenTimeout
    //   if (config.retryWhenConnectError !== undefined) this.config.retryWhenConnectError = config.retryWhenConnectError
    // }
  }

  async sendData (data: RequestData): Promise<ResponseData> {
    if (this.config.beforeSend) {
      data = await this.config.beforeSend(data)
    }
    let {url, interfaceName, server, body, options} = data
    if (!interfaceName) {
      interfaceName = _.last(url.split('/'))
    }
    let res = null
    let response = null
    let httpMethod = options.httpMethod
    try {
      logger.info(`request[${httpMethod}] to ${url}`)
      res = await request[httpMethod](url)
        .type(options.postType)
        .timeout(this.config.timeOut)
        .send(body)
        .set('Accept', options.accept)
        .set(options.headers || {})
      response = JSON.parse(res.text)
    } catch (err) {
      logger.error('request err', url || interfaceName || server || 'none', err.message)
      response = {err: err.message, status: err.status}
    }
    if (this.config.afterSend) {
      response = await this.config.afterSend(response)
    }
    return response
  }

  async sendDataRetry (data: RequestData, limit = 5) {
    let res = await this.sendData(data)
    if (this.shouldRetry(res)) {
      // 递归的出口
      if (limit <= 1) return res
      data.currentAttempt = (data.currentAttempt || 1) + 1
      return await this.sendDataRetry(data, --limit)
    }
    return res
  }

  shouldRetry (res) {
    if (!res || !res.err) return false
    const config = this.config
    return Boolean(shouldRetryConnectError(res.err) || shouldRetryStatus500(res) || shouldRetryTimeOut(res.err))

    function shouldRetryConnectError (err) {
      return config.retryWhenConnectError && (
        ~err.indexOf('getaddrinfo ENOTFOUND') ||
        ~err.indexOf('connect ECONNREFUSED') ||
        ~err.indexOf('connect ETIMEDOUT') ||
        ~err.indexOf('read ECONNRESET')
      )
    }

    function shouldRetryStatus500 (res) {
      return config.retryWhen500 && (res.status === 500 || res.status === '500')
    }

    function shouldRetryTimeOut (err) {
      return config.retryWhenTimeout && (
        ~err.indexOf('timeout') ||
        ~err.indexOf('Timeout')
      )
    }
  }

  async postJSON (data: RequestData) {
    data.options = data.options || {
      accept: 'application/json',
      postType: 'json',
      httpMethod: 'post'
    }
    return await this.sendDataRetry(data)
  }

  async putJSON (data: RequestData) {
    data.options = data.options || {
      accept: 'application/json',
      postType: 'json',
      httpMethod: 'put'
    }
    return await this.sendDataRetry(data)
  }
}
