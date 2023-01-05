const assert = require('chai').assert;
const request = require('request-promise-native');
const sinon = require('sinon');
const xml2js = require('xml2js');
const { KubeClass } = require('@razee/kubernetes-util');
const { BaseDownloadController, MockKubeResourceMeta} = require('@razee/razeedeploy-core');
const Factory = require('../src/BackendServiceFactory');
const RemoteResourceController = require('../src/RemoteResourceController');
const RemoteResourceGitController = require('../src/RemoteResourceGitController');
const RemoteResourceS3Controller = require('../src/RemoteResourceS3Controller');

describe('#RemoteResource', async function() {
  beforeEach(function() {
    sinon.stub(request, 'get').callsFake(getFilesStub);
    sinon.stub(BaseDownloadController.prototype, 'added').callsFake(addedStub);
  });
  afterEach(function(done) {
    sinon.restore();
    done();
  });

  let getFilesStub = function () {
    let files = [{ name: 'test-config.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml'},
      { name: 'teset-config-update.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-update.yaml'},
      { name: 'test-config-falserec.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-falserec.yaml'}];

    files = JSON.stringify(files);
    return files;
  };

  let addedStub = function () {
    return;
  };

  let s3downloadStub = async function() {
    let body = {
      ListBucketResult: {
        '$': { xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/' },
        Name: [ 'bucket' ],
        Contents: [ 
          {
            Key: [ 'test-config.yaml' ]
          },
          {
            Key: [ 'test-config-update.yaml' ]
          },
          {
            Key: [ 'test-config-falserec.yaml' ]
          } 
        ]
      }
    };
    var builder = new xml2js.Builder();
    var xml = builder.buildObject(body);
    return { statusCode: 200, body: xml};
  };

  function setupController(eventData) {
    const log = require('../src/bunyan-api').createLogger('RemoteResource');
    const kc = new KubeClass();
    const resourceMeta = new MockKubeResourceMeta('deploy.razee.io/v1alpha2', 'RemoteResource');
    const params = {
      kubeResourceMeta: resourceMeta,
      eventData: eventData,
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
                ref: 'tests',
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
                ref: 'tests',
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
        iam: {
          url: 'https://iam.cloud.ibm.com/identity/token',
          grantType: 'urn:ibm:params:oauth:grant-type:apikey',
          apiKey: 'testApiKey'
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
        iam: {
          url: 'https://iam.cloud.ibm.com/identity/token',
          grantType: 'urn:ibm:params:oauth:grant-type:apikey',
          apiKey: 'testApiKey'
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

  it('Create generic RemoteResourceController', async function () {
    // backendServiceFactory should create RemoteResourceController for generic backendService
    const controller = setupController(eventData);
    assert(controller instanceof RemoteResourceController);
  });

  it('RRGitController single file request', async function() {
    // RRGitController added() should correctly assemble request option
    const controller = setupController(eventDataGit);
    assert(controller instanceof RemoteResourceGitController);
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests[0].options.url, 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml');
    assert.deepEqual(requests[0].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });
    assert(requests[0].splitRequestId);
  });

  it('RRGitController multiple files request', async function() {
    // RRGitController added() should correctly assemble request options for multiple files
    const controller = setupController(eventDataGit1);
    assert(controller instanceof RemoteResourceGitController);
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests.length, 3);
    assert.equal(requests[0].options.url, 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml');
    assert.deepEqual(requests[0].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });

    assert.equal(requests[1].options.url, 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-update.yaml');
    assert.deepEqual(requests[1].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });

    assert.equal(requests[2].options.url, 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-falserec.yaml');
    assert.deepEqual(requests[2].options.headers, { 'User-Agent': 'razee-io', Accept: 'application/octet-stream' });

    assert.equal(requests[0].splitRequestId, requests[1].splitRequestId);
    assert.equal(requests[0].splitRequestId, requests[2].splitRequestId);
  });

  it('RRS3Controller single file request', async function() {
    // RRS3Controller added() should correctly assemble request option
    const controller = setupController(eventDataS3);
    sinon.stub(controller, 'download').callsFake(s3downloadStub);
    assert(controller instanceof RemoteResourceS3Controller);
    await controller.added();

    assert.equal(controller.data, eventDataS3);
  });

  it('RRS3Controller multiple files request', async function() {
    // RRS3Controller added() should correctly assemble request options for multiple files
    const controller = setupController(eventDataS3_1);
    sinon.stub(controller, 'download').callsFake(s3downloadStub);
    assert(controller instanceof RemoteResourceS3Controller);
    await controller.added();
    const requests = controller.data.object.spec.requests;

    assert.equal(requests.length, 3);
    assert.equal(requests[0].options.url, 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config.yaml');
    assert.equal(requests[1].options.url, 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config-update.yaml');
    assert.equal(requests[2].options.url, 'https://s3.us.cloud-object-storage.appdomain.cloud/bucket/test-config-falserec.yaml');

    assert.equal(requests[0].splitRequestId, requests[1].splitRequestId);
    assert.equal(requests[0].splitRequestId, requests[2].splitRequestId);
  });
});
