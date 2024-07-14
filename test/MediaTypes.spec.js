'use strict'

const fs = require('node:fs')
const { EventEmitter, errorMonitor } = require('node:events')
const { MIMEType } = require('node:util')

jest.useFakeTimers()
jest.spyOn(global, 'setInterval')

jest.mock('fs')
jest.spyOn(fs, 'readFileSync')
jest.spyOn(fs, 'writeFileSync')

jest.spyOn(global, 'fetch')

beforeEach(() => {
  fs.writeFileSync.mockImplementation(() => true)
  fs.readFileSync.mockImplementation(() => JSON.stringify({
    mediaTypes: {
      txt: ['text/plain']
    },
    versions: {
      apache: 'apache_v0',
      debian: 'debian_v0',
      nginx: 'nginx_v0'
    }
  }))

  fetch.mockImplementation((resource, options) => {
    try {
      if (typeof resource !== 'string') {
        options = resource
        resource = resource.url
      }

      options.method = options.method || 'GET'

      let body = ''
      const status = 200
      let etag = ''

      if (resource.includes('apache')) {
        if (options.method.toUpperCase() === 'GET') {
          body = `
            audio/mpeg          mpga mp2 mp2a mp3 m2a m3a
            image/jpeg          jpeg jpg jpe
            text/plain          txt text conf def list log in
            video/mp4          mp4 mp4v mpg4
          `
        }

        etag = 'apache_v1'
      } else if (resource.includes('debian')) {
        if (options.method.toUpperCase() === 'GET') {
          body = `
            audio/mpeg          mpga mpega mp1 mp2 mp3
            image/jpeg          jpeg jpg jpe jfif
            text/plain          txt text pot brf srt
            video/mp4          mp4 mpg4 m4v
          `
        }

        etag = 'debian_v1'
      } else if (resource.includes('nginx')) {
        if (options.method.toUpperCase() === 'GET') {
          body = `
            types {
              audio/mpeg                                       mp3;
              image/jpeg                                       jpeg jpg;
              text/plain                                       txt;
              video/mp4                                        mp4;
            }
          `
        }

        etag = 'nginx_v1'
      }

      return Promise.resolve(new Response(body, {
        status,
        headers: {
          etag
        }
      }))
    } catch (err) {
      console.error('fetch mock error', err)
    }
  })
})

afterEach(() => {
  setInterval.mockClear()
  fetch.mockClear()
  fs.writeFileSync.mockClear()
  fs.readFileSync.mockClear()
})

const MediaTypes = require('../src/MediaTypes.js')

describe('Constructor', () => {
  test('Given that one wants to instantiate the module with an invalid updateInterval argument', () => {
    ['', 'xyz', false, null, NaN, Infinity, {}, []].forEach(updateInterval => {
      expect(() => new MediaTypes(updateInterval)).toThrow(new TypeError('Invalid updateInterval'))

      const mediaType = new MediaTypes()

      expect(() => {
        mediaType.updateInterval = updateInterval
      }).toThrow(new TypeError('Invalid updateInterval'))
    })
  })

  test('Given that one wants to enable the automatic periodic update', () => {
    setInterval.mockImplementationOnce(jest.fn());

    [0, Number.MAX_SAFE_INTEGER].forEach(updateInterval => {
      expect(() => new MediaTypes(updateInterval)).not.toThrowError()
    })

    expect(setInterval).toHaveBeenCalledTimes(2)
  })

  test('Given you do not want to enable the automatic periodic update', () => {
    [Number.MIN_SAFE_INTEGER, -1].forEach(updateInterval => {
      expect(() => new MediaTypes(updateInterval)).not.toThrowError()
    })

    expect(setInterval).toHaveBeenCalledTimes(0)
  })
})

