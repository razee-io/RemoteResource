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
const octokit = require('@octokit/request');

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
          // error fetching header secrets
          if (optional) {
            this.log.warn(e.message);
            this.updateRazeeLogs('warn', { controller: 'RemoteResource', warn: e.message, repo: gitinfo.repo });
            this.log.debug(`skipping download for ${gitinfo.repo}`);
            continue; // shouldnt continue to try to download if unable to get secret headers
          } else {
            return Promise.reject(e.message);
          }
        }

        const Git = require(`./git/${gitinfo.provider}`);
        const git = new Git(reqOpt);
        reqOpt = git.getAuthHeaders(reqOpt);
        try {
          const files = await octokit.request(git.getReqUrl(), { headers: reqOpt.headers });
          for (let j = 0; j < files.data.length; j++) {
            const url = git.getFileUrl(files.data[j]);
            if (url) {
              reqOpt = { ...reqOpt, url: url };
              const newReq = clone(req);
              newReq.options = reqOpt;
              newRequests.push(newReq);
            }
          }
        } catch (e) {
          this.log.warn(e.message);
          this.updateRazeeLogs('warn', { controller: 'RemoteResource', warn: e.message, repo: gitinfo.repo });
          this.log.debug(`skipping download for ${gitinfo.repo}`);
          continue;
        }
      } else {
        newRequests.push(req);
      }
    }

    objectPath.set(this.data, ['object', 'spec', 'requests'], newRequests);
    let result = await super.added();
    return result;
  }

  // ============ =================== ============

};
