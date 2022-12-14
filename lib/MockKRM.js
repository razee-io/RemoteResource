const { MockKubeResourceMeta } = require('@razee/razeedeploy-core');
const objectPath = require('object-path');
const merge = require('deepmerge');


module.exports = class MockKRM extends MockKubeResourceMeta {
  constructor(apiVersion, kind, kubeData) {
    super(apiVersion, kind, kubeData);
    this._logger = require('../src/bunyan-api').createLogger('KubeResourceMeta');
    
  }

  uri(options = {}) {
    let result = '';
    if (options.watch) {
      result = `${result}/watch`;
    }
    if (options.namespace) {
      result = `${result}/${options.namespace}`;
    }
    if (options.name) {
      result = `${result}/${options.name}`;
    }
    if (options.status) {
      result = `${result}/status`;
    } else if (options.scale) {
      result = `${result}/scale`;
    }
    return result;
  }

  get(name, namespace) {
    const ref = this.uri({ name, namespace });
    if (this.kubeData[ref]) {
      return {statusCode: 200, body: this.kubeData[ref]};
    } else {
      return {statusCode: 404};
    }
  }

  request(reqOpt) {
    if (reqOpt.method == 'DELETE') { 
      delete this.kubeData[reqOpt.uri];
      return { statusCode: 200, body: this.kubeData[reqOpt.uri] };
    } else if (reqOpt.method == 'GET') {
      if(this.kubeData[reqOpt.uri]) {
        return { statusCode: 200, body: this.kubeData[reqOpt.uri] };
      } else {
        return { statusCode: 404 };
      }
    } else {
      return { statusCode: 404 };
    }
  }

  post(file) {
    const uri = this.uri({ name: objectPath.get(file, 'metadata.name'), namespace: objectPath.get(file, 'metadata.namespace') });
    this._logger.debug(`Post ${uri}`);
    this.kubeData[uri] = file;
    return {statusCode: 200};
  }

  mergePatch(name, ns, mPatch) {
    const uri = this.uri({ name: name, namespace: ns });   
    this._logger.debug(`MergePatch ${uri}`);

    let ret;
    if (this.kubeData[uri].object) {
      this.kubeData[uri].object = merge(this.kubeData[uri].object, mPatch);
      ret = this.kubeData[uri].object;
    } else {
      this.kubeData[uri] = merge(this.kubeData[uri], mPatch);
      ret = this.kubeData[uri];
    }

    if (mPatch.kind) {
      return { statusCode: 200, body: ret };
    } else {
      return ret;
    }
    
  }
};
