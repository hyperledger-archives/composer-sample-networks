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

var AdminConnection = require('composer-admin').AdminConnection;
var BrowserFS = require('browserfs/dist/node/index');
var BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
var BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
var path = require('path');

var should = require('chai').should();
var Util = require('./util');


var bfs_fs = BrowserFS.BFSRequire('fs');
var NS = 'org.acme.vehicle.lifecycle';
var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
var NS_D = 'org.vda';

var factory;

describe('Vehicle Lifecycle Network', function() {

    var businessNetworkConnection;

    before(function() {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        var adminConnection = new AdminConnection({ fs: bfs_fs });
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
                return businessNetworkConnection.connect('defaultProfile', 'vehicle-lifecycle-network', 'admin', 'Xurw3yU9zI0l');
            })
            .then(function() {
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
                return Util.setup(businessNetworkConnection);
            });
    });

    describe('#placeOrder', function() {

        it('should be able to place an order for a vehicle', function() {
            // submit the transaction
            var placeOrder = factory.newTransaction(NS_M, 'PlaceOrder');
            placeOrder.manufacturer = factory.newRelationship(NS_M, 'Manufacturer', 'manufacturer');
            placeOrder.orderId = '1000-1000-1000-1000';
            placeOrder.orderer = factory.newRelationship(NS, 'PrivateOwner', 'dan');
            var vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
            vehicleDetails.modelType = 'Mustang';
            vehicleDetails.make = 'Ford';
            vehicleDetails.colour = 'Red';
            vehicleDetails.vin = '';
            placeOrder.vehicleDetails = vehicleDetails;
            return businessNetworkConnection.submitTransaction(placeOrder)
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
                })
                .then(function(orderRegistry) {
                    return orderRegistry.get(placeOrder.orderId);
                })
                .then(function(order) {
                    order.orderStatus.should.equal('PLACED');
                });
        });
    });

    describe('#updateOrderStatus', function() {

        it('should create a vehicle and assign it a VIN number', function() {
            var updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
            updateOrderStatus.orderStatus = 'VIN_ASSIGNED';
            updateOrderStatus.vin = 'VIN_NUMBER';

            return businessNetworkConnection.getAssetRegistry(NS_M + '.Order')
                .then(function(orderRegistry) {
                    return orderRegistry.getAll();
                })
                .then(function(orders) {
                    return orders[0]; // Get the order added in the previous test
                })
                .then(function(order) {
                    updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
                })
                .then(function() {
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
                    vehicle.vehicleStatus.should.equal('OFF_THE_ROAD');
                    vehicle.vehicleDetails.vin.should.equal('VIN_NUMBER');
                });
        });

        it('should assign an owner to a vehicle and make it active', function() {
            var updateOrderStatus = factory.newTransaction(NS_M, 'UpdateOrderStatus');
            updateOrderStatus.orderStatus = 'OWNER_ASSIGNED';
            updateOrderStatus.vin = 'VIN_NUMBER';
            updateOrderStatus.numberPlate = 'NUMBER_PLATE';
            updateOrderStatus.v5c = 'V5C';

            return businessNetworkConnection.getAssetRegistry(NS_M + '.Order')
                .then(function(orderRegistry) {
                    return orderRegistry.getAll();
                })
                .then(function(orders) {
                    return orders[0]; // Get the order added in the previous test
                })
                .then(function(order) {
                    updateOrderStatus.order = factory.newRelationship(NS_M, 'Order', order.getIdentifier());
                })
                .then(function() {
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