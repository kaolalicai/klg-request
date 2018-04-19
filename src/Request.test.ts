import * as assert from 'power-assert'
import * as nock from 'nock'
import {Request, RequestData} from './Request'

// jest.mock('./Request')

describe('Request test', async function () {
  const host = 'http://www.example.com'
  const body = {
    a: 1,
    b: 'bbbbb'
  }
  const url = host + '/test'
  const data = {
    body
  }

  afterEach(async function () {
    nock.cleanAll()
  })

  describe('上层方法能正常调用', async function () {
    it(' 完整 post 流程 ', async () => {
      const fakeResult = {
        code: 0,
        msg: 'ok'
      }
      const request = new Request()
      nock(host).post('/test').reply(200, function (uri, requestBody) {
        expect(uri).toEqual('/test')
        expect(JSON.parse(requestBody)).toEqual(body)
        return fakeResult
      })

      const res = await request.post(url, data)
      expect(res).toEqual(fakeResult)
      expect.assertions(3)
    })

    it(' 完整 get 流程 ', async () => {
      const fakeResult = {
        code: 0,
        msg: 'ok'
      }
      const request = new Request()
      nock(host).get('/test').reply(200, fakeResult)

      const res = await request.get(url)
      expect(res).toEqual(fakeResult)
    })

    it(' postJSON ', async () => {
      const request = new Request()
      const spy = jest.spyOn(request, 'sendDataRetry')
      await request.post(url, data)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(url, Object.assign({
        options: {
          accept: 'application/json',
          postType: 'json',
          httpMethod: 'post'
        }
      }, data))
      spy.mockClear()
    })

    it(' putJSON ', async () => {
      const request = new Request()
      const spy = jest.spyOn(request, 'sendDataRetry')
      await request.put(url, data)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(url, Object.assign({
        options: {
          accept: 'application/json',
          postType: 'json',
          httpMethod: 'put'
        }
      }, data))
      spy.mockClear()
    })
  })

  describe('retry', async function () {

    it(' retry by connect err ', async () => {
      const request = new Request({factor: 0, minTimeout: 1})
      const spy = jest.spyOn(request, 'sendData')
      const data = {
        url: 'http://www.cantconnecttothis.addres' + '/test',
        body
      }
      const res = await request.post(data.url, data)
      expect(res.err.includes('getaddrinfo ENOTFOUND'))
      expect(spy).toHaveBeenCalledTimes(5)
    })

    it(' retry by timeout ', async () => {
      nock(host)
        .persist()
        .post('/test', body)
        .delayConnection(2000) // 2 seconds
        .reply(200, {code: 0, msg: 'ok'})

      // 将超时时间调小
      const request = new Request({timeOut: 10, retryWhenTimeout: true, factor: 0, minTimeout: 1})
      const spy = jest.spyOn(request, 'sendData')

      const res = await request.post(url, data)

      expect(res.err).toBe('Timeout of 10ms exceeded')
      expect(res.status).toBe(undefined)
      expect(spy).toHaveBeenCalledTimes(5)
    })

    it(' retry by status 500 ', async () => {
      const request = new Request({factor: 0, minTimeout: 1})
      const spy = jest.spyOn(request, 'sendData')

      nock(host)
        .persist()
        .post('/test', body)
        .reply(500, {err: '内部错误'})

      const res = await request.post(url, data)

      expect(res.err).toBe('Internal Server Error')
      expect(res.status).toBe(500)
      expect(spy).toHaveBeenCalledTimes(5)
    })
  })

  describe('各类参数', async function () {
    it(' sendData 会自动补齐 interfaceName 参数 ', async () => {
      const request = new Request()

      nock(host).post('/test', body).reply(200, function (uri, requestBody) {
        assert.equal(uri, '/test')
        requestBody = JSON.parse(requestBody)
        assert.deepEqual(requestBody, body)
        expect(requestBody.interfaceName).toEqual('test')
        return requestBody
      })

      await request.post(url, data)
    })

    it(' afterSend 可以生效 ', async () => {
      nock(host).post('/test', body).reply(200, {code: 101})

      const request = new Request({
        afterSend: async function (data: any) {
          expect(data)
          expect(data.code).toBe(101)
          return data
        }
      })
      await request.post(url, data)
    })

    it(' beforeSend 可以生效 ', async () => {
      // nock(host).post('/test', body).reply(200, {code: 101})

      const request = new Request({
        retryWhenConnectError: false,
        beforeSend: async function (data: RequestData) {
          expect(data.interfaceName).toBeUndefined()
          expect(data.body).toEqual(body)
          return data
        }
      })
      await request.post(url, data)
      expect.assertions(2)
    })

    it(' timeOut 可以生效 ', async () => {
      // todo
    })
    it(' retryWhen500 可以生效 ', async () => {
      const request1 = new Request()
      expect(request1.shouldRetry({err: 'error', status: 500})).toBeTruthy()
      expect(request1.shouldRetry({err: 'error', status: '500'})).toBeTruthy()
      expect(request1.shouldRetry({status: 200})).toBeFalsy()
      expect(request1.shouldRetry({err: 'error'})).toBeFalsy()

      const request2 = new Request({retryWhen500: false})
      expect(request2.shouldRetry({err: 'error', status: 500})).toBeFalsy()
      expect(request2.shouldRetry({err: 'error', status: '500'})).toBeFalsy()
      expect(request2.shouldRetry({status: 200})).toBeFalsy()
    })
    it(' retryWhenTimeout 可以生效 ', async () => {
      const request1 = new Request({retryWhenTimeout: true})
      expect(request1.shouldRetry({err: 'timeout', status: 500})).toBeTruthy()
      expect(request1.shouldRetry({err: 'Timeout', status: '500'})).toBeTruthy()
      expect(request1.shouldRetry({status: 200})).toBeFalsy()
      expect(request1.shouldRetry({err: 'time'})).toBeFalsy()

      // 默认 false
      const request2 = new Request()
      expect(request2.shouldRetry({err: 'timeout'})).toBeFalsy()
      expect(request2.shouldRetry({err: 'Timeout'})).toBeFalsy()
      expect(request2.shouldRetry({status: 200})).toBeFalsy()
    })
    it(' retryWhenENOTFOUND 可以生效 ', async () => {
      const request1 = new Request()
      expect(request1.shouldRetry({err: 'getaddrinfo ENOTFOUND'})).toBeTruthy()
      expect(request1.shouldRetry({err: 'connect ECONNREFUSED'})).toBeTruthy()
      expect(request1.shouldRetry({err: 'connect ETIMEDOUT'})).toBeTruthy()
      expect(request1.shouldRetry({err: 'read ECONNRESET'})).toBeTruthy()

      expect(request1.shouldRetry({err: 'ENOTFOUND'})).toBeFalsy()
      expect(request1.shouldRetry({err: 'time'})).toBeFalsy()

      const request2 = new Request({retryWhenConnectError: false})
      expect(request2.shouldRetry({err: 'getaddrinfo ENOTFOUND'})).toBeFalsy()
    })
  })
})
