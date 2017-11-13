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

require('chai').should();
let sinon = require('sinon');

const namespace = 'org.acme.shipping.perishable';
let grower_id = 'farmer@email.com';
let importer_id = 'supermarket@email.com';

describe('Perishable Shipping Network', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;
    let factory;
    let clock;

    before(() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        }).then(() => {
            businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

            return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        }).then(definition => {
            businessNetworkDefinition = definition;
            // Install the Composer runtime for the new business network
            return adminConnection.install(businessNetworkDefinition.getName());
        }).then(() => {
            // Start the business network and configure an network admin identity
            const startOptions = {
                networkAdmins: [
                    {
                        userName: adminUserName,
                        enrollmentSecret: 'adminpw'
                    }
                ]
            };
            return adminConnection.start(businessNetworkDefinition, startOptions);
        }).then(adminCards => {
            // Import the network admin identity for us to use
            adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
            return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
        }).then(() => {
            // Connect to the business network using the network admin identity
            return businessNetworkConnection.connect(adminCardName);
        }).then(() => {
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const setupDemo = factory.newTransaction(namespace, 'SetupDemo');
            return businessNetworkConnection.submitTransaction(setupDemo);
        });
    });

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    describe('#shipment', () => {

        it('should receive base price for a shipment within temperature range', () => {
            // submit the temperature reading
            const tempReading = factory.newTransaction(namespace, 'TemperatureReading');
            tempReading.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
            tempReading.centigrade = 4.5;
            return businessNetworkConnection.submitTransaction(tempReading)
                .then(() => {
                    // submit the shipment received
                    const received = factory.newTransaction(namespace, 'ShipmentReceived');
                    received.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
                    return businessNetworkConnection.submitTransaction(received);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Grower');
                })
                .then((growerRegistry) => {
                    // check the grower's balance
                    return growerRegistry.get(grower_id);
                })
                .then((newGrower) => {
                    // console.log(JSON.stringify(businessNetworkConnection.getBusinessNetwork().getSerializer().toJSON(newGrower)));
                    newGrower.accountBalance.should.equal(2500);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Importer');
                })
                .then((importerRegistry) => {
                    // check the importer's balance
                    return importerRegistry.get(importer_id);
                })
                .then((newImporter) => {
                    newImporter.accountBalance.should.equal(-2500);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Shipment');
                })
                .then((shipmentRegistry) => {
                    // check the state of the shipment
                    return shipmentRegistry.get('SHIP_001');
                })
                .then((shipment) => {
                    shipment.status.should.equal('ARRIVED');
                });
        });

        it('should receive nothing for a late shipment', () => {
            // submit the temperature reading
            const tempReading = factory.newTransaction(namespace, 'TemperatureReading');
            tempReading.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
            tempReading.centigrade = 4.5;
            // advance the javascript clock to create a time-advanced test timestamp
            clock.tick(1000000000000000);
            return businessNetworkConnection.submitTransaction(tempReading)
                .then(() => {
                    // submit the shipment received
                    const received = factory.newTransaction(namespace, 'ShipmentReceived');
                    received.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
                    return businessNetworkConnection.submitTransaction(received);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Grower');
                })
                .then((growerRegistry) => {
                    // check the grower's balance
                    return growerRegistry.get(grower_id);
                })
                .then((newGrower) => {
                    // console.log(JSON.stringify(businessNetworkConnection.getBusinessNetwork().getSerializer().toJSON(newGrower)));
                    newGrower.accountBalance.should.equal(2500);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Importer');
                })
                .then((importerRegistry) => {
                    // check the importer's balance
                    return importerRegistry.get(importer_id);
                })
                .then((newImporter) => {
                    newImporter.accountBalance.should.equal(-2500);
                });
        });

        it('should apply penalty for min temperature violation', () => {
            // submit the temperature reading
            const tempReading = factory.newTransaction(namespace, 'TemperatureReading');
            tempReading.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
            tempReading.centigrade = 1;
            return businessNetworkConnection.submitTransaction(tempReading)
                .then(() => {
                    // submit the shipment received
                    const received = factory.newTransaction(namespace, 'ShipmentReceived');
                    received.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
                    return businessNetworkConnection.submitTransaction(received);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Grower');
                })
                .then((growerRegistry) => {
                    // check the grower's balance
                    return growerRegistry.get(grower_id);
                })
                .then((newGrower) => {
                    // console.log(JSON.stringify(businessNetworkConnection.getBusinessNetwork().getSerializer().toJSON(newGrower)));
                    newGrower.accountBalance.should.equal(4000);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Importer');
                })
                .then((importerRegistry) => {
                    // check the importer's balance
                    return importerRegistry.get(importer_id);
                })
                .then((newImporter) => {
                    newImporter.accountBalance.should.equal(-4000);
                });
        });

        it('should apply penalty for max temperature violation', () => {
            // submit the temperature reading
            const tempReading = factory.newTransaction(namespace, 'TemperatureReading');
            tempReading.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
            tempReading.centigrade = 11;
            return businessNetworkConnection.submitTransaction(tempReading)
                .then(() => {
                    // submit the shipment received
                    const received = factory.newTransaction(namespace, 'ShipmentReceived');
                    received.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_001');
                    return businessNetworkConnection.submitTransaction(received);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Grower');
                })
                .then((growerRegistry) => {
                    // check the grower's balance
                    return growerRegistry.get(grower_id);
                })
                .then((newGrower) => {
                    // console.log(JSON.stringify(businessNetworkConnection.getBusinessNetwork().getSerializer().toJSON(newGrower)));
                    newGrower.accountBalance.should.equal(5000);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Importer');
                })
                .then((importerRegistry) => {
                    // check the importer's balance
                    return importerRegistry.get(importer_id);
                })
                .then((newImporter) => {
                    newImporter.accountBalance.should.equal(-5000);
                });
        });
    });
});
