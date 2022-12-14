const MockKRM = require('./MockKRM');
const RemoteResourceGitController = require('../src/RemoteResourceGitController');
let kubeResourceMetaCache = [];
const log = require('../src/bunyan-api').createLogger();

module.exports = class MockRRController extends RemoteResourceGitController {
  constructor(eventData, kubeData) {
    let params = {};
    params.eventData = eventData;
    params.logger = log;

    params.eventData.type = 'ADDED';
    params.kubeClass = {
      
      getKubeResourceMeta: (apiVersion, kind, verb, kubeData = {}) => {
        let krm;
        kubeResourceMetaCache.forEach((k) => {
          if (k._apiVersion == apiVersion && k._kind == kind) {
            krm = k;
            if (kind == 'RemoteResource' && Object.keys(kubeData).length > 0) { 
              let url = Object.keys(kubeData)[0];
              let reqOpt = { uri: url, method: 'GET'};
              let res = krm.request(reqOpt);

              if (res.statusCode != 200 ) {
                krm.post(kubeData[url].object);
              }
            }
          }
        });
        
        if (!krm) {
          krm = new MockKRM(apiVersion, kind, kubeData);
          kubeResourceMetaCache.push(krm);
        }
        return krm;
      }
    };

    params.kubeResourceMeta = params.kubeClass.getKubeResourceMeta('deploy.razee.io/v1alpha2', 'RemoteResource', '', kubeData);
    super(params);
  }

  async _deleteChild(child) {
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
  }

  async _patchChild(child) {
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
  
  }

  getKrmCache() {
    return kubeResourceMetaCache;
  }
  
  clearKrmCache() {
    kubeResourceMetaCache = [];
  }

};
