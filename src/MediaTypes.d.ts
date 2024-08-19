import { MIMEType } from 'node:util'
import { EventEmitter } from 'node:events'

type Versions = {
  apache: string,
  nginx: string,
  debian: string
}

declare module '@jadsonlucena/mediatypes' {
  /**
   * @classdesc This is a comprehensive compilation of media types that may be periodically updated
   * 
   * @emits MediaTypes#update
   * @emits MediaTypes#error
   */
  export default class MediaTypes {

    /**
     * Create a MediaType class
     * @param {number} [updateInterval=86400000] - Periodic database update in milliseconds. if less than zero, will be disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
     *
     * @throws {TypeError} Invalid updateInterval
     */
    constructor (updateInterval?: number)

    /**
     * @default '86400000'
     *
     * @throws {TypeError} Invalid updateInterval
     * 
     * @see https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
     */
    set updateInterval(param: number)
    get updateInterval(): number

    get versions(): Versions

    get list(): Record<string, MIMEType[]>

    /**
     * @method
     * @param {boolean} [force=false] - Force update even if no version changes
     *
     * @return {Promise<Object.<string, MIMEType[]>>} List of all extensions with their media types
     */
    update(force?: boolean): Promise<Record<string, MIMEType[]>>

    /**
     * @param {string} path - File path
     * @see https://nodejs.org/api/path.html#pathparsepath
     *
     * @throws {TypeError} Invalid path
     * @throws {SyntaxError} Invalid extension
     *
     * @return {MIMEType[]}
     */
    get(path: string): MIMEType[]

    /**
     * @param {string} extension - File extension
     * @param {string} mediaType - {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type IANA media types}
     *
     * @throws {TypeError|SyntaxError} Invalid extension
     * @throws {TypeError|SyntaxError} Invalid mediaType
     * @throws {AggregateError} Invalid arguments
     *
     * @return {boolean}
     */
    set(extension: string, mediaType: string): boolean

    /**
     * @param {string} extension - File extension
     * @param {string} mediaType - {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type IANA media types}
     *
     * @throws {TypeError|SyntaxError} Invalid extension
     * @throws {TypeError|SyntaxError} Invalid mediaType
     * @throws {AggregateError} Invalid arguments
     *
     * @return {boolean}
     */
    delete(extension: string, mediaType: string): boolean

    /**
     * @see https://nodejs.org/api/events.html#emitteraddlistenereventname-listener
     */
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emittereventnames
     */
    eventNames(): (string | symbol)[]
    /**
     * @see https://nodejs.org/api/events.html#emittergetmaxlisteners
     */
    getMaxListeners(): number
    /**
     * @see https://nodejs.org/api/events.html#emitterlistenercounteventname-listener
     */
    listenerCount(eventName: string | symbol, listener?: Function | undefined): number
    /**
     * @see https://nodejs.org/api/events.html#emitterlistenerseventname
     */
    listeners(eventName: string | symbol): Function[]
    /**
     * @see https://nodejs.org/api/events.html#emitteroffeventname-listener
     */
    off(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitteroneventname-listener
     */
    on(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitteronceeventname-listener
     */
    once(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitterprependlistenereventname-listener
     */
    prependListener(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitterprependoncelistenereventname-listener
     */
    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitterremovealllistenerseventname
     */
    removeAllListeners(event?: string | symbol | undefined): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitterremovelistenereventname-listener
     */
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emittersetmaxlistenersn
     */
    setMaxListeners(n: number): EventEmitter
    /**
     * @see https://nodejs.org/api/events.html#emitterrawlistenerseventname
     */
    rawListeners(eventName: string | symbol): Function[]
  }
}