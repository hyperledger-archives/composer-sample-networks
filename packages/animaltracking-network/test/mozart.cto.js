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

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;
const path = require('path');

const Util = require('./util');

const NS = 'com.biz';

let factory;

require('chai').should();

describe('Animal Tracking Network', function() {

    let businessNetworkConnection;

    before(() => {
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const userMetadata = {
            version: 1,
            userName: 'admin',
            businessNetwork: 'animaltracking-network'
        };
        const userCard = new IdCard(userMetadata, connectionProfile);
        userCard.setCredentials(credentials);

        const deployerCardName = 'deployer';
        const userCardName = 'user';

        const cardStore = new MemoryCardStore();
        const adminConnection = new AdminConnection({ cardStore: cardStore });

        return adminConnection.importCard(deployerCardName, deployerCard)
            .then(() => {
                return adminConnection.importCard(userCardName, userCard);
            })
            .then(() => {
                return adminConnection.connect(deployerCardName);
            })
            .then(() => {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then((businessNetworkDefinition) => {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
                return businessNetworkConnection.connect(userCardName);
            })
            .then(() => {
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
