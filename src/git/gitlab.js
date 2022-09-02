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

module.exports = class Gitlab extends Git {
  constructor(reqOpt) {
    super(reqOpt);
  }

  get encodedPath() {
    return encodeURIComponent(this.path);
  }
  
  get encodedRepo() {
    return encodeURIComponent(this.repo);
  }

  get encodedBranch() {
    return encodeURIComponent(this.branch);
  }

  getReqUrl() { 
    return `https://${this.host}/api/v4/projects/${this.encodedRepo}/repository/tree/?path=${this.encodedPath}&ref=${this.encodedBranch}`;
  }

  getAuthHeaders(reqOpt) {
    if (reqOpt.headers.Authorization && !reqOpt.headers.Authorization.includes('Bearer')) {
      reqOpt.headers = { ...reqOpt.headers, Authorization: 'Bearer ' + reqOpt.headers.Authorization };
    }
    return reqOpt;
  }

  getFileUrl(file) {
    let url;
    if (parsePath(file.name).ext == this.fileExt || file.name == this.filename || this.fileExt == '') {
      let reqglpath = this.encodedPath;
      if (reqglpath != '' && !reqglpath.endsWith('%2F')) {
        reqglpath += '%2F';
      }
      url = `https://${this.host}/api/v4/projects/${this.encodedRepo}/repository/files/${reqglpath}${encodeURIComponent(file.name)}/raw?ref=${this.encodedBranch}`;
       
    }
    
    return url;
  }
};
