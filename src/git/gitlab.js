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
    this._repo = encodeURIComponent(this._repo);
    this._path = encodeURIComponent(this._path);
  }

  getReqUrl() { 
    return `https://${this._host}/api/v4/projects/${this._repo}/repository/tree/?path=${this._path}&ref=${this._branch}`;
  }

  getAuthHeaders(reqOpt) {
    if (reqOpt.headers.Authorization && !reqOpt.headers.Authorization.includes('Bearer')) {
      reqOpt.headers = { ...reqOpt.headers, Authorization: 'Bearer ' + reqOpt.headers.Authorization };
    }
    return reqOpt;
  }

  getFileUrl(file) {
    let url;
    if (parsePath(file.name).ext == this._fileExt || file.name == this._filename || this._fileExt == '') {
      let reqglpath = this._path;
      if (this._path != '' && !this._path.endsWith('%2F')) {
        reqglpath = this._path + '%2F';
      }
      url = `https://${this._host}/api/v4/projects/${this._repo}/repository/files/${reqglpath}${file.name}/raw?ref=${this._branch}`;
       
    }
    
    return url;
  }
};
