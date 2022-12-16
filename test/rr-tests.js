const assert = require('chai').assert;
// const Controller = require('../lib/MockRRController');
// const GitController = require('../lib/MockRRGitController');
const Controller = require('../src/RemoteResourceController');
// const Controller = require('../src/BackendServiceFactory');
const ControllerString = 'RemoteResource';
const log = require('../src/bunyan-api').createLogger(ControllerString);
const { KubeClass } = require('@razee/kubernetes-util');

// const rewire = require('rewire');
const clone = require('clone');
const objectPath = require('object-path');
const sinon = require('sinon');
const fs = require('fs-extra');
const MockKRM = require('./MockKRM');

let krmCache = [];


describe('#RemoteResourceController', async function() {
  let downloadStub = async function(reqOpt) {
    let split = reqOpt.url.split('/');
    let filename = split[split.length -1];
    const file = await fs.readFile(`test/test-configs/${filename}`);
    return {statusCode: 200, body: file};
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
    const kc = new KubeClass();
    sinon.stub(kc, 'getKubeResourceMeta').callsFake(getKRMstub);

    let kubeData = {};
    kubeData[url] = clone(eventData);

    let resourceMeta = kc.getKubeResourceMeta('deploy.razee.io/v1alpha2', ControllerString, '', kubeData);

    eventData.type = 'ADDED';
    let params = {
      kubeResourceMeta: resourceMeta,
      eventData: eventData,
      kubeClass: kc,
      logger: log
    };

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
  
  it('Apply single request option', async function () {
    const controller = setupController(eventData);
    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    
    krmCache = [];
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

    krmCache = [];
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

    krmCache = [];
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

    krmCache = [];
  });

  it('Invalid file should error', async function () {
    const controller = setupController(eventData3);

    await controller.execute();

    assert(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['06f4c168242dd60e347e977a1b179aabead9038f']); // should have no such file error hash
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['06f4c168242dd60e347e977a1b179aabead9038f'], 'uri: https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/invalid-config.yaml, statusCode: undefined, message: ENOENT: no such file or directory, open \'test/test-configs/invalid-config.yaml\'');
    krmCache = [];
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

    krmCache = [];
  });

  it('Requests with optional flag should attempt apply all', async function () {
    const controller = setupController(eventData5);

    await controller.execute();
    
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].warn['485f9f111adca66ff5a65f9e820bd88407af8147'].warn, '1 optional resource(s) failed to process.. skipping reconcileChildren'); // logs should have optional failure warnings

    krmCache = [];
  }); 
});

// describe('#RRGitController', async function() {
//   const eventData = {
//     object: {
//       apiVersion: 'deploy.razee.io/v1alpha2',
//       kind: 'RemoteResource',
//       metadata: {
//         name: 'rr',
//         namespace: 'default'
//       },
//       spec: {
//         clusterAuth: {
//           impersonateUser: 'razeedeploy'
//         },
//         backendService: 'git',
//         requests: [
//           {
//             options: {
//               git: {
//                 provider: 'github',
//                 repo: 'https://github.com/razee-io/RemoteResource.git',
//                 ref: 'master',
//                 filePath: 'test/test-configs/test-config.yaml'
//               }
//             }
//           }
//         ]
//       }
        
//     }
//   };

//   const eventData1 = {
//     object: {
//       apiVersion: 'deploy.razee.io/v1alpha2',
//       kind: 'RemoteResource',
//       metadata: {
//         name: 'rr',
//         namespace: 'default'
//       },
//       spec: {
//         clusterAuth: {
//           impersonateUser: 'razeedeploy'
//         },
//         backendService: 'git',
//         requests: [
//           {
//             options: {
//               git: {
//                 provider: 'github',
//                 repo: 'https://github.com/razee-io/RemoteResource.git',
//                 ref: 'master',
//                 filePath: 'test/test-configs/*.yaml'
//               }
//             }
//           }
//         ]
//       }
        
//     }
//   };

//   it('Apply single github request option', async function () {
//     let kubeData = {};
//     kubeData['/default/rr'] = clone(eventData);

//     const controller = new GitController(eventData, kubeData);
//     await controller.execute();
//     const krmCache = controller.getKrmCache();

//     assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
//     assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
//     assert(krmCache[1].kubeData['/default/config-test']); //child applied
//     assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

//     controller.clearKrmCache();
//   });

//   it('Apply github request option with multiple files', async function () {
//     let kubeData = {};
//     kubeData['/default/rr'] = clone(eventData1);

//     const controller = new GitController(eventData1, kubeData);
//     await controller.execute();
//     const krmCache = controller.getKrmCache();

//     assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
//     assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
//     assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
//     assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
//     assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
//     assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link

//     controller.clearKrmCache();
//   });
// });
