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

const request = require('request-promise-native');
const clone = require('clone');
const objectPath = require('object-path');

const { BaseDownloadController } = require('@razee/razeedeploy-core');

module.exports = class RemoteResourceController extends BaseDownloadController {
  constructor(params) {
    params.finalizerString = params.finalizerString || 'children.remoteresource.deploy.razee.io';
    super(params);
  }

  async added() {
    let requests = objectPath.get(this.data, ['object', 'spec', 'requests'], []);
    let newRequests = [];
    for (let i = 0; i < requests.length; i++) {
      let r = requests[i];
      let headers = objectPath.get(r, 'options.headers');
      if (headers) {
        let headerKeysList = Object.keys(headers);
        for (let j = 0; j < headerKeysList.length; j++) {
          let headerName = headerKeysList[j];
          let headerObject = headers[headerName];
          let secretRef = objectPath.get(headerObject, 'valueFrom.secretKeyRef');
          if (secretRef) {
            let secretValue = await this._fetchHeaderSecret(secretRef);
            headers[headerName] = secretValue;
          }
        }
        objectPath.set(r, 'options.headers', headers);
      }
      newRequests.push(r);
    }
    objectPath.set(this.data, ['object', 'spec', 'requests'], newRequests);
    let result = await super.added();
    return result;
  }

  async _fetchHeaderSecret(secretKeyRef) {
    let secretName = objectPath.get(secretKeyRef, 'name');
    let secretNamespace = objectPath.get(secretKeyRef, 'namespace', this.namespace);
    let secretKey = objectPath.get(secretKeyRef, 'key');
    let secretValue = await this._getSecretData(secretName, secretKey, secretNamespace);
    if (!secretValue) {
      throw Error('Unable to get secret data');
    }
    return secretValue;
  }

  async _getSecretData(name, key, ns) {
    let res = await this.kubeResourceMeta.request({ uri: `/api/v1/namespaces/${ns || this.namespace}/secrets/${name}`, json: true });
    let apiKey = Buffer.from(objectPath.get(res, ['data', key], ''), 'base64').toString();
    return apiKey;
  }

  async download(reqOpt) {
    this.log.debug(`Download ${reqOpt.uri || reqOpt.url}`);
    let opt = clone(reqOpt);
    opt.simple = false;
    opt.resolveWithFullResponse = true;

    return await request(opt);
  }


};