describe('Attributes', () => {
  test('Given that we want to check the default values of module attributes', () => {
    const mediaType = new MediaTypes()

    expect(mediaType.list).toMatchObject({
      txt: [new MIMEType('text/plain')]
    })

    expect(mediaType.versions).toMatchObject({
      apache: 'apache_v0',
      debian: 'debian_v0',
      nginx: 'nginx_v0'
    })

    expect(mediaType.updateInterval).toBe(86400000)

    expect(setInterval).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 86400000)
  })

  test('Given that we want to check the default values of module attributes when the DB.json file is invalid', () => {
    fs.readFileSync.mockReturnValueOnce('')

    const mediaType = new MediaTypes(-1)

    expect(mediaType.list).toMatchObject({})

    expect(mediaType.versions).toMatchObject({
      apache: '',
      debian: '',
      nginx: ''
    })
  })

  test('Given that we want to update the period of automatic update attempts at runtime', () => {
    const mediaType = new MediaTypes(-1)

    expect(setInterval).toHaveBeenCalledTimes(0)

    mediaType.updateInterval = 1000

    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 1000)

    mediaType.updateInterval = undefined

    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 86400000)

    mediaType.updateInterval = -1

    expect(setInterval).toHaveBeenCalledTimes(2)
  })
})

describe('Methods', () => {
  describe('get', () => {
    test('Given that one wants to get the possible media types from the file by passing an invalid path argument', () => {
      const mediaType = new MediaTypes(-1);

      [-1, 0, 1, false, null, NaN, Infinity, {}, []].forEach(path => {
        expect(() => mediaType.get(path)).toThrow(new TypeError('Invalid path'))
      });

      ['fileName', 'fileName.', '.txt', ''].forEach(path => {
        expect(() => mediaType.get(path)).toThrow(new SyntaxError('Invalid extension'))
      })
    })

    test('Given that one wants to get the possible media types from the file', () => {
      const mediaType = new MediaTypes(-1);

      ['path/to/fileName.txt', 'fileName.txt'].forEach(path => {
        expect(mediaType.get(path)).toContainEqual(new MIMEType('text/plain'))
      })
    })
  })

  describe('set', () => {
    test('Given that one wants to set a new media type in the list by passing invalid arguments', () => {
      const mediaType = new MediaTypes(-1);

      [-1, 0, 1, false, null, NaN, Infinity, {}, []].forEach(path => {
        expect(() => mediaType.set(path, 'application/x-test')).toThrow(new TypeError('Invalid extension'))
      });

      ['fileName.', '.txt', ''].forEach(path => {
        expect(() => mediaType.set(path, 'application/x-test')).toThrow(new SyntaxError('Invalid extension'))
      });

      [-1, 0, 1, false, null, NaN, Infinity, {}, []].forEach(mediaTypes => {
        expect(() => mediaType.set('test', mediaTypes)).toThrow(new TypeError('Invalid mediaType'))
      });

      ['application', 'application/', '/x-test', ''].forEach(mediaTypes => {
        expect(() => mediaType.set('test', mediaTypes)).toThrow(new SyntaxError('Invalid mediaType'))
      })

      expect(() => mediaType.set(undefined, undefined)).toThrowError(new AggregateError([
        'Invalid extension',
        'Invalid mediaType'
      ], 'Invalid arguments'))
    })

    test('Given that one wants to set a new media type in the module list', () => {
      const mediaType = new MediaTypes(-1)

      const extension = 'test'
      const contentType = ['application/x-test', 'application/octet-stream']

      expect(mediaType.set(extension, `${contentType[0]};key=value`)).toBeTruthy()
      expect(mediaType.set(extension, contentType[0])).toBeFalsy()
      expect(mediaType.get(`fileName.${extension}`)).toContainEqual(new MIMEType(`${contentType[0]};key=value`))

      expect(mediaType.set(extension, contentType[1])).toBeTruthy()
      expect(mediaType.get(`fileName.${extension}`)).toContainEqual(new MIMEType(contentType[1]))
    })

    test('Given that one wants to set an already existing media type into the module list', () => {
      const mediaType = new MediaTypes(-1)

      expect(mediaType.set('txt', 'text/plain')).toBeFalsy()
      expect(mediaType.set('txt', 'text/plain;key=value')).toBeFalsy()
    })
  })

  describe('delete', () => {
    test('Given that one wants to delete a media type by passing an invalid arguments', () => {
      const mediaType = new MediaTypes(-1);

      [-1, 0, 1, false, null, NaN, Infinity, {}, []].forEach(path => {
        expect(() => mediaType.delete(path, 'application/x-test')).toThrow(new TypeError('Invalid extension'))
      });

      ['fileName.', '.txt', ''].forEach(path => {
        expect(() => mediaType.delete(path, 'application/x-test')).toThrow(new SyntaxError('Invalid extension'))
      });

      [-1, 0, 1, false, null, NaN, Infinity, {}, []].forEach(mediaTypes => {
        expect(() => mediaType.delete('test', mediaTypes)).toThrow(new TypeError('Invalid mediaType'))
      });

      ['application', 'application/', '/x-test', ''].forEach(mediaTypes => {
        expect(() => mediaType.delete('test', mediaTypes)).toThrow(new SyntaxError('Invalid mediaType'))
      })

      expect(() => mediaType.delete(undefined, undefined)).toThrowError(new AggregateError([
        'Invalid extension',
        'Invalid mediaType'
      ], 'Invalid arguments'))
    })

    test('Given that one wants to delete an existing media type in the module list', () => {
      const mediaType = new MediaTypes(-1)

      const extension = 'txt'
      const contentType = 'text/plain'

      expect(mediaType.delete(extension, contentType)).toBeTruthy()
      expect(extension in mediaType.list).toBeFalsy()
      expect(mediaType.get(`fileName.${extension}`)).not.toContainEqual(new MIMEType(contentType))
    })

    test('Given that one wants to delete a media type that does not exist in the module list', () => {
      const mediaType = new MediaTypes(-1)

      expect(mediaType.delete('txt', 'application/octet-stream')).toBeFalsy()
      expect(mediaType.delete('test', 'text/plain')).toBeFalsy()
    })

    test('Given that you want to exclude one of the existing media types in the list of modules', () => {
      const mediaType = new MediaTypes(-1)

      const extension = 'txt'

      expect(mediaType.set(extension, 'application/octet-stream')).toBeTruthy()
      expect(mediaType.delete(extension, 'text/plain')).toBeTruthy()
      expect(mediaType.get(`fileName.${extension}`)).toContainEqual(new MIMEType('application/octet-stream'))
    })
  })

  describe('update', () => {
    test('Given that one wants to try to update the list of media types at some point', async () => {
      expect.assertions(3)

      const mediaType = new MediaTypes(-1)

      const extension = 'jpg'
      const contentType = 'image/jpeg'

      expect(mediaType.get(`fileName.${extension}`)).toHaveLength(0)

      await expect(mediaType.update().then(res => {
        return Object.keys(res)
      })).resolves.toContain(extension)
      expect(mediaType.get(`fileName.${extension}`)).toContainEqual(new MIMEType(contentType))
    })

    test('Given that one wants to try to force update the list of media types at some point', async () => {
      expect.assertions(4)

      const mediaType = new MediaTypes(-1)

      const extension = 'jpg'
      const contentType = 'image/jpeg'

      await mediaType.update()

      expect(mediaType.delete(extension, contentType)).toBeTruthy()

      await expect(mediaType.update()).resolves.toStrictEqual({})

      await expect(mediaType.update(true).then(res => {
        return Object.keys(res)
      })).resolves.toContain(extension)

      expect(mediaType.get(`fileName.${extension}`)).toContainEqual(new MIMEType(contentType))
    })
  })
})

