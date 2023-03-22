# MediaTypes
[![CodeQL](https://github.com/JadsonLucena/MediaTypes.js/workflows/CodeQL/badge.svg)](https://github.com/JadsonLucena/MediaTypes.js/actions?workflow=CodeQL)
[![Test Pass](https://github.com/JadsonLucena/MediaTypes.js/workflows/Tests/badge.svg)](https://github.com/JadsonLucena/MediaTypes.js/actions?workflow=Tests)
[![Coverage Status](https://coveralls.io/repos/github/JadsonLucena/MediaTypes.js/badge.svg)](https://coveralls.io/github/JadsonLucena/MediaTypes.js)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This is a comprehensive compilation of media types that may be periodically updated through the following projects: [Apache](https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types), [NGINX](https://github.com/nginx/nginx/blob/master/conf/mime.types) and [Debian](https://salsa.debian.org/debian/media-types/-/blob/master/mime.types)


## What is
A file's extension has no meaning on the web. In order for the client to interpret the document correctly, the media type must be sent in the Content-Type header.


## Interfaces
```typescript
/**
 * @constructor
 * @fires MediaTypes#update
 * @fires MediaTypes#error
 * 
 * @throws {TypeError} Invalid updateInterval
 */
constructor(updateInterval?: number = 86400000)
```

```typescript
// Getters
list(): { [extension: string]: string[] } // List of all extensions with their media types
updateInterval(): number
versions(): { apache: string, debian: string, nginx: string }
```

```typescript
// Setters
/**
 * Periodic database update in milliseconds. if less than zero, will be disabled
 * 
 * @fires MediaTypes#update
 * @fires MediaTypes#error
 * 
 * @throws {TypeError} Invalid updateInterval
 * @see https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
 */
updateInterval(updateInterval?: number = 86400000)
```

```typescript
/**
 * @method
 * @throws {TypeError} Invalid extension
 * @throws {SyntaxError} Invalid extension
 * @throws {TypeError} Invalid mediaType
 * @throws {SyntaxError} Invalid mediaType
 */
delete(
    extension: string
    mediaType: string, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type
) boolean

/**
 * @method
 * @throws {TypeError} Invalid path
 * @throws {SyntaxError} Invalid extension
 */
get(
    path: string // https://nodejs.org/api/path.html#pathparsepath
): string[] // Media type list

/**
 * @method
 * @throws {TypeError} Invalid extension
 * @throws {SyntaxError} Invalid extension
 * @throws {TypeError} Invalid mediaType
 * @throws {SyntaxError} Invalid mediaType
 */
set(
    extension: string
    mediaType: string, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type
) boolean

/**
 * @method
 * @fires MediaTypes#update
 */
update(force?: boolean = false): Promise<null | { [extension: string]: string[] }> // List of new inserted media types
```

```typescript
// Events
on('update', callback: (list: { [extension: string]: string[] }) => void): void
on('error', callback: (error: Error) => void): void
```

> This module extends the main methods of the [EventEmitter module](https://nodejs.org/api/events.html#class-eventemitter):
> - [addListener](https://nodejs.org/api/events.html#emitteraddlistenereventname-listener)
> - [eventNames](https://nodejs.org/api/events.html#emittereventnames)
> - [getMaxListeners](https://nodejs.org/api/events.html#emittergetmaxlisteners)
> - [listenerCount](https://nodejs.org/api/events.html#emitterlistenercounteventname-listener)
> - [listeners](https://nodejs.org/api/events.html#emitterlistenerseventname)
> - [off](https://nodejs.org/api/events.html#emitteroffeventname-listener)
> - [on](https://nodejs.org/api/events.html#emitteroneventname-listener)
> - [once](https://nodejs.org/api/events.html#emitteronceeventname-listener)
> - [prependListener](https://nodejs.org/api/events.html#emitterprependlistenereventname-listener)
> - [prependOnceListener](https://nodejs.org/api/events.html#emitterprependoncelistenereventname-listener)
> - [removeAllListeners](https://nodejs.org/api/events.html#emitterremovealllistenerseventname)
> - [removeListener](https://nodejs.org/api/events.html#emitterremovelistenereventname-listener)
> - [setMaxListeners](https://nodejs.org/api/events.html#emittersetmaxlistenersn)
> - [rawListeners](https://nodejs.org/api/events.html#emitterrawlistenerseventname)

## Specifications
We strive to maintain complete code coverage in tests. With that, we provide all the necessary use cases for a good understanding of how this module works. See: [test/MediaTypes.spec.js](https://github.com/JadsonLucena/MediaTypes.js/blob/main/test/MediaTypes.spec.js)