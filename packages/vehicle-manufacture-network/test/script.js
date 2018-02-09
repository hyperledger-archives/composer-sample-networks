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
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
=======
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;
const path = require('path');

require('chai').should();
>>>>>>> vehicle manufacture network initial (#146)

const namespace = 'org.acme.vehicle_network';
const orderId = '1000-1000-1000-1000';
const vin = '1a2b3c4d5e6f7g8h9';

describe('Manufacture network', () => {
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );
=======
    const cardStore = new MemoryCardStore();
>>>>>>> vehicle manufacture network initial (#146)
    let adminConnection;
    let businessNetworkConnection;
    let factory;

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
    before(async () => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });
=======
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
>>>>>>> vehicle manufacture network initial (#146)

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0

=======
>>>>>>> vehicle manufacture network initial (#146)
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    beforeEach(async () => {
=======
        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
>>>>>>> vehicle manufacture network initial (#146)
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
        const businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;

        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);

        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    });

    describe('PlaceOrder', () => {
        it('should be able to place an order', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)

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

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            const personRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Person');
            await personRegistry.add(orderer);

            const manufacturerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
            await manufacturerRegistry.add(manufacturer);

            await businessNetworkConnection.submitTransaction(placeOrderTx);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            const order = await orderRegistry.get(placeOrderTx.orderId);

            order.orderId.should.deep.equal(placeOrderTx.orderId);
            order.vehicleDetails.should.deep.equal(vehicleDetails);
            order.options.should.deep.equal(options);
            order.orderStatus.should.deep.equal('PLACED');
            order.orderer.should.deep.equal(placeOrderTx.orderer);
=======
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
>>>>>>> vehicle manufacture network initial (#146)
        });
    });

    describe('UpdateOrderStatus', () => {
        let order;
        let orderer;
        let manufacturer;
        let vehicleDetails;
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
        beforeEach(async () => {
=======
        beforeEach(() => {
>>>>>>> vehicle manufacture network initial (#146)
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

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            const personRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Person');
            await personRegistry.add(orderer);

            const manufacturerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
            await manufacturerRegistry.add(manufacturer);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            await orderRegistry.add(order);
        });

        it('should update the status of the order to SCHEDULED_FOR_MANUFACTURE', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'SCHEDULED_FOR_MANUFACTURE';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            await businessNetworkConnection.submitTransaction(updateOrderStatusTx);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            const retrievedOrder = await orderRegistry.get(orderId);

            retrievedOrder.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
        });

        it('should update the status of the order to VIN_ASSIGNED and create a Vehicle', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'VIN_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);
            updateOrderStatusTx.vin = vin;

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            await businessNetworkConnection.submitTransaction(updateOrderStatusTx);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            const retrievedOrder = await orderRegistry.get(orderId);

            retrievedOrder.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);

            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
            const vehicle = await vehicleRegistry.get(vin);

            vehicle.vin.should.deep.equal(vin);
            vehicle.vehicleDetails.should.deep.equal(vehicleDetails);
            vehicle.vehicleStatus.should.deep.equal('OFF_THE_ROAD');
        });

        it('should update the status of the order to OWNER_ASSIGNED and update the Vehicle', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);
            updateOrderStatusTx.vin = vin;

            const vehicle = factory.newResource(namespace, 'Vehicle', vin);
            vehicle.vehicleDetails = vehicleDetails;
            vehicle.vehicleStatus = 'OFF_THE_ROAD';

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
            await vehicleRegistry.add(vehicle);

            await businessNetworkConnection.submitTransaction(updateOrderStatusTx);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            const retrievedOrder = await orderRegistry.get(orderId);

            retrievedOrder.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);

            const retrievedVehicle = await vehicleRegistry.get(vin);

            retrievedVehicle.vin.should.deep.equal(vin);
            retrievedVehicle.vehicleStatus.should.deep.equal('ACTIVE');
            retrievedVehicle.owner.should.deep.equal(order.orderer);
        });

        it('should update the status of the order to DELIVERED', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'DELIVERED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            await businessNetworkConnection.submitTransaction(updateOrderStatusTx);

            const orderRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Order');
            const retrievedOrder = await orderRegistry.get(orderId);

            retrievedOrder.orderStatus.should.deep.equal(updateOrderStatusTx.orderStatus);
        });

        it('should throw an error if the vin is not passed when orderStatus set to VIN_ASSIGNED', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'VIN_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            return businessNetworkConnection.submitTransaction(updateOrderStatusTx).should.be.rejectedWith('Value for VIN was expected');
        });

        it('should throw an error if the vin is not passed when orderStatus set to OWNER_ASSIGNED', async () => {
=======
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
>>>>>>> vehicle manufacture network initial (#146)
            const updateOrderStatusTx = factory.newTransaction(namespace, 'UpdateOrderStatus');
            updateOrderStatusTx.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatusTx.order = factory.newRelationship(namespace, 'Order', order.$identifier);

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            return businessNetworkConnection.submitTransaction(updateOrderStatusTx).should.be.rejectedWith('Value for VIN was expected');
=======
            businessNetworkConnection.submitTransaction(updateOrderStatusTx)
                .then(() => {
                    done(new Error('Expected method to reject'));
                })
                .catch((err) => {
                    err.message.should.deep.equal('Value for VIN was expected');
                    done();
                })
                .catch(done);
>>>>>>> vehicle manufacture network initial (#146)
        });
    });

    describe('SetupDemo', () => {
<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
        it('should add specified participants and vehicles for the demo scenario', async () => {
            const setupDemoTx = factory.newTransaction(namespace, 'SetupDemo');

            const expectedPeopleNames = ['Paul', 'Andy', 'Hannah', 'Sam', 'Caroline', 'Matt', 'Fenglian', 'Mark', 'James', 'Dave', 'Rob', 'Kai', 'Ellis', 'LesleyAnn'];
            const expectedPeople = expectedPeopleNames.map((expectedPerson) => {
                return factory.newResource(namespace, 'Person', expectedPerson);
            });

            const expectedManufacturerNames = ['Arium', 'Morde', 'Ridge'];
            const expectedManufacturers = expectedManufacturerNames.map((expectedManufacturer) => {
                const manufacturer = factory.newResource(namespace, 'Manufacturer', expectedManufacturer);
=======
        it('should add specified participants and vehicles for the demo scenario', () => {
            const setupDemoTx = factory.newTransaction(namespace, 'SetupDemo');

            var expectedPeopleNames = ['Paul', 'Andy', 'Hannah', 'Sam', 'Caroline', 'Matt', 'Fenglian', 'Mark', 'James', 'Dave', 'Rob', 'Kai', 'Ellis', 'LesleyAnn'];
            var expectedPeople = expectedPeopleNames.map((expectedPerson) => {
                return factory.newResource(namespace, 'Person', expectedPerson);
            });

            var expectedManufacturerNames = ['Arium', 'Morde', 'Ridge'];
            var expectedManufacturers = expectedManufacturerNames.map((expectedManufacturer) => {
                let manufacturer = factory.newResource(namespace, 'Manufacturer', expectedManufacturer);
>>>>>>> vehicle manufacture network initial (#146)
                manufacturer.name = expectedManufacturer;
                return manufacturer;
            });

<<<<<<< 63a17405597cf654f887106caaa2e7c39fe72af0
            const expectedVins = ['ea290d9f5a6833a65', '39fd242c2bbe80f11', '835125e50bca37ca1', '0812e6d8d486e0464', 'c4aa418f26d4a0403', '7382fbfc083f696e5', '01a9cd3f8f5db5ef7', '97f305df4c2881e71', 'af462063fb901d0e6', '3ff3395ecfd38f787', 'de701fcf2a78d8086', '2fcdd7b5131e81fd0', '79540e5384c970321'];

            await businessNetworkConnection.submitTransaction(setupDemoTx);

            const personRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Person');
            const people = await personRegistry.getAll();

            people.length.should.deep.equal(14);
            people.forEach((person) => {
                expectedPeople.should.include(person);
            });

            const manufacturerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Manufacturer');
            const manufacturers = await manufacturerRegistry.getAll();

            manufacturers.length.should.deep.equal(3);
            manufacturers.forEach((manufacturer) => {
                expectedManufacturers.should.include(manufacturer);
            });

            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Vehicle');
            const vehicles = await vehicleRegistry.getAll();

            vehicles.length.should.deep.equal(13);
            vehicles.forEach((vehicle) => {
                expectedVins.should.include(vehicle.vin);
                expectedManufacturerNames.should.include(vehicle.vehicleDetails.make.$identifier);
                expectedPeopleNames.slice(1, 14).should.include(vehicle.owner.$identifier); // paul shouldn't have a vehicle
            });
=======
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
>>>>>>> vehicle manufacture network initial (#146)
        });
    });
});