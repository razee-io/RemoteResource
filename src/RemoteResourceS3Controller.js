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

const objectPath = require('object-path');
const RequestLib = require('@razee/request-util');
const hash = require('object-hash');
const axios = require('axios');
const merge = require('deepmerge');
const xml2js = require('xml2js');
const clone = require('clone');
const loggerFactory = require('./bunyan-api');
const { BaseDownloadController } = require('@razee/razeedeploy-core');

// Creating outside class definition so only one instance is created and used for all events
const iamTokenCache = {};


module.exports = class RemoteResourceS3Controller extends BaseDownloadController {
  constructor(params) {
    params.finalizerString = params.finalizerString || 'children.remoteresource.deploy.razee.io';
    params.logger = params.logger || loggerFactory.createLogger('RemoteResourceS3Controller');
    super(params);
  }
  // ============ Download From Bucket ============

  async added() {
    let requests = objectPath.get(this.data, ['object', 'spec', 'requests'], []);
    let newRequests = [];
    for (let i = 0; i < requests.length; i++) {
      let r = requests[i];
      const url = new URL(objectPath.get(r, 'options.url'));
      if (url.pathname.endsWith('/')) { //This is an S3 bucket
        let additionalRequests = await this._getBucketObjectRequestList(r);
        additionalRequests.forEach( newReq => newReq.splitRequestId = hash(r) ); // By setting splitRequestId, all requests split from a single original request will all be attempted before allowing failures to abort
        newRequests = newRequests.concat(additionalRequests);
      } else {
        newRequests.push(r);
      }
    }
    objectPath.set(this.data, ['object', 'spec', 'requests'], newRequests);
    let result = await super.added();
    return result;
  }

  async download(reqOpt) {
    let hmac = objectPath.get(this.data, ['object', 'spec', 'auth', 'hmac']);
    let iam = objectPath.get(this.data, ['object', 'spec', 'auth', 'iam']);
    let options = {};
    if (hmac) {
      let { accessKeyId, secretAccessKey } = await this._fetchHmacSecrets(hmac);
      objectPath.set(options, 'aws.key', accessKeyId);
      objectPath.set(options, 'aws.secret', secretAccessKey);
    } else if (iam) {
      let bearerToken = await this._fetchS3Token(iam);
      objectPath.set(options, 'headers.Authorization', `bearer ${bearerToken}`);
    }
    let opt = merge(reqOpt, options);
    this.log.debug(`Download ${opt.uri || opt.url}`);

    opt.simple = false;
    opt.resolveWithFullResponse = true;

    return await RequestLib.doRequest(opt, this.log);
  }

  // ============ Bucket Specific Syntax ============

  async _fixUrl(url) {
    const u = new URL(url);
    if (u.hostname.startsWith('s3.')) { //The bucket name is part of the path
      let pathSegments = u.pathname.split('/');
      pathSegments.shift(); //Discard the leading slash
      u.pathname = pathSegments.shift();
      u.search = `prefix=${pathSegments.join('/')}`;
    } else { //The bucket name is part of the hostname
      let hostnameSegments = u.hostname.split('.');
      let bucket = hostnameSegments.shift();
      u.hostname = hostnameSegments.join('.');
      let prefix = u.pathname.slice(1, u.pathname.length);
      u.search = `prefix=${prefix}`;
      u.pathname = bucket;
    }
    if (u.pathname === '/') {
      this.log.error(`No bucket name found for ${url}`);
      return Promise.reject({ statusCode: 500, uri: url, message: `Error getting bucket name from ${url}` });
    }
    return u.toString();
  }

  async _getBucketObjectRequestList(bucketRequest) {
    const result = [];
    const bucketUrl = objectPath.get(bucketRequest, 'options.url', objectPath.get(bucketRequest, 'options.uri'));
    objectPath.del(bucketRequest, 'options.uri');
    const url = await this._fixUrl(bucketUrl);
    objectPath.set(bucketRequest, 'options.url', url);
    const objectListResponse = await this.download(bucketRequest.options);
    if (objectListResponse.statusCode >= 200 && objectListResponse.statusCode < 300) {
      this.log.debug(`Download ${objectListResponse.statusCode} ${url}`);
      const objectListString = objectListResponse.body;
      const parser = new xml2js.Parser();
      try {
        const objectList = await parser.parseStringPromise(objectListString);
        const xmlns = objectPath.get(objectList, 'ListBucketResult.$.xmlns');
        if (xmlns !== 'http://s3.amazonaws.com/doc/2006-03-01/') {
          this.log.warn(`Unexpected S3 bucket object list namespace of ${xmlns}.`);
        }
        let bucket = objectPath.get(objectList, 'ListBucketResult.Name');
        let objectsArray = objectPath.get(objectList, 'ListBucketResult.Contents', []);
        objectsArray.forEach((o) => {
          const objectKey = objectPath.get(o, 'Key.0');
          const reqClone = clone(bucketRequest);
          const newUrl = new URL(url);
          newUrl.pathname = `${bucket}/${objectKey}`;
          newUrl.searchParams.delete('prefix');
          objectPath.set(reqClone, 'options.url', newUrl.toString());
          result.push(reqClone);
        });
      } catch (err) {
        this.log.error(err, `Error getting bucket listing for ${url}`);
        return Promise.reject({ statusCode: 500, uri: url, message: `Error getting bucket listing for ${url}` });
      }
    } else {
      this.log.error(`Download failed: ${objectListResponse.statusCode} | ${url}`);
      return Promise.reject({ statusCode: objectListResponse.statusCode, uri: url });
    }
    if (result.length === 0) {
      this.log.error(`Error getting resources for ${url}, no resources found.`);
      return Promise.reject({ statusCode: 404, uri: url, message: `Error getting resources for ${url}, no resources found.` });
    }
    return result;
  }

  // ============ Fetch Secrets ============

  async _fetchHmacSecrets(hmac) {
    let akid;
    let akidStr = objectPath.get(hmac, 'accessKeyId');
    let akidRef = objectPath.get(hmac, 'accessKeyIdRef');

    if (typeof akidStr == 'string') {
      akid = akidStr;
    } else if (typeof akidRef == 'object') {
      let secretName = objectPath.get(akidRef, 'valueFrom.secretKeyRef.name');
      let secretNamespace = objectPath.get(akidRef, 'valueFrom.secretKeyRef.namespace', this.namespace);
      let secretKey = objectPath.get(akidRef, 'valueFrom.secretKeyRef.key');
      akid = await this._getSecretData(secretName, secretKey, secretNamespace);
    }
    if (!akid) {
      throw Error('Must have an access key id when using HMAC');
    }

    let sak;
    let sakStr = objectPath.get(hmac, 'secretAccessKey');
    let sakRef = objectPath.get(hmac, 'secretAccessKeyRef');

    if (typeof sakStr == 'string') {
      sak = sakStr;
    } else if (typeof sakRef == 'object') {
      let secretName = objectPath.get(sakRef, 'valueFrom.secretKeyRef.name');
      let secretNamespace = objectPath.get(sakRef, 'valueFrom.secretKeyRef.namespace', this.namespace);
      let secretKey = objectPath.get(sakRef, 'valueFrom.secretKeyRef.key');
      sak = await this._getSecretData(secretName, secretKey, secretNamespace);
    }
    if (!sak) {
      throw Error('Must have a secret access key when using HMAC');
    }

    return { accessKeyId: akid, secretAccessKey: sak };
  }

  async _fetchS3Token(iam) {
    let apiKey;
    let apiKeyStr = objectPath.get(iam, 'apiKey');
    let apiKeyRef = objectPath.get(iam, 'apiKeyRef');

    if (typeof apiKeyStr == 'string') {
      apiKey = apiKeyStr;
    } else if (typeof apiKeyRef == 'object') {
      let secretName = objectPath.get(apiKeyRef, 'valueFrom.secretKeyRef.name');
      let secretNamespace = objectPath.get(apiKeyRef, 'valueFrom.secretKeyRef.namespace', this.namespace);
      let secretKey = objectPath.get(apiKeyRef, 'valueFrom.secretKeyRef.key');
      apiKey = await this._getSecretData(secretName, secretKey, secretNamespace);
    }
    if (!apiKey) {
      return Promise.reject('Failed to find valid apikey to authenticate against iam');
    }

    let res = await this._requestToken(iam, apiKey);
    return res.access_token;
  }


  async _requestToken(iam, apiKey) {
    const apiKeyHash = hash(apiKey, { algorithm: 'shake256' });
    let token = iamTokenCache?.[apiKeyHash];
    if (token !== undefined) {
      const expires = token?.expiration ?? 0; // expiration: time since epoch in seconds
      // re-use cached token as long as we are more than 2 minutes away from expiring.
      if (Date.now() < (expires - 120) * 1000) {
        return token;
      }
    }

    try {
      let res = await axios({
        method: 'post',
        url: iam.url, // 'https://iam.cloud.ibm.com/identity/token',
        params: {
          'grant_type': iam.grantType, // 'urn:ibm:params:oauth:grant-type:apikey',
          'apikey': apiKey
        },
        // data: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 60000
      });
      token = res.data;
      iamTokenCache[apiKeyHash] = token;
      return token;
    } catch (err) {
      const error = Buffer.isBuffer(err) ? err.toString('utf8') : err;
      return Promise.reject(error.toJSON());
    }
  }

  async _getSecretData(name, key, ns) {
    let res = await this.kubeResourceMeta.request({ uri: `/api/v1/namespaces/${ns || this.namespace}/secrets/${name}`, json: true });
    let secretKeyData = Buffer.from(objectPath.get(res, ['data', key], ''), 'base64').toString();
    return secretKeyData;
  }


};
