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

let AdminConnection = require('composer-admin').AdminConnection;
let BrowserFS = require('browserfs/dist/node/index');
let BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
let BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
let path = require('path');

let Util = require('./util');


let bfs_fs = BrowserFS.BFSRequire('fs');
let NS = 'com.biz';

let factory;

require('chai').should();

describe('Animal Tracking Network', function() {

    let businessNetworkConnection;

    before(function() {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        let adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(function() {
                return adminConnection.connect('defaultProfile', 'admin', 'Xurw3yU9zI0l');
            })
            .then(function() {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then(function(businessNetworkDefinition) {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(function() {
                businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
                return businessNetworkConnection.connect('defaultProfile', 'animaltracking-network', 'admin', 'Xurw3yU9zI0l');
            })
            .then(function() {
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
                return Util.setupDemo(businessNetworkConnection);
            });
    });

    describe('#setupDemo', () => {
        it('should create the correct number of resources in the network', () => {
            // Transaction is run in before
            return businessNetworkConnection.getAssetRegistry(NS + '.Animal')
                .then((ar) => {
                    return ar.getAll();
                })
                .then((animals) => {
                    animals.length.should.equal(8);

                    return businessNetworkConnection.getParticipantRegistry(NS + '.Farmer');
                })
                .then((pr) => {
                    return pr.getAll();
                })
                .then((farmers) => {
                    farmers.length.should.equal(2);
                    return businessNetworkConnection.getAssetRegistry(NS + '.Business');
                })
                .then((ar) => {
                    return ar.getAll();
                })
                .then((businesses) => {
                    businesses.length.should.equal(2);
                    return businessNetworkConnection.getAssetRegistry(NS + '.Field');
                })
                .then((ar) => {
                    return ar.getAll();
                })
                .then((fields) => {
                    fields.length.should.equal(4);
                });
        });
    });

    describe('#onAnimalMovementDeparture', function() {

        it('should change an animal to IN_TRANSIT and add it to receiving business', function() {
            let transaction = factory.newTransaction(NS, 'AnimalMovementDeparture');
            let animal = factory.newRelationship(NS, 'Animal', 'ANIMAL_1');
            let from = factory.newRelationship(NS, 'Business', 'BUSINESS_1');
            let to = factory.newRelationship(NS, 'Business', 'BUSINESS_2');
            let field = factory.newRelationship(NS, 'Field', 'FIELD_2');
            transaction.animal = animal;
            transaction.from = from;
            transaction.to = to;
            transaction.fromField = field;

            return businessNetworkConnection.submitTransaction(transaction)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Animal');
                })
                .then((ar) => {
                    return ar.get('ANIMAL_1');
                })
                .then((animal) => {
                    animal.movementStatus.should.equal('IN_TRANSIT');

                    return businessNetworkConnection.getAssetRegistry(NS + '.Business');
                })
                .then((ar) => {
                    return ar.get('BUSINESS_2');
                })
                .then((business) => {
                    business.incomingAnimals[0].getIdentifier().should.equal('ANIMAL_1');
                });
        });

        it('should fail if the animal is not IN_FIELD', () => {
            let transaction = factory.newTransaction(NS, 'AnimalMovementDeparture');
            let animal = factory.newRelationship(NS, 'Animal', 'ANIMAL_1');
            let from = factory.newRelationship(NS, 'Business', 'BUSINESS_1');
            let to = factory.newRelationship(NS, 'Business', 'BUSINESS_2');
            let field = factory.newRelationship(NS, 'Field', 'FIELD_1');
            transaction.animal = animal;
            transaction.from = from;
            transaction.to = to;
            transaction.fromField = field;

            return businessNetworkConnection.submitTransaction(transaction)
                .catch((err) => {
                    err.message.should.equal('Animal is already IN_TRANSIT');
                });
        });
    });

    describe('#onAnimalMovementArrival', () => {
        it('should change an animal to IN_FIELD and change its owner, location and remove it from incoming animals', () => {
            let transaction = factory.newTransaction(NS, 'AnimalMovementArrival');
            let animal = factory.newRelationship(NS, 'Animal', 'ANIMAL_1');
            let from = factory.newRelationship(NS, 'Business', 'BUSINESS_1');
            let to = factory.newRelationship(NS, 'Business', 'BUSINESS_2');
            let field = factory.newRelationship(NS, 'Field', 'FIELD_2');
            transaction.animal = animal;
            transaction.from = from;
            transaction.to = to;
            transaction.arrivalField = field;

            return businessNetworkConnection.submitTransaction(transaction)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Animal');
                })
                .then((ar) => {
                    return ar.get('ANIMAL_1');
                })
                .then((animal) => {
                    animal.movementStatus.should.equal('IN_FIELD');
                    animal.owner.getIdentifier().should.equal('FARMER_2');
                    animal.location.getIdentifier().should.equal('FIELD_2');

                    return businessNetworkConnection.getAssetRegistry(NS + '.Business');
                })
                .then((ar) => {
                    return ar.get('BUSINESS_2');
                })
                .then((business) => {
                    business.incomingAnimals.forEach((animal) => {
                        animal.getIdentifier().should.not.equal('ANIMAL_1');
                    });
                });
        });
    });
});