describe('Fetch', () => {
  test('Given that one wants to try to update the list of media types at some point and there was an error processing the data', () => {
    expect.assertions(1)

    for (let i = 0; i < 6; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Response('invalid data', {
        status: 200,
        headers: {
          etag: 'v3'
        }
      })))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that one wants to try to update the list of media types at some point and there was an error processing the media types or the file extension', () => {
    expect.assertions(1)

    for (let i = 0; i < 6; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Response(`
          audio/mpeg          %@?
          video/%@?          mp4
      `, {
        status: 200,
        headers: {
          etag: 'v2'
        }
      })))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that the update method was called and the request returns an invalid data type', () => {
    expect.assertions(1)

    for (let i = 0; i < 6; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Response(null, {
        status: 200,
        headers: {
          etag: 'v3'
        }
      })))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that the update method was called and the request does not have an etag header', () => {
    expect.assertions(1)

    for (let i = 0; i < 3; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Response(`
        video/mp4          mp4 mp4v mpg4
      `, {
        status: 200
      })))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that the update method was called and the request returns an error', () => {
    expect.assertions(1)

    for (let i = 0; i < 3; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Response('', {
        status: 500,
        headers: {
          etag: 'v3'
        }
      })))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that the update method was called and the fetch function throws an exception', () => {
    expect.assertions(1)

    for (let i = 0; i < 3; i++) {
      fetch.mockReturnValueOnce(Promise.resolve(new Error('Auto-Update Exception')))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })

  test('Given that the update method was called and the fetch function is rejected', () => {
    expect.assertions(1)

    for (let i = 0; i < 3; i++) {
      fetch.mockReturnValueOnce(Promise.reject(new Error('Update Exception')))
    }

    const mediaType = new MediaTypes(-1)

    return expect(mediaType.update()).resolves.toStrictEqual({})
  })
})

