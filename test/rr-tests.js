const assert = require('chai').assert;
const Controller = require('../lib/MockRRController');
const GitController = require('../lib/MockRRGitController');
const clone = require('clone');
const objectPath = require('object-path');


describe('#RemoteResourceController', async function() {
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
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData);

    const controller = new Controller(eventData, kubeData);
    await controller.execute();
    const krmCache = controller.getKrmCache();
    
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

    controller.clearKrmCache();
  });

  it('Update single request option reconcile children', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData);

    const controller = new Controller(eventData, kubeData);

    await controller.execute();
    let krmCache = controller.getKrmCache();
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link


    // update request option
    let eventDataUpdate = clone(krmCache[0].kubeData['/default/rr']);
    objectPath.set(eventDataUpdate, ['object', 'spec', 'requests'], requestupdate);
    
    kubeData['/default/rr'] = clone(eventDataUpdate);
    const controller1 = new Controller(eventDataUpdate, kubeData);

    await controller1.execute();

    krmCache = controller1.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // new child is indicated on parent
    assert.isNull(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // old child removed from parent
    assert(krmCache[1].kubeData['/default/config-test-update']); // new child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'], undefined); // old child deleted
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // new child has parent link

    controller.clearKrmCache();
  });

  it('Multiple request options', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData1);

    const controller = new Controller(eventData1, kubeData);

    await controller.execute();
    let krmCache = controller.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
    assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
    assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link

    controller.clearKrmCache();
  });

  it('Update single request option reconcile children false', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData2);

    const controller = new Controller(eventData2, kubeData);

    await controller.execute();
    let krmCache = controller.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

    let eventDataUpdate = clone(krmCache[0].kubeData['/default/rr']);
    objectPath.set(eventDataUpdate, ['object', 'spec', 'requests'], requestupdate);
    
    kubeData['/default/rr'] = clone(eventDataUpdate);
    const controller1 = new Controller(eventDataUpdate, kubeData);

    await controller1.execute();

    krmCache = controller1.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // new child is indicated on parent
    assert.isNull(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // old child removed from parent
    assert(krmCache[1].kubeData['/default/config-test-update']); // new child applied
    assert(krmCache[1].kubeData['/default/config-test'], undefined); // old child still exists
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // new child has parent link
    assert.isNull(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent']); // old child parent link removed

    controller1.clearKrmCache();
  });

  it('Invalid file should error', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData3);

    const controller = new Controller(eventData3, kubeData);

    await controller.execute();
    let krmCache = controller.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['fae4e13e03553526a92562ff58d09b7abf804ad2']); // should have 404 error hash
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].error['fae4e13e03553526a92562ff58d09b7abf804ad2'], 'uri: https://raw.githubusercontent.com/razee-io/RemoteResource/master/test/test-configs/invalid-config.yaml, statusCode: 404, message: undefined');
  });

  it('Multiple parents applying same child should skip apply', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData);

    const controller = new Controller(eventData, kubeData);
    await controller.execute();

    let kubeData1 = {};
    kubeData1['/default/rr1'] = clone(eventData4);

    const controller1 = new Controller(eventData4, kubeData1);
    await controller1.execute();

    let krmCache = controller1.getKrmCache();
  
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[0].kubeData['/default/rr1'].status.children, undefined); // child not indicated on second parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has first parent link

    controller.clearKrmCache();
  });

  it('Requests with optional flag should attempt apply all', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData5);

    const controller = new Controller(eventData5, kubeData);
    await controller.execute();

    const krmCache = controller.getKrmCache();
    
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link
    assert.equal(krmCache[0].kubeData['/default/rr'].object.status['razee-logs'].warn['485f9f111adca66ff5a65f9e820bd88407af8147'].warn, '1 optional resource(s) failed to process.. skipping reconcileChildren'); // logs should have optional failure warnings

    controller.clearKrmCache();
  }); 
});

describe('#RRGitController', async function() {
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
        backendService: 'git',
        requests: [
          {
            options: {
              git: {
                provider: 'github',
                repo: 'https://github.com/razee-io/RemoteResource.git',
                ref: 'master',
                filePath: 'test/test-configs/test-config.yaml'
              }
            }
          }
        ]
      }
        
    }
  };

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
        backendService: 'git',
        requests: [
          {
            options: {
              git: {
                provider: 'github',
                repo: 'https://github.com/razee-io/RemoteResource.git',
                ref: 'master',
                filePath: 'test/test-configs/*.yaml'
              }
            }
          }
        ]
      }
        
    }
  };

  it('Apply single github request option', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData);

    const controller = new GitController(eventData, kubeData);
    await controller.execute();
    const krmCache = controller.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child is indicated on parent
    assert.equal(krmCache[1]._kind, 'ConfigMap'); // ConfigMap krm created
    assert(krmCache[1].kubeData['/default/config-test']); //child applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child has parent link

    controller.clearKrmCache();
  });

  it('Apply github request option with multiple files', async function () {
    let kubeData = {};
    kubeData['/default/rr'] = clone(eventData1);

    const controller = new GitController(eventData1, kubeData);
    await controller.execute();
    const krmCache = controller.getKrmCache();

    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test']); // child1 is indicated on parent
    assert(krmCache[0].kubeData['/default/rr'].object.status.children['/default/config-test-update']); // child2 is indicated on parent
    assert(krmCache[1].kubeData['/default/config-test']); //child1 applied
    assert(krmCache[1].kubeData['/default/config-test-update']); // child2 applied
    assert.equal(krmCache[1].kubeData['/default/config-test'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child1 has parent link
    assert.equal(krmCache[1].kubeData['/default/config-test-update'].metadata.annotations['deploy.razee.io.parent'], '/default/rr'); // child2 has parent link

    controller.clearKrmCache();
  });
});
