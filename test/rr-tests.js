const assert = require('chai').assert;
const { KubeClass } = require('@razee/kubernetes-util');
const clone = require('clone');
const objectPath = require('object-path');
const sinon = require('sinon');
const fs = require('fs-extra');
const xml2js = require('xml2js');
const MockKRM = require('./MockKRM');
const request = require('request-promise-native');
let krmCache = [];

describe('#RemoteResourceController', async function() {
  beforeEach(function() {
    sinon.stub(request, 'get').callsFake(getFilesStub);
  });
  afterEach(function(done) {
    sinon.restore();
    krmCache = [];
    done();
  });

  let getFilesStub = function () {
    let files = [{ name: 'test-config.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config.yaml'},
      { name: 'teset-config-update.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-update.yaml'},
      { name: 'test-config-falserec.yaml', download_url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-falserec.yaml'}];

    files = JSON.stringify(files);
    return files;
    
  };

  let downloadStub = async function(reqOpt) {
    if (reqOpt.url.endsWith('yaml')) {
      let split = reqOpt.url.split('/');
      let filename = split[split.length -1];
      const file = await fs.readFile(`test/test-configs/${filename}`);
      return {statusCode: 200, body: file};
    } else { // for s3
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
    }
  };

  let deleteStub = async function (child) {
    // only deletes configmap
    this.log.info(`Delete ${child}`);
    let opt = { uri: child, simple: false, resolveWithFullResponse: true, method: 'DELETE' };
    const krm = this.kubeClass.getKubeResourceMeta('v1', 'ConfigMap');
    
    let res = await krm.request(opt);
    if (res.statusCode === 404) {
      this.log.debug(`Delete ${res.statusCode} ${opt.uri || opt.url}`);
      return { statusCode: res.statusCode, body: res.body };
    } else if (res.statusCode !== 200) {
      this.log.debug(`Delete ${res.statusCode} ${opt.uri || opt.url}`);
      return Promise.reject({ statusCode: res.statusCode, body: res.body });
    }

    this.log.debug(`Delete ${res.statusCode} ${opt.uri || opt.url}`);
    return { statusCode: res.statusCode, body: res.body };
  };

  let patchStub = async function(child) {
    this.log.info(`Patch ${child}`);

    let split = child.split('/');

    const krm = await this.kubeClass.getKubeResourceMeta('v1', 'ConfigMap', 'update');

    const patchObj = {
      metadata: {
        annotations: {
          'deploy.razee.io.parent': null
        }
      }
    };

    let res = await krm.mergePatch(split[2], split[1], patchObj, {simple: false, resolveWithFullResponse: true});
    return { statusCode: res.statusCode, body: res.body };
  
  };

  let getKRMstub = function(apiVersion, kind, verb, kubeData = {}) {
    let krm;
    krmCache.forEach((k) => {
      if (k._apiVersion == apiVersion && k._kind == kind) {
        krm = k;
        if (kind == 'RemoteResource' && Object.keys(kubeData).length > 0) {
          let url = Object.keys(kubeData)[0];
          let reqOpt = { uri: url, method: 'GET'};
          let res = krm.request(reqOpt);
          if (res.statusCode != 200 ) {
            krm.post(kubeData[url].object);
          } else {
            krm.kubeData = kubeData;
          }
        }
      }
    });
    
    if (!krm) {
      krm = new MockKRM(apiVersion, kind, kubeData);
      krmCache.push(krm);
    }
    return krm;
  };

  function setupController(eventData, url = '/default/rr') {
    const backendService = objectPath.get(eventData, 'object.spec.backendService', '').toLowerCase();
    let controllerString = 'RemoteResource';
    if (backendService == 's3') controllerString = 'RemoteResourceS3';
    if (backendService == 'git') controllerString = 'RemoteResourceGit';

    const log = require('../src/bunyan-api').createLogger(controllerString);

    const kc = new KubeClass();
    sinon.stub(kc, 'getKubeResourceMeta').callsFake(getKRMstub);

    let kubeData = {};
    kubeData[url] = clone(eventData);

    let resourceMeta = kc.getKubeResourceMeta('deploy.razee.io/v1alpha2', controllerString, '', kubeData);

    eventData.type = 'ADDED';
    let params = {
      kubeResourceMeta: resourceMeta,
      eventData: eventData,
      kubeClass: kc,
      logger: log
    };

    const Controller = require(`../src/${controllerString}Controller`);
    const controller = new Controller(params);
    sinon.stub(controller, 'download').callsFake(downloadStub);
    sinon.stub(controller, '_deleteChild').callsFake(deleteStub);
    sinon.stub(controller, '_patchChild').callsFake(patchStub);
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

  const requestupdate = [
    {
      options: {
        url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-update.yaml'
      }  
    }
  ];

  const eventData1 = {
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
          },
          {
            options: {
              url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-update.yaml'
            }
          }
        ]
      }
        
    }
  };

  const eventData2 = {
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
              url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/test-config-falserec.yaml'
            }
          }
        ]
      }
        
    }
  };

  const eventData3 = {
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
              url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/invalid-config.yaml'
            }
          }
        ]
      }
        
    }
  };

  const eventData4 = {
    object: {
      apiVersion: 'deploy.razee.io/v1alpha2',
      kind: 'RemoteResource',
      metadata: {
        name: 'rr1',
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

  const eventData5 = {
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
              url: 'https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/invalid-config.yaml'
            },
            optional: true
          },
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
  
  it('Apply single request option', async function () {
    const controller = setupController(eventData);
    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
  });

  it('Update single request option reconcile children', async function () {
    const controller = setupController(eventData);

    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

    // update request option
    let eventDataUpdate = clone(krmCache[0].kubeData['/default/rr']);
    objectPath.set(eventDataUpdate, ['object', 'spec', 'requests'], requestupdate);

    const controller1 = setupController(eventDataUpdate);
    await controller1.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // new child is indicated on parent
    assert.isNull(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // old child removed from parent
    assert(krmCache[1].kubeData['/default/config-test-update']); // new child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'], undefined); // old child deleted
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // new child has parent link
  });

  it('Multiple request options', async function () {
    const controller = setupController(eventData1);

    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
    assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
    assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link
  });

  it('Update single request option reconcile children false', async function () {
    const controller = setupController(eventData2);

    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

    let eventDataUpdate = clone(krmCache[0].kubeData['/default/rr']);
    objectPath.set(eventDataUpdate, ['object', 'spec', 'requests'], requestupdate);

    const controller1 = setupController(eventDataUpdate);

    await controller1.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // new child is indicated on parent
    assert.isNull(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // old child removed from parent
    assert(krmCache[1].kubeData['/default/config-test-update']); // new child applied
    assert(krmCache[1].kubeData['/default/config-test'], undefined); // old child still exists
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // new child has parent link
    assert.isNull(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent']); // old child parent link removed
  });

  it('Invalid file should error', async function () {
    const controller = setupController(eventData3);

    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['06f4c168242dd60e347e977a1b179aabead9038f']); // should have no such file error hash
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['06f4c168242dd60e347e977a1b179aabead9038f'], 'uri: https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/invalid-config.yaml, statusCode: undefined, message: ENOENT: no such file or directory, open \'test/test-configs/invalid-config.yaml\'');
  });

  it('Multiple parents applying same child should skip apply', async function () {
    const controller = setupController(eventData);
    await controller.execute();

    const controller1 = setupController(eventData4, '/default/rr1');
    await controller1.execute();
  
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[0].kubeData['/default/rr1'].status.children, undefined); // child not indicated on second parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has first parent link
  });

  it('Requests with optional flag should attempt apply all', async function () {
    const controller = setupController(eventData5);

    await controller.execute();
    
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].warn['485f9f111adca66ff5a65f9e820bd88407af8147'].warn, '1 optional resource(s) failed to process.. skipping reconcileChildren'); // logs should have optional failure warnings
  });

  describe('#RRGitController', async function() { 
    it('Apply single github request option', async function () {
      const controller = setupController(eventDataGit);
      await controller.execute();
  
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
      assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
      assert(krmCache[1].kubeData['/default/config-test']); //child applied
      assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    });
  
    it('Apply github request option with multiple files', async function () {
      const controller = setupController(eventDataGit1);
      await controller.execute();
  
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
      assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
      assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
      assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
      assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link
    });
  });

  describe('#RRGitController', async function() { 
    it('Apply single s3 request option', async function () {
      const controller = setupController(eventDataS3);
      await controller.execute();
  
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
      assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
      assert(krmCache[1].kubeData['/default/config-test']); //child applied
      assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    });

    it('Apply s3 request option with multiple files', async function () {
      const controller = setupController(eventDataS3_1);
      await controller.execute();
  
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
      assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
      assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
      assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
      assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
      assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link
    });
  });
});
