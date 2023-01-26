const fs = require('fs');
const { parse } = require('path');
const EventEmitter = require('events');

class MimeTypes extends EventEmitter {

    #mimeTypes;
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

        super({captureRejections: true});

        this.setMaxListeners(0);


        try {

            this.#mimeTypes = JSON.parse(fs.readFileSync(__dirname +'/mimetypes.json').toString('utf8'));

        } catch (err) {

            this.#mimeTypes = {};

        }


        try {

            this.#versions = JSON.parse(fs.readFileSync(__dirname +'/versions.json').toString('utf8'));

        } catch (err) {

            this.#versions = {
                apache: null,
                debian:  null,
                nginx: null
            };

        }


        /*try {

            this.update();

        } catch (err) {

            console.error(err);

        }*/


        this.updateInterval = updateInterval;

    }

    #updateList(content) {

        let list = {};

        for (let extension in content) {

            extension = extension.trim().toLowerCase();

            if (extension in this.#mimeTypes) {

                content[extension].forEach(mimeType => {

                    mimeType = mimeType.trim().toLowerCase();

                    if (!this.#mimeTypes[extension].includes(mimeType)) {

                        this.#mimeTypes[extension].push(mimeType);

                        list[extension] = (list[extension] || []).concat(mimeType);

                    }

                });

            } else {

                list[extension] = this.#mimeTypes[extension] = content[extension];

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

                       let mimeType = line[0].trim().toLowerCase();

                        if (this.#formatMediaType.test(mimeType)) {

                            line[1].split(/\s+/).forEach(extension => {

                                extension = extension.trim().toLowerCase()

                                if (this.#formatExtension.test(extension)) {

                                    curr[extension] = (curr[extension] || []).concat(mimeType);

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

                    line = line.match(/^\s*(?<mimeType>[^\s]+)\s+(?<extensions>.*)\s*$/);

                    let mimeType = line.groups.mimeType.trim().toLowerCase();

                    if (this.#formatMediaType.test(mimeType)) {

                        line.groups.extensions.split(/\s+/).forEach(extension => {

                            extension = extension.trim().toLowerCase()

                            if (this.#formatExtension.test(extension)) {

                                curr[extension] = (curr[extension] || []).concat(mimeType);

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

    update = () => {

        return Promise.allSettled([
            fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', { // https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && res.headers.get('etag') != this.#versions.apache) {

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

                if (res.status == 200 && res.headers.get('etag') != this.#versions.debian) {

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

                if (res.status == 200 && res.headers.get('etag') != this.#versions.nginx) {

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

                fs.writeFileSync(__dirname +'/mimetypes.json', JSON.stringify(this.#mimeTypes));
                fs.writeFileSync(__dirname +'/versions.json', JSON.stringify(this.#versions));

                this.emit('update', list);

            }

            return list;

        });

    }


    get list() { return this.#mimeTypes; }
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


    get(path) {

        let pathinfo = parse(path);
        let extension = pathinfo.ext.replace('.', '').trim().toLowerCase();

        if (typeof extension != 'string') {

            throw new TypeError('Unsupported extension');

        } else if (!this.#formatExtension.test(extension)) {

            throw new SyntaxError('Unsupported extension');

        }

        return this.#mimeTypes[extension];

    }

    append(extension, mimeType) {

        mimeType = [].concat(mimeType);

        if (typeof extension != 'string') {

            throw new TypeError('Unsupported extension');

        } else if (!this.#formatExtension.test(extension)) {

            throw new SyntaxError('Unsupported extension');

        }

        mimeType.forEach(mimeType => {

            if (typeof mimeType != 'string') {

                throw new TypeError(`Unsupported mimeType: ${mimeType}`);

            } else if (!this.#formatMediaType.test(mimeType)) {

                throw new SyntaxError(`Unsupported mimeType: ${mimeType}`);

            }

        });

        let content = {};
        content[extension] = mimeType;

        if (this.#updateList(content)) {

            fs.writeFileSync(__dirname +'/mimetypes.json', JSON.stringify(this.#mimeTypes));

        }

    }

}


module.exports = MimeTypes;