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

describe('Manufacturer', function() {
    let businessNetworkConnection;
    let factory;

    beforeEach(function() {
        return Util.deployAndConnect()
            .then(connection => {
                businessNetworkConnection = connection;
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            });
    });

    const orderId = '1000-1000-1000-1000';

    /**
     * Place a vehicle order.
     * @returns {Promise} resolved when the transaction is complete.
     */
    function placeOrder() {
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
        return businessNetworkConnection.submitTransaction(placeOrder);
    }

    /**
     * Update a vehicle order.
     * @returns {Promise} resolved when the transaction is complete.
     */
    function updateOrder() {
        const updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
        updateOrderStatus.orderStatus = 'VIN_ASSIGNED';
        updateOrderStatus.vin = 'VIN_NUMBER';

        return businessNetworkConnection.getAssetRegistry(NS_M + '.Order')
            .then(function(orderRegistry) {
                return orderRegistry.getAll();
            })
            .then(function(orders) {
                const order = orders[0];
                updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
                return businessNetworkConnection.submitTransaction(updateOrderStatus);
            });
    }

    describe('#placeOrder', function() {
        it('should be able to place an order for a vehicle', function() {
            return placeOrder()
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
                })
                .then(function(orderRegistry) {
                    return orderRegistry.get(orderId);
                })
                .then(function(order) {
                    order.orderStatus.should.equal('PLACED');
                });
        });
    });

    describe('#updateOrderStatus', function() {
        it('should create a vehicle and assign it a VIN number', function() {
            return placeOrder()
                .then(function() {
                    return updateOrder();
                })
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
                })
                .then(function(vehicleRegistry) {
                    return vehicleRegistry.get('VIN_NUMBER');
                })
                .then(function(vehicle) {
                    should.exist(vehicle);
                    vehicle.vehicleStatus.should.equal('OFF_THE_ROAD');
                    vehicle.vehicleDetails.vin.should.equal('VIN_NUMBER');
                });
        });

        it('should assign an owner to a vehicle and make it active', function() {
            const updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
            updateOrderStatus.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatus.vin = 'VIN_NUMBER';
            updateOrderStatus.numberPlate = 'NUMBER_PLATE';
            updateOrderStatus.v5c = 'V5C';

            return placeOrder()
                .then(function() {
                    return updateOrder();
                })
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
                })
                .then(function(orderRegistry) {
                    return orderRegistry.getAll();
                })
                .then(function(orders) {
                    const order = orders[0];
                    updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
                    return businessNetworkConnection.submitTransaction(updateOrderStatus);
                })
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
                })
                .then(function(vehicleRegistry) {
                    return vehicleRegistry.get('VIN_NUMBER');
                })
                .then(function(vehicle) {
                    should.exist(vehicle);
                    vehicle.vehicleStatus.should.equal('ACTIVE');
                    vehicle.vehicleDetails.vin.should.equal(updateOrderStatus.vin);
                    vehicle.owner.getIdentifier().should.equal('dan');
                });
        });
    });

});
