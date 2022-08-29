/**
 * Copyright 2021 IBM Corp. All Rights Reserved.
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

const request = require('request-promise-native');
const merge = require('deepmerge');
const loggerFactory = require('./bunyan-api');
const { BaseDownloadController } = require('@razee/razeedeploy-core');


module.exports = class RemoteResourceGitController extends BaseDownloadController {
  constructor(params) {
    params.finalizerString = params.finalizerString || 'children.remoteresource.deploy.razee.io';
    params.logger = params.logger || loggerFactory.createLogger('RemoteResourceGitController');
    super(params);
  }
  // ============ Download From Bucket ============

  async download(reqOpt) {
    let options = {};
    // special git logic
    let opt = merge(reqOpt, options);

    opt.simple = false;
    opt.resolveWithFullResponse = true;

    return await request(opt);
  }

  // ============ Git Specific Syntax ============


  // ============ =================== ============

};
