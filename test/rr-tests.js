/**
 * Copyright 2023 IBM Corp. All Rights Reserved.
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

const assert = require('chai').assert;
const sinon = require('sinon');
const nock = require('nock');
const xml2js = require('xml2js');
const hash = require('object-hash');
const clone = require('clone');
const { KubeClass } = require('@razee/kubernetes-util');
const { BaseDownloadController, MockKubeResourceMeta} = require('@razee/razeedeploy-core');
const Factory = require('../src/BackendServiceFactory');
const RemoteResourceController = require('../src/RemoteResourceController');
const RemoteResourceGitController = require('../src/RemoteResourceGitController');
const RemoteResourceS3Controller = require('../src/RemoteResourceS3Controller');

describe('#RemoteResource', async function() {
  beforeEach(function() {
    sinon.stub(BaseDownloadController.prototype, 'added').callsFake(addedStub);
  });

  afterEach(function(done) {
    sinon.restore();
    nock.cleanAll();
    done();
  });

  function addedStub() {
    return;
  }

  const files = JSON.stringify([{ name: 'test-config.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml'},
    { name: 'teset-config-1.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-1.yaml'},
    { name: 'test-config-2.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-2.yaml'}]);

  const body = {
    ListBucketResult: {
      '$': { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
      Name: [ 'bucket' ],
      Contents: [ 
        {
          Key: [ 'test-config.yaml' ]
        },
        {
          Key: [ 'test-config-1.yaml' ]
        },
        {
          Key: [ 'test-config-2.yaml' ]
        } 
      ]
    }
  };
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(body);

  function setupController(eventData) {
    const log = require('../src/bunyan-api').createLogger('RemoteResource');
    const kc = new KubeClass();
    const resourceMeta = new MockKubeResourceMeta('deploy.razee.io/v1alpha2', 'RemoteResource');
    const params = {
      kubeResourceMeta: resourceMeta,
      eventData: clone(eventData),
      kubeClass: kc,
      logger: log
    };

    const factory = new Factory(params);
    const Controller = require(`../src/${factory.controllerString}Controller`);
    const controller = new Controller(params);
    return controller;
  }

  const eventData = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr',
        namespace: 'default'
      },
      spec: {
        clusterAuth: {
          impersonateUser: 'razeedeploy'
        },
        backendService: 'generic',
        requests: [
          {
            options: {
              url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml'
            }
          }
        ]
      }
        
    }
  };

  const eventDataGit = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr',
        namespace: 'default'
      },
      spec: {
        clusterAuth: {
          impersonateUser: 'razeedeploy'
        },
        backendService: 'git',
        requests: [
          {
            options: {
              git: {
                provider: 'github',
                repo: 'https://github.com/razee-io/RemoteResource.git',
                ref: 'main',
                filePath: 'test/test-configs/test-config.yaml'
              }
            }
          }
        ]
      }
        
    }
  };

  const eventDataGit1 = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr',
        namespace: 'default'
      },
      spec: {
        clusterAuth: {
          impersonateUser: 'razeedeploy'
        },
        backendService: 'git',
        requests: [
          {
            options: {
              git: {
                provider: 'github',
                repo: 'https://github.com/razee-io/RemoteResource.git',
                ref: 'main',
                filePath: 'test/test-configs/*.yaml'
              }
            }
          }
        ]
      }
        
    }
  };

  const eventDataS3 = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr',
        namespace: 'default'
      },
      spec: {
        clusterAuth: {
          impersonateUser: 'razeedeploy'
        },
        backendService: 's3',
        auth: {
          iam: {
            url: 'https://iam.cloud.ibm.com/identity/token',
            grantType: 'urn:ibm:params:oauth:grant-type:apikey',
            apiKey: 'testApiKey'
          }
        },
        requests: [
          {
            options: {
              url: 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config.yaml'
            }
          }
        ]
      }
        
    }
  };

  const eventDataS3_1 = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr',
        namespace: 'default'
      },
      spec: {
        clusterAuth: {
          impersonateUser: 'razeedeploy'
        },
        backendService: 's3',
        auth: {
          iam: {
            url: 'https://iam.cloud.ibm.com/identity/token',
            grantType: 'urn:ibm:params:oauth:grant-type:apikey',
            apiKey: 'testApiKey'
          }
        },
        requests: [
          {
            options: {
              url: 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/'
            }
          }
        ]
      }
        
    }
  };

  const eventDataS3_1_fixedUrl_request = {
    options: {
      url: 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket?prefix='
    }
  };

  // the download urls are real, but the requests are stubbed
  const gitUrls = ['https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml', 
    'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-1.yaml',
    'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-2.yaml'];
  
  const s3Urls = ['https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config.yaml',
    'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config-1.yaml',
    'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config-2.yaml'];

  it('Create generic RemoteResourceController', async function () {
    // backendServiceFactory should create RemoteResourceController for generic backendService
    const controller = setupController(eventData);
    assert(controller instanceof RemoteResourceController);
  });

  it('RRGitController single file request', async function() {
    // RRGitController added() should correctly assemble request option 
    nock('https://api.github.com')
      .get('/repos/razee-io/RemoteResource/contents/test/test-configs?ref=main')
      .reply(200, files);

    const controller = setupController(eventDataGit);
    assert(controller instanceof RemoteResourceGitController);
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests[0].options.url, 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml'); // the download url is real, but request is stubbed
    assert.deepEqual(requests[0].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });
    assert(requests[0].splitRequestId);
  });

  it('RRGitController get files error', async function() {
    // RRGitController should error if files not found
    nock('https://api.github.com')
      .get('/repos/razee-io/RemoteResource/contents/test/test-configs?ref=main')
      .reply(404, 'file not found');
    try {
      const controller = setupController(eventDataGit);
      assert(controller instanceof RemoteResourceGitController);
      await controller.added();
      assert.fail('should have thrown an error');
    } catch (e) {
      assert.equal(e, '404 - "file not found"');
    }
  });

  it('RRGitController multiple files request', async function() {
    // RRGitController added() should correctly assemble request options for multiple files
    nock('https://api.github.com')
      .get('/repos/razee-io/RemoteResource/contents/test/test-configs?ref=main')
      .reply(200, files);

    const controller = setupController(eventDataGit1);
    assert(controller instanceof RemoteResourceGitController);
    const sri = hash(eventDataGit1.object.spec.requests[0]);
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests.length, 3);
    for (let i = 0; i < requests.length; i++) {
      assert.equal(requests[i].options.url, gitUrls[i]);
      assert.deepEqual(requests[i].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });
      assert.equal(requests[i].splitRequestId, sri); // splitRequestIds should be the same to ensure applying all files in the group is attempted
    }
  });

  it('RRS3Controller single file request', async function() {
    // RRS3Controller added() should correctly assemble request option
    const controller = setupController(eventDataS3);
    assert(controller instanceof RemoteResourceS3Controller);
    await controller.added();

    assert.deepEqual(controller.data, eventDataS3);
  });

  it('RRS3Controller multiple files request', async function() {
    // RRS3Controller added() should correctly assemble request options for multiple files
    nock('https://iam.cloud.ibm.com/identity/token')
      .post('?grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=testApiKey')
      .reply(200, { access_token: 'testAccessToken'});
    
    nock('https://s3.us.cloud-object-storage.appdomain.cloud')
      .get('/bucket?prefix=')
      .reply(200, xml);

    const controller = setupController(eventDataS3_1);
    assert(controller instanceof RemoteResourceS3Controller);
    const sri = hash(eventDataS3_1_fixedUrl_request); //S3 fixes url before hashing for splitRequestId
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests.length, 3);
    for (let i = 0; i < requests.length; i++) {
      assert.equal(requests[i].options.url, s3Urls[i]);
      assert.equal(requests[i].splitRequestId, sri); // splitRequestIds should be the same to ensure applying all files in the group is attempted
    }
  });

  it('RRS3Controller access token error', async function() {
    // RRS3Controller added() should correctly assemble request options for multiple files
    nock('https://iam.cloud.ibm.com/identity/token')
      .post('?grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=testApiKey')
      .reply(404);
    
    nock('https://s3.us.cloud-object-storage.appdomain.cloud')
      .get('/bucket?prefix=')
      .reply(200, xml);

    try {
      const controller = setupController(eventDataS3_1);
      assert(controller instanceof RemoteResourceS3Controller);
      await controller.added();
      assert.fail('should have thrown an error');
    } catch(e) {
      assert.equal(e.status, 404);
    }
  });

  it('RRS3Controller get files error', async function() {
    // RRS3Controller added() should correctly assemble request options for multiple files
    nock('https://iam.cloud.ibm.com/identity/token')
      .post('?grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=testApiKey')
      .reply(200, { access_token: 'testAccessToken'});
    
    nock('https://s3.us.cloud-object-storage.appdomain.cloud')
      .get('/bucket?prefix=')
      .reply(404);

    try {
      const controller = setupController(eventDataS3_1);
      assert(controller instanceof RemoteResourceS3Controller);
      await controller.added();
      assert.fail('should have thrown an error');
    } catch(e) {
      assert.equal(e.statusCode, 404);
    }
  });
});
