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

const namespace = 'org.acme.vehicle_network';
const orderId = '1000-1000-1000-1000';
const vin = '1a2b3c4d5e6f7g8h9';

describe('Manufacture network', () => {
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;
    let factory;

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

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
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
        });
    });

    describe('PlaceOrder', () => {
        it('should be able to place an order', () => {

            // create the orderer
            const orderer = factory.newResource(namespace, 'Person', 'Andy');

            // create the manufacturer
            const manufacturer = factory.newResource(namespace, 'Manufacturer', 'Arium');
            manufacturer.name = 'Arium';

            // create the vehicle details for the order
            const vehicleDetails = factory.newConcept(namespace, 'VehicleDetails');
            vehicleDetails.make = factory.newRelationship(namespace, 'Manufacturer', manufacturer.$identifier);
            vehicleDetails.modelType = 'nova';
            vehicleDetails.colour = 'statement blue';

            // create the order options
            const options = factory.newConcept(namespace, 'Options');
            options.trim = 'executive';
            options.interior = 'rotor grey';
            options.extras = ['tinted windows', 'extended warranty'];

            // create the transactionObject

            const placeOrderTx = factory.newTransaction(namespace, 'PlaceOrder');
            placeOrderTx.orderId = orderId;
            placeOrderTx.vehicleDetails = vehicleDetails;
            placeOrderTx.options = options;
            placeOrderTx.orderer = factory.newRelationship(namespace, 'Person', orderer.$identifier);

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Person')
                .then((personRegistry) => {
                    return personRegistry.add(orderer);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
                })
                .then((manufacturerRegistry) => {
                    return manufacturerRegistry.add(manufacturer);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(placeOrderTx);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(placeOrderTx.orderId);
                })
                .then((order) => {
                    order.orderId.should.deep.equal(placeOrderTx.orderId);
                    order.vehicleDetails.should.deep.equal(vehicleDetails);
                    order.options.should.deep.equal(options);
                    order.orderStatus.should.deep.equal('PLACED');
                    order.orderer.should.deep.equal(placeOrderTx.orderer);
                });
        });
    });

    describe('UpdateOrderStatus', () => {
        let order;
        let orderer;
        let manufacturer;
        let vehicleDetails;
        beforeEach(() => {
            // create the orderer
            orderer = factory.newResource(namespace, 'Person', 'Andy');

            // create the manufacturer
            manufacturer = factory.newResource(namespace, 'Manufacturer', 'Arium');
            manufacturer.name = 'Arium';

            // create the vehicle details for the order
            vehicleDetails = factory.newConcept(namespace, 'VehicleDetails');
            vehicleDetails.make = factory.newRelationship(namespace, 'Manufacturer', manufacturer.$identifier);
            vehicleDetails.modelType = 'nova';
            vehicleDetails.colour = 'statement blue';

            // create the order options
            const options = factory.newConcept(namespace, 'Options');
            options.trim = 'executive';
            options.interior = 'rotor grey';
            options.extras = ['tinted windows', 'extended warranty'];

            // create the order to update
            order = factory.newResource(namespace, 'Order', orderId);
            order.vehicleDetails = vehicleDetails;
            order.options = options;
            order.orderStatus = 'PLACED';
            order.orderer = factory.newRelationship(namespace, 'Person', orderer.$identifier);

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Person')
                .then((personRegistry) => {
                    return personRegistry.add(orderer);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
                })
                .then((manufacturerRegistry) => {
                    return manufacturerRegistry.add(manufacturer);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.add(order);
                });

        });

        it('should update the status of the order to SCHEDULED_FOR_MANUFACTURE', () => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'SCHEDULED_FOR_MANUFACTURE';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

            return businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(orderId);
                })
                .then((order) => {
                    order.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
                });
        });

        it('should update the status of the order to VIN_ASSIGNED and create a Vehicle', () => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'VIN_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);
            updateOrderStatusTx.vin = vin;

            return businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(orderId);
                })
                .then((order) => {
                    order.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.get(vin);
                })
                .then((vehicle) => {
                    vehicle.vin.should.deep.equal(vin);
                    vehicle.vehicleDetails.should.deep.equal(vehicleDetails);
                    vehicle.vehicleStatus.should.deep.equal('OFF_THE_ROAD');
                });
        });

        it('should update the status of the order to OWNER_ASSIGNED and update the Vehicle', () => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);
            updateOrderStatusTx.vin = vin;

            const vehicle = factory.newResource(namespace, 'Vehicle', vin);
            vehicle.vehicleDetails = vehicleDetails;
            vehicle.vehicleStatus = 'OFF_THE_ROAD';

            return businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle')
                .then((vehicleRegistry) => {
                    return vehicleRegistry.add(vehicle);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(updateOrderStatusTx);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(orderId);
                })
                .then((order) => {
                    order.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.get(vin);
                })
                .then((vehicle) => {
                    vehicle.vin.should.deep.equal(vin);
                    vehicle.vehicleStatus.should.deep.equal('ACTIVE');
                    vehicle.owner.should.deep.equal(order.orderer);
                });
        });

        it('should update the status of the order to DELIVERED', () => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'DELIVERED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

            return businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(orderId);
                })
                .then((order) => {
                    order.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
                });
        });

        it('should throw an error if the vin is not passed when orderStatus set to VIN_ASSIGNED', (done) => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'VIN_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

            businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    done(new Error('Expected method to reject'));
                })
                .catch((err) => {
                    err.message.should.deep.equal('Value for VIN was expected');
                    done();
                })
                .catch(done);
        });

        it('should throw an error if the vin is not passed when orderStatus set to OWNER_ASSIGNED', (done) => {
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

            businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    done(new Error('Expected method to reject'));
                })
                .catch((err) => {
                    err.message.should.deep.equal('Value for VIN was expected');
                    done();
                })
                .catch(done);
        });
    });

    describe('SetupDemo', () => {
        it('should add specified participants and vehicles for the demo scenario', () => {
            const setupDemoTx = factory.newTransaction(namespace, 'SetupDemo');

            var expectedPeopleNames = ['Paul', 'Andy', 'Hannah', 'Sam', 'Caroline', 'Matt', 'Fenglian', 'Mark', 'James', 'Dave', 'Rob', 'Kai', 'Ellis', 'LesleyAnn'];
            var expectedPeople = expectedPeopleNames.map((expectedPerson) => {
                return factory.newResource(namespace, 'Person', expectedPerson);
            });

            var expectedManufacturerNames = ['Arium', 'Morde', 'Ridge'];
            var expectedManufacturers = expectedManufacturerNames.map((expectedManufacturer) => {
                let manufacturer = factory.newResource(namespace, 'Manufacturer', expectedManufacturer);
                manufacturer.name = expectedManufacturer;
                return manufacturer;
            });

            var expectedVins = ['ea290d9f5a6833a65', '39fd242c2bbe80f11', '835125e50bca37ca1', '0812e6d8d486e0464', 'c4aa418f26d4a0403', '7382fbfc083f696e5', '01a9cd3f8f5db5ef7', '97f305df4c2881e71', 'af462063fb901d0e6', '3ff3395ecfd38f787', 'de701fcf2a78d8086', '2fcdd7b5131e81fd0', '79540e5384c970321'];

            return businessNetworkConnection.submitTransaction(setupDemoTx)
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Person');
                })
                .then((personRegistry) => {
                    return personRegistry.getAll();
                })
                .then((people) => {
                    people.length.should.deep.equal(14);
                    people.forEach((person) => {
                        expectedPeople.should.include(person);
                    });
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
                })
                .then((manufacturerRegistry) => {
                    return manufacturerRegistry.getAll();
                })
                .then((manufacturers) => {
                    manufacturers.length.should.deep.equal(3);
                    manufacturers.forEach((manufacturer) => {
                        expectedManufacturers.should.include(manufacturer);
                    });
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.getAll();
                })
                .then((vehicles) => {
                    vehicles.length.should.deep.equal(13);
                    vehicles.forEach((vehicle) => {
                        expectedVins.should.include(vehicle.vin);
                        expectedManufacturerNames.should.include(vehicle.vehicleDetails.make.$identifier);
                        expectedPeopleNames.slice(1, 14).should.include(vehicle.owner.$identifier); // paul shouldn't have a vehicle
                    });
                });
        });
    });
});