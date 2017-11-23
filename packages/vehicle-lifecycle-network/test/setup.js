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

const should = require('chai').should();

const NS = 'org.acme.vehicle.lifecycle';
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.vda';

describe('Setup', function() {
    let businessNetworkConnection;
    let factory;

    beforeEach(function() {
        return Util.deployAndConnect()
            .then(connection => {
                businessNetworkConnection = connection;
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            });
    });

    describe('Setup', function() {
        describe('#setupDemo', function() {
            /**
             *
             * @param {String} registry - name of a registry
             */
            function getAllFromRegistry(type, registry) {
                const func = 'get' + type + 'Registry';
                return businessNetworkConnection[func](registry)
                    .then(function(registry) {
                        return registry.getAll();
                    });
            }

            it('should create a scenario', function() {
                // submit the transaction
                const setupDemo = factory.newTransaction(NS, 'SetupDemo');

                return businessNetworkConnection.submitTransaction(setupDemo)
                    .then(function() {
                        // (participants) get regulator registry
                        return getAllFromRegistry('Participant', NS + '.Regulator');
                    })
                    .then(function(regulators) {
                        regulators.length.should.equal(1);
                    })
                    .then(function() {
                        // (participants) get manufacturer registry
                        return getAllFromRegistry('Participant', NS_M + '.Manufacturer');
                    })
                    .then(function(manufacturers) {
                        manufacturers.length.should.be.above(1);
                    })
                    .then(function() {
                        // (participants) get private owner registry
                        return getAllFromRegistry('Participant', NS + '.PrivateOwner');
                    })
                    .then(function(privateOwners) {
                        privateOwners.length.should.be.above(10);
                    })
                    .then(function() {
                        // (assets) get vehicles registry
                        return getAllFromRegistry('Asset', NS_D + '.Vehicle');
                    })
                    .then(function(vehicles) {
                        vehicles.length.should.be.above(10);
                    });
            });
        });

    });

});
