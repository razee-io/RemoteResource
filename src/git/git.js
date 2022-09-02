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

const gh = require('parse-github-url');
const parsePath = require('parse-filepath');

module.exports = class Git {
  constructor(reqOpt) {
    const gitinfo = reqOpt.git;

    const parse = gh(gitinfo.repo);
    this._host = parse.host;
    this._repo = parse.repo;
    this._owner = parse.owner;
    this._branch = gitinfo.branch;
    const pattern = parsePath(gitinfo.filePath);
    if (pattern.ext == '') {
      if (gitinfo.filePath.endsWith('*')) {
        this._path = pattern.dir;
      } else {
        this._path = pattern.path;
      }
      this._fileExt = pattern.ext;
    } else {
      if (pattern.stem == '*') {
        this._fileExt = pattern.ext;
      } else {
        this._filename = pattern.base;
      }
      this._path = pattern.dir;
    }
    if (this._path.endsWith('/')) {
      this._path = this._path.slice(0, -1);
    }
  }

  get host(){
    return this._host;
  }
  
  get repo(){
    return this._repo;
  }
  
  get owner(){
    return this._owner;
  }
  
  get branch() {
    return this._branch;
  }
  
  get path() {
    return this._path;
  }
  
  get fileExt() {
    return this._fileExt;
  }
  
  get filename() {
    return this._filename;
  }

  set repo(repo) {
    this._repo = repo;
  }

  set path(path) {
    this._path = path;
  }
};
