/**
 * Copyright 2019 IBM Corp. All Rights Reserved.
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

const objectPath = require('object-path');
const request = require('request-promise-native');
const clone = require('clone');
const octokit = require('@octokit/request');
const gitFactory = require('./git');

const { BaseDownloadController } = require('@razee/razeedeploy-core');


module.exports = class RemoteResourceController extends BaseDownloadController {
  constructor(params) {
    params.finalizerString = params.finalizerString || 'children.remoteresource.deploy.razee.io';
    super(params);
  }

  async added() {
    let requests = objectPath.get(this.data, ['object', 'spec', 'requests'], []);
    let newRequests = [];
    for (var i = 0; i < requests.length; i++) {
      let req = requests[i];
      let reqOpt = clone(req.options);
      let optional = req.optional || false;
      const gitinfo = objectPath.get(req, 'options.git');
      let files;
      let git;
      
      if (gitinfo) {
        try {
          reqOpt = await this._fetchHeaderSecrets(reqOpt);
        } catch (e) {
          // error fetching header secrets
          if (optional) {
            this.log.warn(e.message);
            this.updateRazeeLogs('warn', { controller: 'RemoteResource', warn: e.message, repo: git.repo });
            this.log.debug(`skipping download for ${git.repo}`);
            continue; // shouldnt continue to try to download if unable to get secret headers
          } else {
            return Promise.reject(e.message);
          }
        }
        git = gitFactory.createGit(reqOpt);
        files = await octokit.request(git.requrl, { headers: reqOpt.headers });
      } else {
        newRequests.push(req);
      }

      if (files) {
        for (var j = 0; j < files.data.length; j++) {
          let url = git.getUrl(files.data[j]);
          if (url) {
            reqOpt = { ...reqOpt, url: url };
            let newReq = clone(req);
            newReq.options = reqOpt;
            newRequests.push(newReq);
          }
        }
      }
    }

    objectPath.set(this.data, ['object', 'spec', 'requests'], newRequests);
    let result = await super.added();
    return result;
  }

  async download(reqOpt) {
    this.log.debug(`Download ${reqOpt.uri || reqOpt.url}`);
    let opt = clone(reqOpt);
    opt.simple = false;
    opt.resolveWithFullResponse = true;

    return await request(opt);
  }


};
