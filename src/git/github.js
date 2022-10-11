/**
 * Copyright 2022 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Git = require('./git');
const parsePath = require('parse-filepath');

module.exports = class Github extends Git {
  constructor(reqOpt) {
    super(reqOpt);
    if (this.host == 'github.com') {
      this._enterprise = 'https://api.github.com';
    } else {
      this._enterprise = `http://${this.host}/api/v3`;
    }
  }

  get enterprise() {
    return this._enterprise;
  }

  getReqUrl() {
    if (this.release) {
      return `${this.enterprise}/repos/${this.repo}/releases/tags/${this.release}`;
    } else if (this.ref) {
      return `${this.enterprise}/repos/${this.repo}/contents/${this.path}?ref=${this.ref}`;
    } else {
      // Use the default branch if no release or branch specified
      return `${this.enterprise}/repos/${this.repo}/contents/${this.path}`;
    }
  }

  getAuthHeaders(reqOpt) {
    if (reqOpt.headers.Authorization && !reqOpt.headers.Authorization.includes('token')) {
      reqOpt.headers = { ...reqOpt.headers, Authorization: 'token ' + reqOpt.headers.Authorization };
    }
    reqOpt.headers = { ...reqOpt.headers, 'User-Agent': this.owner };
    return reqOpt;
  }

  getFileUrl(file) {
    let url;
    if (this.release) {
      if (parsePath(file.name).ext == this.fileExt || file.name == this.filename) {
        url = `${this.enterprise}/repos/${this.repo}/releases/assets/${file.id}`;
      }
    } else {
      if (parsePath(file.name).ext == this.fileExt || file.name == this.filename || this.fileExt == '') { 
        if (file.download_url) {
          url = file.download_url;
        }
      }
    }

    return url;
  }

  getFileArray(files) {
    if (this.release) {
      return files.assets;
    } else {
      return files;
    }
  }

  getAddlHeaders(reqOpt) {
    reqOpt.headers = { ...reqOpt.headers, 'Accept': 'application/octet-stream' };
    return reqOpt;
  }
};
