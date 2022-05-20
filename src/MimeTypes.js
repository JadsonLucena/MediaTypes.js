const fs = require('fs');
const { parse } = require('path');

class MimeTypes {

    #mimeTypes;

    constructor() {

        try {

            this.#mimeTypes = JSON.parse(fs.readFileSync('mimetypes.json').toString('utf8'));

        } catch (err) {

            this.#mimeTypes = {};

        }

    }

    #updateList(content) {

        let updated = false;

        for (let mimeType in content) {

            mimeType = mimeType.trim().toLowerCase();

            if (mimeType in this.#mimeTypes) {

                content[mimeType].forEach(extension => {

                    extension = extension.trim().toLowerCase();

                    if (!this.#mimeTypes[mimeType].includes(extension)) {

                        this.#mimeTypes[mimeType].push(extension);

                        updated = true;

                    }

                });

            } else {

                this.#mimeTypes[mimeType] = content[mimeType];

                updated = true;

            }

        }

        return updated;

    }

    #loadApache = async res => {

        try {

            return {
                version: res.headers.get('etag'),
                content: (await res.text()).split(/\n+/).filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.split(/\t+/);

                    if (line.length > 1) {

                       let mimeType = line[0].trim().toLowerCase();
                       let extensions = line[1].split(/\s+/).map(ext => ext.trim().toLowerCase()).filter(ext => ext);

                        if (mimeType != '' && extensions.length) {

                            curr[mimeType] = extensions;

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

    get list() {  

        return this.#mimeTypes;

    }

    get(path) {

        let pathinfo = parse(path);
        let extension = pathinfo.ext.replace('.', '').trim().toLowerCase();
        let mimeTypes = [];

        for (let mimeType in this.#mimeTypes) {

            if (!mimeTypes.includes(mimeType) && this.#mimeTypes[mimeType].includes(extension)) {

                mimeTypes.push(mimeType);

            }

        }

        return mimeTypes;

    }

    append(mimeType, extension) {

        extension = [].concat(extension);

        if (typeof mimeType != 'string' || !mimeType.trim() || !/^.+\/.+$/i.test(mimeType)) {

            throw new TypeError('Unsupported mimeType');

        } else if (!extension.every(extension => typeof extension == 'string' && extension.trim() && /^[a-z0-9-_+.~%]+$/i.test(extension))) {

            throw new TypeError('Unsupported extension');

        }


        let content = {};
        content[mimeType] = extension;


        if (this.#updateList(content)) {

            fs.writeFileSync('mimetypes.json', JSON.stringify(this.#mimeTypes));

        }

    }

}


module.exports = MimeTypes;