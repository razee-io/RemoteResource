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


module.exports = class BackendServiceFactory {
  constructor(params) {
    this.eventParams = params;
    const backendService = objectPath.get(this.eventParams, 'eventData.object.spec.backendService', '').toLowerCase();

    let controllerString = 'RemoteResource';
    if (backendService == 's3') controllerString = 'RemoteResourceS3';
    if (backendService == 'git') controllerString = 'RemoteResourceGit';
    this.controllerString = controllerString;
  }

  async execute() {
    this.eventParams.logger.info(`Running ${this.controllerString}Controller.`);
    const Controller = require(`./${this.controllerString}Controller`);
    const controller = new Controller(this.eventParams);
    return await controller.execute();
  }

};
