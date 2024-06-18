'use strict'

const fs = require('node:fs')
const { parse, join } = require('node:path')
const { EventEmitter } = require('node:events')
const { MIMEType } = require('node:util')

function removeDuplicates (array) {
  return array.filter((v, i, a) => a.findIndex(t => t.essence === v.essence) === i)
}

/**
 * @class
 * @classdesc This is a comprehensive compilation of media types that may be periodically updated
 *
 * @typedef {Object} Versions
 * @property {string} Versions.apache
 * @property {string} Versions.debian
 * @property {string} Versions.nginx
 */
class MediaTypes {
  #eventEmitter

  #mediaTypes
  #versions
  #updateInterval
  #updateLoop

  #formatExtension = /^[a-z0-9!#$&\-^_+]+$/i

  /**
   * Create a MediaType class
   * @constructor
   * @param {number} [updateInterval=86400000] - Periodic database update in milliseconds. if less than zero, will be disabled
   * @see https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
   *
   * @fires MediaTypes#update
   * @fires MediaTypes#error
   *
   * @throws {TypeError} Invalid updateInterval
   */
  constructor (updateInterval = 86400000) {
    this.#eventEmitter = new EventEmitter()

    try {
      const { mediaTypes, versions } = JSON.parse(fs.readFileSync(join(__dirname, 'DB.json')).toString('utf8'))

      this.#mediaTypes = Object.keys(mediaTypes).reduce((acc, key) => {
        acc[key] = mediaTypes[key].map(mediaType => new MIMEType(mediaType))

        return acc
      }, {})
      this.#versions = versions
    } catch (err) {
      this.#mediaTypes = {}
      this.#versions = {
        apache: '',
        debian: '',
        nginx: ''
      }
    }

    this.updateInterval = updateInterval
  }

  #isMediaType (mediaType) {
    try {
      return new MIMEType(mediaType)
    } catch (err) {
      return false
    }
  }

  #updateList (content) {
    const list = {}

    for (let extension in content) {
      extension = extension.trim().toLowerCase()

      if (extension in this.#mediaTypes) {
        content[extension].forEach(mediaType => {
          mediaType = new MIMEType(mediaType)

          if (!this.#mediaTypes[extension].some(MT => MT.essence === mediaType.essence)) {
            this.#mediaTypes[extension] = this.#mediaTypes[extension].concat(mediaType).sort()

            list[extension] = (list[extension] || []).concat(mediaType)
          }
        })
      } else {
        list[extension] = this.#mediaTypes[extension] = removeDuplicates(content[extension].map(mediaType => new MIMEType(mediaType)))
      }
    }

    return list
  }

  async #load (res) {
    return {
      version: res.headers.get('etag'),
      content: (await res.text())
        .split(/\n+/)
        .reduce((curr, line) => {
          line = line.trim()
          line = line.replace(/(\s*types\s*{\s*|\s*}\s*|\s*;\s*)$/ig, '') // remove non-standard characters coming from nginx when it fits

          if (/^\s*#.*$/.test(line) || line === '') {
            return curr
          }

          line = line.match(/^(?<mediaType>[^\s]+)\s+(?<extensions>.*)$/)

          const mediaType = line?.groups?.mediaType

          if (this.#isMediaType(mediaType)) {
            line?.groups?.extensions?.split(/\s+/)?.forEach(extension => {
              extension = extension?.trim()?.toLowerCase()

              if (this.#formatExtension.test(extension)) {
                curr[extension] = (curr[extension] || []).concat(mediaType)
              }
            })
          }

          return curr
        }, {})
    }
  }

  /**
   * @method
   * @param {boolean} [force=false] - Force update even if no version changes
   *
   * @fires MediaTypes#update
   *
   * @return {Promise<null | Object.<string, MIMEType[]>>} List of all extensions with their media types
   */
  update (force = false) {
    return Promise.allSettled([
      fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', { // https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types
        method: 'HEAD',
        headers: {
          'Accept-Encoding': 'identity'
        }
      }).then(res => {
        if (res.status === 200 && (Boolean(force) || (res.headers.get('etag') && res.headers.get('etag') !== this.#versions.apache))) {
          return fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', {
            headers: {
              'Accept-Encoding': 'identity'
            }
          })
        }
      }),
      fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', { // https://salsa.debian.org/debian/media-types/-/blob/master/mime.types
        method: 'HEAD',
        headers: {
          'Accept-Encoding': 'identity'
        }
      }).then(res => {
        if (res.status === 200 && (Boolean(force) || (res.headers.get('etag') && res.headers.get('etag') !== this.#versions.debian))) {
          return fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', {
            headers: {
              'Accept-Encoding': 'identity'
            }
          })
        }
      }),
      fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', { // https://github.com/nginx/nginx/blob/master/conf/mime.types
        method: 'HEAD',
        headers: {
          'Accept-Encoding': 'identity'
        }
      }).then(res => {
        if (res.status === 200 && (Boolean(force) || (res.headers.get('etag') && res.headers.get('etag') !== this.#versions.nginx))) {
          return fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', {
            headers: {
              'Accept-Encoding': 'identity'
            }
          })
        }
      })
    ]).then(async results => {
      let list = {}

      if (results[0].status === 'fulfilled' && results[0].value) {
        const load = await this.#load(results[0].value)

        if (load.version && Object.keys(load.content).length) {
          this.#versions.apache = load.version

          list.apache = {
            content: this.#updateList(load.content),
            version: load.version
          }
        }
      }

      if (results[1].status === 'fulfilled' && results[1].value) {
        const load = await this.#load(results[1].value)

        if (load.version && Object.keys(load.content).length) {
          this.#versions.debian = load.version

          list.debian = {
            content: this.#updateList(load.content),
            version: load.version
          }
        }
      }

      if (results[2].status === 'fulfilled' && results[2].value) {
        const load = await this.#load(results[2].value)

        if (load.version && Object.keys(load.content).length) {
          this.#versions.nginx = load.version

          list.nginx = {
            content: this.#updateList(load.content),
            version: load.version
          }
        }
      }

      if (!Object.keys(list).length) {
        return null
      }

      fs.writeFileSync(join(__dirname, 'DB.json'), JSON.stringify({
        mediaTypes: this.#mediaTypes,
        versions: this.#versions
      }))

      list = Object.keys(list).reduce((acc, cur) => {
        Object.keys(list[cur].content).forEach(key => {
          acc[key] = removeDuplicates((acc[key] || []).concat(list[cur].content[key]))
        })

        return acc
      }, {})

      /**
       * Update event
       *
       * @event MediaTypes#update
       * @type {Object.<string, MIMEType[]>}
       */
      this.#eventEmitter.emit('update', list)

      return list
    })
  }

  /**
   * @type {number} [updateInterval=86400000]
   * @see https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
   *
   * @fires MediaTypes#update
   * @fires MediaTypes#error
   *
   * @throws {TypeError} Invalid updateInterval
   */
  set updateInterval (updateInterval = 86400000) {
    if (
      typeof updateInterval !== 'number' ||
            !Number.isFinite(updateInterval) ||
            Number.isNaN(updateInterval)
    ) {
      throw new TypeError('Invalid updateInterval')
    }

    this.#updateInterval = updateInterval

    clearInterval(this.#updateLoop)

    if (updateInterval >= 0) {
      this.#updateLoop = setInterval(async () => {
        try {
          await this.update()
        } catch (err) {
          /**
           * Error event
           *
           * @event MediaTypes#error
           * @type {Error}
           */
          this.#eventEmitter.emit('error', err)
        }
      }, this.#updateInterval)
    }
  }

  /**
   * @type {number}
   */
  get updateInterval () {
    return this.#updateInterval
  }

  /**
   * @return {Versions}
   */
  get versions () {
    return this.#versions
  }

  /**
   * @return {Object.<string, MIMEType[]>}
   */
  get list () {
    return this.#mediaTypes
  }

  /**
   * @method
   * @param {string} path - File path
   * @see https://nodejs.org/api/path.html#pathparsepath
   *
   * @throws {TypeError} Invalid path
   * @throws {SyntaxError} Invalid extension
   *
   * @return {MIMEType[]}
   */
  get (path) {
    if (typeof path !== 'string') {
      throw new TypeError('Invalid path')
    }

    const pathinfo = parse(path)
    const extension = pathinfo.ext.replace('.', '').trim().toLowerCase()

    if (!this.#formatExtension.test(extension)) {
      throw new SyntaxError('Invalid extension')
    }

    return (this.#mediaTypes[extension] || [])
  }

  /**
   * @method
   * @param {string} extension - File extension
   * @param {string} mediaType - {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type IANA media types}
   *
   * @throws {TypeError} Invalid extension
   * @throws {SyntaxError} Invalid extension
   * @throws {TypeError} Invalid mediaType
   * @throws {SyntaxError} Invalid mediaType
   *
   * @return {boolean}
   */
  set (extension, mediaType) {
    if (typeof extension !== 'string') {
      throw new TypeError('Invalid extension')
    } else if (!this.#formatExtension.test(extension)) {
      throw new SyntaxError('Invalid extension')
    }

    if (typeof mediaType !== 'string') {
      throw new TypeError('Invalid mediaType')
    } else if (!this.#isMediaType(mediaType)) {
      throw new SyntaxError('Invalid mediaType')
    }

    const content = {}
    content[extension] = [].concat(mediaType)

    const list = this.#updateList(content)

    if (!(extension in list)) {
      return false
    }

    fs.writeFileSync(join(__dirname, 'DB.json'), JSON.stringify({
      mediaTypes: this.#mediaTypes,
      versions: this.#versions
    }))

    return true
  }

  /**
   * @method
   * @param {string} extension - File extension
   * @param {string} mediaType - {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type IANA media types}
   *
   * @throws {TypeError} Invalid extension
   * @throws {SyntaxError} Invalid extension
   * @throws {TypeError} Invalid mediaType
   * @throws {SyntaxError} Invalid mediaType
   *
   * @return {boolean}
   */
  delete (extension, mediaType) {
    if (typeof extension !== 'string') {
      throw new TypeError('Invalid extension')
    } else if (!this.#formatExtension.test(extension)) {
      throw new SyntaxError('Invalid extension')
    }

    extension = extension.trim().toLowerCase()

    if (typeof mediaType !== 'string') {
      throw new TypeError('Invalid mediaType')
    } else if (!this.#isMediaType(mediaType)) {
      throw new SyntaxError('Invalid mediaType')
    }

    if (!(extension in this.#mediaTypes)) {
      return false
    }

    const i = this.#mediaTypes[extension].findIndex(MT => MT.essence === new MIMEType(mediaType).essence)

    if (i < 0) {
      return false
    }

    this.#mediaTypes[extension].splice(i, 1)

    if (!this.#mediaTypes[extension].length) {
      delete this.#mediaTypes[extension]
    }

    fs.writeFileSync(join(__dirname, 'DB.json'), JSON.stringify({
      mediaTypes: this.#mediaTypes,
      versions: this.#versions
    }))

    return true
  }

  // EventEmitter methods
  addListener = (...params) => this.#eventEmitter.addListener(...params)
  eventNames = (...params) => this.#eventEmitter.eventNames(...params)
  getMaxListeners = (...params) => this.#eventEmitter.getMaxListeners(...params)
  listenerCount = (...params) => this.#eventEmitter.listenerCount(...params)
  listeners = (...params) => this.#eventEmitter.listeners(...params)
  off = (...params) => this.#eventEmitter.off(...params)
  on = (...params) => this.#eventEmitter.on(...params)
  once = (...params) => this.#eventEmitter.once(...params)
  prependListener = (...params) => this.#eventEmitter.prependListener(...params)
  prependOnceListener = (...params) => this.#eventEmitter.prependOnceListener(...params)
  removeAllListeners = (...params) => this.#eventEmitter.removeAllListeners(...params)
  removeListener = (...params) => this.#eventEmitter.removeListener(...params)
  setMaxListeners = (...params) => this.#eventEmitter.setMaxListeners(...params)
  rawListeners = (...params) => this.#eventEmitter.rawListeners(...params)
}

module.exports = MediaTypes
