/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Util = require('./util');

const NS = 'org.acme.vehicle.lifecycle';
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.vda';

describe('Setup', () => {
    let businessNetworkConnection;
    let factory;

    beforeEach(async () => {
        businessNetworkConnection = await Util.deployAndConnect();
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    });

    describe('Setup', () => {
        describe('#setupDemo', () => {
            /**
             *
             * @param {String} registry - name of a registry
             */
            async function getAllFromRegistry(type, registry) {
                const func = 'get' + type + 'Registry';
                const bnc = await businessNetworkConnection[func](registry);
                return await bnc.getAll();
            }

            it('should create a scenario', async () => {
                // submit the transaction
                const setupDemo = factory.newTransaction(NS, 'SetupDemo');

                await businessNetworkConnection.submitTransaction(setupDemo);

                // (participants) get regulator registry
                const regulators = await getAllFromRegistry('Participant', NS + '.Regulator');
                regulators.length.should.equal(1);

                // (participants) get manufacturer registry
                const manufacturers = await getAllFromRegistry('Participant', NS_M + '.Manufacturer');
                manufacturers.length.should.be.above(1);

                // (participants) get private owner registry
                const privateOwners = await getAllFromRegistry('Participant', NS + '.PrivateOwner');
                privateOwners.length.should.be.above(10);

                // (assets) get vehicles registry
                const vehicles = await getAllFromRegistry('Asset', NS_D + '.Vehicle');
                vehicles.length.should.be.above(10);
            });
        });

    });

});
