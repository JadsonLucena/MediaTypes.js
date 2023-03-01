const fs = require('fs');
const { parse } = require('path');
const { EventEmitter } = require('events');

class MediaTypes {

    #eventEmitter;

    #mediaTypes;
    #versions;
    #updateInterval;
    #updateLoop;

    // https://www.rfc-editor.org/rfc/rfc4288#section-4.2
    // https://www.rfc-editor.org/rfc/rfc6838#section-4.2
    // https://www.rfc-editor.org/rfc/rfc2045#section-5.1
    // https://www.rfc-editor.org/rfc/rfc2231#section-7
    // https://www.rfc-editor.org/rfc/rfc5987#section-3.2.1
    #formatMediaType = new RegExp(`^(?<type>(?:x-)?[a-z0-9]{1,64})\\/(?<subtype>(?:(?<facet>[a-z0-9!#$&\\-^_]+)(?:(?<=\/x)-|\\.))?(?:[a-z0-9!#$&\\-^_]+\\+(?<suffix>[a-z0-9!#$&\\-^_]+)|[a-z0-9!#$&\\-^_]+[.+][a-z0-9!#$&\\-^_]+|[a-z0-9!#$&\\-^_+]+)+){1,64}$`, 'i');
    #formatExtension = new RegExp(`^[a-z0-9!#$&\\-^_+]+$`, 'i');

    constructor(updateInterval = 86400000) {

        this.#eventEmitter = new EventEmitter();

        try {

            const { mediaTypes, versions } = JSON.parse(fs.readFileSync(__dirname +'/DB.json').toString('utf8'));

            this.#mediaTypes = mediaTypes
            this.#versions = versions

        } catch (err) {

            this.#mediaTypes = {};
            this.#versions = {
                apache: null,
                debian:  null,
                nginx: null
            };

        }


