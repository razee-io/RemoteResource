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

const loggerFactory = require('./bunyan-api');
const objectPath = require('object-path');
const request = require('request-promise-native');
const clone = require('clone');

const { BaseDownloadController } = require('@razee/razeedeploy-core');


module.exports = class RemoteResourceGitController extends BaseDownloadController {
  constructor(params) {
    params.finalizerString = params.finalizerString || 'children.remoteresource.deploy.razee.io';
    params.logger = params.logger || loggerFactory.createLogger('RemoteResourceGitController');
    super(params);
  }
  // ============ Download From git repo ============

  async download(reqOpt) {
    this.log.debug(`Download ${reqOpt.uri || reqOpt.url}`);
    let opt = clone(reqOpt);
    opt.simple = false;
    opt.resolveWithFullResponse = true;

    return await request(opt);
  }

  // ============ Git Specific Syntax ============
  async added() {
    const requests = objectPath.get(this.data, ['object', 'spec', 'requests'], []);
    const newRequests = [];
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      let reqOpt = clone(req.options);
      const optional = req.optional || false;
      const gitinfo = objectPath.get(req, 'options.git');
      
      if (gitinfo) {
        try {
          reqOpt = await this._fetchHeaderSecrets(reqOpt);
        } catch (e) {
          if (optional && e.code == 404) {
            this.log.warn(e.message);
            this.updateRazeeLogs('warn', { controller: 'RemoteResource', warn: e.message, repo: gitinfo.repo });
            this.log.debug(`skipping download for ${gitinfo.repo}`);
            continue;
          } else {
            return Promise.reject(e.message);
          }
        }

        const Git = require(`./git/${gitinfo.provider}`);
        const git = new Git(reqOpt);
        reqOpt = git.getAuthHeaders(reqOpt);
        try {
          let files = await request.get(git.getReqUrl(), { headers: reqOpt.headers });
          files = JSON.parse(files);
          files = git.getFileArray(files);
          for (let j = 0; j < files.length; j++) {
            const url = git.getFileUrl(files[j]);
            if (url) {
              reqOpt = { ...reqOpt, url: url };
              reqOpt = git.getAddlHeaders(reqOpt);
              const newReq = clone(req);
              newReq.options = reqOpt;
              newRequests.push(newReq);
            }
          }
        } catch (e) {
          if (optional) {
            this.log.warn(e.message);
            this.updateRazeeLogs('warn', { controller: 'RemoteResource', warn: e.message, repo: gitinfo.repo });
            this.log.debug(`skipping download for ${gitinfo.repo}`);
            continue;
          } else {
            return Promise.reject(e.message);
          }
        }
      } else {
        newRequests.push(req);
      }
    }
    
    if (newRequests.length > 0) {
      objectPath.set(this.data, ['object', 'spec', 'requests'], newRequests);
      let result = await super.added();
      return result;
    } else {
      this.log.debug('No files found.');
    }
  }

  // ============ =================== ============

};