describe('Listeners', () => {
  test('Given that automatic periodic updating is enabled, the time for verification has come and there are media types to update', () => {
    expect.assertions(1)

    const mediaType = new MediaTypes(100)

    return expect(new Promise((resolve, reject) => {
      try {
        mediaType.on('update', resolve)

        jest.advanceTimersByTime(mediaType.updateInterval)
      } catch (err) {
        reject(err)
      }
    })).resolves.toMatchObject(expect.any(Object))
  })

  test('Given that automatic periodic updating is disabled and that one wants to try to update the list of media types at some point', async () => {
    expect.assertions(1)

    const mediaType = new MediaTypes(-1)

    return expect(new Promise((resolve, reject) => {
      try {
        mediaType.on('update', resolve)
      } catch (err) {
        reject(err)
      }
    })).resolves.toMatchObject(await mediaType.update())
  })

  test('Given that auto-update was triggered and there was an exception during the update', () => {
    expect.assertions(2)

    fs.writeFileSync.mockImplementationOnce(() => {
      throw new Error('Auto-Update Exception')
    })

    const mediaType = new MediaTypes(1000)

    return Promise.all([expect(new Promise((resolve, reject) => {
      try {
        mediaType.on(errorMonitor, resolve)
      } catch (err) {
        reject(err)
      }
    })).resolves.toThrow(new Error('Auto-Update Exception')),
    expect(new Promise((resolve, reject) => {
      try {
        mediaType.on('error', resolve)

        jest.advanceTimersByTime(mediaType.updateInterval)
      } catch (err) {
        reject(err)
      }
    })).resolves.toThrow(new Error('Auto-Update Exception'))])
  })
})

