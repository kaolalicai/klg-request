import * as assert from 'power-assert'
import * as nock from 'nock'
import {Request} from './Request'

// jest.mock('./Request')

describe('Request test', async function () {
  const host = 'http://www.example.com'
  const body = {
    a: 1,
    b: 'bbbbb'
  }
  const userId = 'uddd12'
  const requestId = 'abc123456'
  const data = {
    url: host + '/test',
    body,
    userId,
    requestId
  }

  describe('上层方法能正常调用', async function () {
    it(' 完整 post 流程 ', async () => {
      const fakeResult = {
        code: 0,
        msg: 'ok'
      }
      const request = new Request()
      nock(host).post('/test', body).reply(200, function (uri, requestBody) {
        console.log('aaaaaaaaaa', requestBody, uri)
        assert.equal(uri, '/test')
        assert.deepEqual(JSON.parse(requestBody), body)
        return fakeResult
      })

      const res = await request.postJSON(data)
      assert.deepEqual(res, fakeResult)
    })

    it(' postJSON ', async () => {
      const request = new Request()
      const spy = jest.spyOn(request, 'sendDataRetry')
      await request.postJSON(data)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(Object.assign(data, {
        options: {
          accept: 'application/json',
          postType: 'json',
          httpMethod: 'post'
        }
      }))
      spy.mockClear()
    })

    it(' putJSON ', async () => {
      const request = new Request()
      const spy = jest.spyOn(request, 'sendDataRetry')
      await request.postJSON(data)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(Object.assign(data, {
        options: {
          accept: 'application/json',
          postType: 'json',
          httpMethod: 'put'
        }
      }))
      spy.mockClear()
    })
  })

  describe('retry', async function () {
    const request = new Request()
    const spy = jest.spyOn(request, 'sendDataRetry')
    it(' retry by connect err ', async () => {
      const data = {
        url: 'http://www.cantconnecttothis.addres' + '/test',
        body,
        userId,
        requestId
      }
      const res = await request.postJSON(data)
      expect(res.err.includes('getaddrinfo ENOTFOUND'))
      expect(spy).toHaveBeenCalledTimes(5)
    })

    it(' retry by timeout ', async () => {
      // 将超时时间调小
      const request = new Request({timeOut: 10, retryWhenTimeout: true})
      const spy = jest.spyOn(request, 'sendDataRetry')

      nock(host)
        .persist()
        .post('/test', body)
        .delayConnection(2000) // 2 seconds
        .reply(200, {code: 0, msg: 'ok'})

      const res = await request.postJSON(data)

      expect(res.err).toBe('Timeout of 10ms exceeded')
      expect(res.status).toBe(undefined)
      expect(spy).toHaveBeenCalledTimes(5)

      nock.cleanAll()
    })

    it(' retry by status 500 ', async () => {
      const request = new Request()
      const spy = jest.spyOn(request, 'sendDataRetry')

      nock(host)
        .persist()
        .post('/test', body)
        .reply(500, {err: '内部错误'})

      const res = await request.postJSON(data)

      expect(res.err).toBe('Internal Server Error')
      expect(res.status).toBe(500)
      expect(spy).toHaveBeenCalledTimes(5)

      nock.cleanAll()
    })
  })

  describe('各类参数', async function () {
    it(' sendData 会自动补齐 interfaceName 参数 ', async () => {
    })

    it(' sendData 会自动补齐 interfaceName 参数 ', async () => {
    })

    it(' afterSend 可以生效 ', async () => {
    })

    it(' beforeSend 可以生效 ', async () => {
    })

    it(' timeOut 可以生效 ', async () => {
    })
    it(' retryWhen500 可以生效 ', async () => {
    })
    it(' retryWhenTimeout 可以生效 ', async () => {
    })
    it(' retryWhenENOTFOUND 可以生效 ', async () => {
    })
  })
})
