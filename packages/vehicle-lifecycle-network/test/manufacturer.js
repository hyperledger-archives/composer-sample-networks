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

describe('Manufacturer', () => {
    let businessNetworkConnection;
    let factory;

    beforeEach(async () => {
        businessNetworkConnection = await Util.deployAndConnect();
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    });

    const orderId = '1000-1000-1000-1000';

    /**
     * Place a vehicle order.
     */
    async function placeOrder() {
        const placeOrder = factory.newTransaction(NS_M, 'PlaceOrder');
        placeOrder.manufacturer = factory.newRelationship(NS_M, 'Manufacturer', 'manufacturer');
        placeOrder.orderId = orderId;
        placeOrder.orderer = factory.newRelationship(NS, 'PrivateOwner', 'dan');
        const vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
        vehicleDetails.modelType = 'Mustang';
        vehicleDetails.make = 'Ford';
        vehicleDetails.colour = 'Red';
        vehicleDetails.vin = '';
        placeOrder.vehicleDetails = vehicleDetails;
        await businessNetworkConnection.submitTransaction(placeOrder);
    }

    /**
     * Update a vehicle order.
     * @returns {Promise} resolved when the transaction is complete.
     */
    async function updateOrder() {
        const updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
        updateOrderStatus.orderStatus = 'VIN_ASSIGNED';
        updateOrderStatus.vin = 'VIN_NUMBER';

        const orderRegistry = await businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
        const orders = await orderRegistry.getAll();
        const order = orders[0];
        updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
        await businessNetworkConnection.submitTransaction(updateOrderStatus);
    }

    describe('#placeOrder', () => {
        it('should be able to place an order for a vehicle', async () => {
            await placeOrder();
            const orderRegistry = await businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
            const order = await orderRegistry.get(orderId);
            order.orderStatus.should.equal('PLACED');
        });
    });

    describe('#updateOrderStatus', () => {
        it('should create a vehicle and assign it a VIN number', async () => {
            await placeOrder();
            await updateOrder();
            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
            const vehicle = await vehicleRegistry.get('VIN_NUMBER');
            should.exist(vehicle);
            vehicle.vehicleStatus.should.equal('OFF_THE_ROAD');
            vehicle.vehicleDetails.vin.should.equal('VIN_NUMBER');
        });

        it('should assign an owner to a vehicle and make it active', async () => {
            const updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
            updateOrderStatus.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatus.vin = 'VIN_NUMBER';
            updateOrderStatus.numberPlate = 'NUMBER_PLATE';
            updateOrderStatus.v5c = 'V5C';

            await placeOrder();
            await updateOrder();
            const orderRegistry = await businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
            const orders = await orderRegistry.getAll();
            const order = orders[0];
            updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
            await businessNetworkConnection.submitTransaction(updateOrderStatus);

            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
            const vehicle = await vehicleRegistry.get('VIN_NUMBER');
            should.exist(vehicle);
            vehicle.vehicleStatus.should.equal('ACTIVE');
            vehicle.vehicleDetails.vin.should.equal(updateOrderStatus.vin);
            vehicle.owner.getIdentifier().should.equal('dan');
        });
    });

});
