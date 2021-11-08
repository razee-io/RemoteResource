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
  }

  async execute() {
    const backendService = objectPath.get(this.eventParams, 'eventData.object.spec.backendService', '').toLowerCase();
    let controllerString;
    if (backendService === 's3') {
      controllerString = 'RemoteResourceS3';
    } else { // generic
      controllerString = 'RemoteResource';
    }
    this.eventParams.logger.info(`Running ${controllerString}Controller.`);
    const Controller = require(`./${controllerString}Controller`);
    const controller = new Controller(this.eventParams);
    return await controller.execute();
  }

};
