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
const gh = require('parse-github-url');

module.exports = class Gitlab extends Git {
  constructor(reqOpt) {
    super(reqOpt);
    this._external = false;
  }

  get encodedPath() {
    return encodeURIComponent(this.path);
  }
  
  get encodedRepo() {
    return encodeURIComponent(this.repo);
  }

  get encodedRef() {
    return encodeURIComponent(this.ref);
  }

  get external() {
    return this._external;
  }

  set external(external) {
    this._external = external;
  }

  getReqUrl() {
    if (this.release) {
      return `https://${this.host}/api/v4/projects/${this.encodedRepo}/releases/${this.release}/assets/links`;
    } else if (this.ref) {
      return `https://${this.host}/api/v4/projects/${this.encodedRepo}/repository/tree/?path=${this.encodedPath}&ref=${this.encodedRef}`;
    } else {
      // Use the default branch if no release or branch specified
      return `https://${this.host}/api/v4/projects/${this.encodedRepo}/repository/tree/?path=${this.encodedPath}`;
    }
    
  }

  getAuthHeaders(reqOpt) {
    if (reqOpt.headers && reqOpt.headers.Authorization && !reqOpt.headers.Authorization.includes('Bearer')) {
      reqOpt.headers = { ...reqOpt.headers, Authorization: 'Bearer ' + reqOpt.headers.Authorization };
    }
    return reqOpt;
  }

  getFileUrl(file) {
    let url;
    if (this.release) {
      if (parsePath(file.name).ext == this.fileExt || file.name == this.filename) {
        const parse = gh(file.url);
        if (file.internal || parse.host == this.host) {
          const split = parse.filepath.split('/');
          const ref = split[1];
          split.splice(0,2);
          const path = split.join('/');
          url = `https://${parse.host}/api/v4/projects/${encodeURIComponent(parse.repo)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
        } else {
          url = file.url;
          this.external = true;
        }
      }
    } else {
      if (parsePath(file.name).ext == this.fileExt || file.name == this.filename || this.fileExt == '') {
        let reqglpath = this.encodedPath;
        if (reqglpath != '' && !reqglpath.endsWith('%2F')) {
          reqglpath += '%2F';
        }
        url = `https://${this.host}/api/v4/projects/${this.encodedRepo}/repository/files/${reqglpath}${encodeURIComponent(file.name)}/raw?ref=${this.encodedRef}`;
      }
    }
    
    return url;
  }

  getAddlHeaders(reqOpt) {
    if (this.release && this.external) {
      reqOpt.headers = {};
    } 
    return reqOpt;
  }
};