describe('EventEmitter', () => {
  // https://nodejs.org/api/events.html#capture-rejections-of-promises
  test('Given that one wants to EventEmitter to capture rejections of promises', async () => {
    expect.assertions(1)

    EventEmitter.captureRejections = true

    const mediaType = new MediaTypes(-1)

    const error = new Error('kaboom')

    return expect(new Promise((resolve, reject) => {
      try {
        mediaType.on('error', resolve)
        mediaType.on('update', async () => {
          throw error
        })

        mediaType.update()
      } catch (err) {
        reject(err)
      }
    })).resolves.toThrow(error)
  })

  // https://nodejs.org/api/events.html#emittersetmaxlistenersn
  test('Given that one wants to limit the number of listeners', () => {
    const mediaType = new MediaTypes(-1)

    expect(mediaType.getMaxListeners()).toBe(10)

    mediaType.setMaxListeners(1)

    expect(mediaType.getMaxListeners()).toBe(1)

    mediaType.setMaxListeners(Number.MAX_SAFE_INTEGER)

    expect(mediaType.getMaxListeners()).toBe(Number.MAX_SAFE_INTEGER)

    mediaType.setMaxListeners(0)

    expect(mediaType.getMaxListeners()).toBe(0)

    mediaType.setMaxListeners(Infinity)

    expect(mediaType.getMaxListeners()).toBe(Infinity)
  })

  test('Given that one wants to add listeners using the "on" method', async () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.on('update', mockFunc)
    mediaType.on('error', mockFunc) // https://nodejs.org/api/events.html#error-events

    expect(mediaType.eventNames()).toContain('update')
    expect(mediaType.eventNames()).toContain('error')
    expect(mediaType.listenerCount('update')).toBe(1)
    expect(mediaType.listenerCount('error')).toBe(1)
    expect(mediaType.listeners('update')).toContain(mockFunc)
    expect(mediaType.listeners('error')).toContain(mockFunc)
    expect(mediaType.rawListeners('update')).toContain(mockFunc)
    expect(mediaType.rawListeners('error')).toContain(mockFunc)
  })

  test('Given that one wants to add listeners using the "once" method', async () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.on('update', mockFunc)
    mediaType.once('update', mockFunc)

    expect(mediaType.listenerCount('update')).toBe(2)

    await mediaType.update()

    expect(mockFunc.mock.calls.length).toBe(2)
    expect(mediaType.listenerCount('update')).toBe(1)
  })

  test('Given that one wants to add listeners using the "addListener" method', async () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.addListener('update', mockFunc)

    expect(mediaType.listenerCount('update')).toBe(1)
  })

  test('Given that one wants to add listeners using the "prependListener" method', async () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc1 = jest.fn()
    const mockFunc2 = jest.fn()
    const mockFunc3 = jest.fn()

    mediaType.on('update', mockFunc1)
    mediaType.addListener('update', mockFunc2)
    mediaType.prependListener('update', mockFunc3)

    expect(mediaType.listeners('update')).toEqual([mockFunc3, mockFunc1, mockFunc2])
  })

  test('Given that one wants to add listeners using the "prependOnceListener" method', async () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc1 = jest.fn()
    const mockFunc2 = jest.fn()
    const mockFunc3 = jest.fn()
    const mockFunc4 = jest.fn()

    mediaType.on('update', mockFunc1)
    mediaType.addListener('update', mockFunc2)
    mediaType.prependListener('update', mockFunc3)
    mediaType.prependOnceListener('update', mockFunc4)

    expect(mediaType.listeners('update')).toEqual([mockFunc4, mockFunc3, mockFunc1, mockFunc2])

    await mediaType.update(true)

    expect(mockFunc4).toHaveBeenCalled()
    expect(mediaType.listeners('update')).toEqual([mockFunc3, mockFunc1, mockFunc2])
  })

  test('Given that one wants to remove listeners using the "off" method', () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.on('update', mockFunc)

    expect(mediaType.rawListeners('update')).toContain(mockFunc)

    mediaType.off('update', mockFunc)

    expect(mediaType.rawListeners('update')).not.toContain(mockFunc)
  })

  test('Given that one wants to remove listeners using the "removeListener" method', () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.on('error', mockFunc)

    expect(mediaType.eventNames()).toContain('error')

    mediaType.removeListener('error', mockFunc)

    expect(mediaType.eventNames()).not.toContain('error')
  })

  test('Given that one wants to remove listeners using the "removeAllListeners" method', () => {
    const mediaType = new MediaTypes(-1)

    const mockFunc = jest.fn()

    mediaType.on('update', mockFunc)
    mediaType.addListener('update', mockFunc)
    mediaType.on('error', mockFunc)
    mediaType.addListener('error', mockFunc)

    expect(mediaType.listenerCount('update')).toBe(2)
    expect(mediaType.listenerCount('error')).toBe(2)

    mediaType.removeAllListeners('update')

    expect(mediaType.listenerCount('update')).toBe(0)
    expect(mediaType.listenerCount('error')).toBe(2)

    mediaType.removeAllListeners('error')

    expect(mediaType.listenerCount('error')).toBe(0)

    mediaType.on('update', mockFunc)
    mediaType.addListener('update', mockFunc)
    mediaType.on('error', mockFunc)
    mediaType.addListener('error', mockFunc)

    expect(mediaType.listenerCount('update')).toBe(2)
    expect(mediaType.listenerCount('error')).toBe(2)

    mediaType.removeAllListeners()

    expect(mediaType.listenerCount('update')).toBe(0)
    expect(mediaType.listenerCount('error')).toBe(0)
  })
})