        this.updateInterval = updateInterval;

    }

    #updateList = content => {

        let list = {};

        for (let extension in content) {

            extension = extension.trim().toLowerCase();

            if (extension in this.#mediaTypes) {

                content[extension].forEach(mediaType => {

                    mediaType = mediaType.trim().toLowerCase();

                    if (!this.#mediaTypes[extension].includes(mediaType)) {

                        this.#mediaTypes[extension] = this.#mediaTypes[extension].concat(mediaType).sort();

                        list[extension] = (list[extension] || []).concat(mediaType);

                    }

                });

            } else {

                list[extension] = this.#mediaTypes[extension] = content[extension];

            }

        }

        return list;

    }

    #loadApache = async res => {

        try {

            return {
                version: res.headers.get('etag'),
                content: (await res.text()).split(/\n+/).filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.split(/\t+/);

                    if (line.length > 1) {

                       let mediaType = line[0].trim().toLowerCase();

                        if (this.#formatMediaType.test(mediaType)) {

                            line[1].split(/\s+/).forEach(extension => {

                                extension = extension.trim().toLowerCase()

                                if (this.#formatExtension.test(extension)) {

                                    curr[extension] = (curr[extension] || []).concat(mediaType);

                                }

                            });

                        }

                    }

                    return curr;

                }, {})
            };

        } catch (err) {

            console.error(err);

            return null;

        }

    }

    #loadDebian = async res => {

        return await this.#loadApache(res);

    }

    #loadNGINX = async res => {

        try {

            return {
                version: res.headers.get('etag'),
                content: (await res.text()).replace(/(\s*types\s*{\s*|\s*}\s*)/ig, '').split(';').filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.match(/^\s*(?<mediaType>[^\s]+)\s+(?<extensions>.*)\s*$/);

                    let mediaType = line.groups.mediaType.trim().toLowerCase();

                    if (this.#formatMediaType.test(mediaType)) {

                        line.groups.extensions.split(/\s+/).forEach(extension => {

                            extension = extension.trim().toLowerCase()

                            if (this.#formatExtension.test(extension)) {

                                curr[extension] = (curr[extension] || []).concat(mediaType);

                            }

                        })

                    }

                    return curr;

                }, {})
            };

        } catch (err) {

            console.error(err);

            return null;

        }

    }

    update = (force = false) => {

        return Promise.allSettled([
            fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', { // https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && (Boolean(force) || res.headers.get('etag') != this.#versions.apache)) {

                    return fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            }),
            fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', { // https://salsa.debian.org/debian/media-types/-/blob/master/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && (Boolean(force) || res.headers.get('etag') != this.#versions.debian)) {

                    return fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            }),
            fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', { // https://github.com/nginx/nginx/blob/master/conf/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && (Boolean(force) || res.headers.get('etag') != this.#versions.nginx)) {

                    return fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            })
        ]).then(async results => {

            let list = {};

            if (results[0].status == 'fulfilled' && results[0].value) {

                let load = await this.#loadApache(results[0].value);

                if (load) {

                    this.#versions.apache = load.version;

                    list.apache = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            if (results[1].status == 'fulfilled' && results[1].value) {

                let load = await this.#loadDebian(results[1].value);

                if (load) {

                    this.#versions.debian = load.version;

                    list.debian = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            if (results[2].status == 'fulfilled' && results[2].value) {

                let load = await this.#loadNGINX(results[2].value);

                if (load) {

                    this.#versions.nginx = load.version;

                    list.nginx = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            if (Object.keys(list).length) {

                fs.writeFileSync(__dirname +'/DB.json', JSON.stringify({
                    mediaTypes: this.#mediaTypes,
                    versions: this.#versions
                }));

                this.#eventEmitter.emit('update', list);

            }

            return list;

        });

    }


    get list() { return this.#mediaTypes; }
    get updateInterval() { return this.#updateInterval; }
    get pattern() { return this.#formatMediaType; }


    set updateInterval(updateInterval = 86400000) {

        if (
            typeof updateInterval != 'number'
            || !Number.isFinite(updateInterval)
            || Number.isNaN(updateInterval)
        ) {
            throw new TypeError('Invalid updateInterval')
        }

        this.#updateInterval = updateInterval;

        clearInterval(this.#updateLoop);

        if (updateInterval >= 0) {

            this.#updateLoop = setInterval(async () => {

                try {

                    await this.update();

                } catch (err) {

                    console.error(err);

                }

            }, this.#updateInterval);

        }

    }


    get = path => {

        let pathinfo = parse(path);
        let extension = pathinfo.ext.replace('.', '').trim().toLowerCase();

        if (typeof extension != 'string') {

            throw new TypeError('Unsupported extension');

        } else if (!this.#formatExtension.test(extension)) {

            throw new SyntaxError('Unsupported extension');

        }

        return this.#mediaTypes[extension];

    }

    set = (extension, mediaType) => {

        mediaType = [].concat(mediaType);

        if (typeof extension != 'string') {

            throw new TypeError('Unsupported extension');

        } else if (!this.#formatExtension.test(extension)) {

            throw new SyntaxError('Unsupported extension');

        }

        mediaType.forEach(mediaType => {

            if (typeof mediaType != 'string') {

                throw new TypeError(`Unsupported mediaType: ${mediaType}`);

            } else if (!this.#formatMediaType.test(mediaType)) {

                throw new SyntaxError(`Unsupported mediaType: ${mediaType}`);

            }

        });

        let content = {};
        content[extension] = mediaType;

        const list = this.#updateList(content);

        if (!(extension in list)) {

            return [];

        }

        fs.writeFileSync(__dirname +'/DB.json', JSON.stringify({
            mediaTypes: this.#mediaTypes,
            versions: this.#versions
        }));

        return list[extension];

    }

    delete = (extension, mediaType) => {

        mediaType = [].concat(mediaType);

        if (typeof extension != 'string') {

            throw new TypeError('Unsupported extension');

        } else if (!this.#formatExtension.test(extension)) {

            throw new SyntaxError('Unsupported extension');

        }

        extension = extension.trim().toLowerCase();

        mediaType.forEach(mediaType => {

            if (typeof mediaType != 'string') {

                throw new TypeError(`Unsupported mediaType: ${mediaType}`);

            } else if (!this.#formatMediaType.test(mediaType)) {

                throw new SyntaxError(`Unsupported mediaType: ${mediaType}`);

            }

        });

        let list = [];

        if (!(extension in this.#mediaTypes)) {

            return list;

        }

        mediaType.forEach(mediaType => {

            let i = this.#mediaTypes[extension].indexOf(mediaType.trim().toLowerCase());

            if (i >= 0) {

                list = list.concat(this.#mediaTypes[extension].splice(i, 1));

            }

        });

        if (!this.#mediaTypes[extension].length) {

            delete this.#mediaTypes[extension];

        }

        if (list.length) {

            fs.writeFileSync(__dirname +'/DB.json', JSON.stringify({
                mediaTypes: this.#mediaTypes,
                versions: this.#versions
            }));

        }

        return list;

    }

    // EventEmitter methods
    addListener = (...params) => this.#eventEmitter.addListener(...params);
    eventNames = (...params) => this.#eventEmitter.eventNames(...params);
    getMaxListeners = (...params) => this.#eventEmitter.getMaxListeners(...params);
    listenerCount = (...params) => this.#eventEmitter.listenerCount(...params);
    listeners = (...params) => this.#eventEmitter.listeners(...params);
    off = (...params) => this.#eventEmitter.off(...params);
    on = (...params) => this.#eventEmitter.on(...params);
    once = (...params) => this.#eventEmitter.once(...params);
    prependListener = (...params) => this.#eventEmitter.prependListener(...params);
    prependOnceListener = (...params) => this.#eventEmitter.prependOnceListener(...params);
    removeAllListeners = (...params) => this.#eventEmitter.removeAllListeners(...params);
    removeListener = (...params) => this.#eventEmitter.removeListener(...params);
    setMaxListeners = (...params) => this.#eventEmitter.setMaxListeners(...params);
    rawListeners = (...params) => this.#eventEmitter.rawListeners(...params);

}

module.exports = MediaTypes;