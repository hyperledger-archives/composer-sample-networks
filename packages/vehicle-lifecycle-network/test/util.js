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

var BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;

var NS = 'org.acme.vehicle.lifecycle';
var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
var NS_D = 'org.vda';


/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 * @param {String} NS
 * @param {String} type
 * @param {Resource} resource
 */
module.exports.createAsset = function(businessNetworkConnection, NS, type, resource) {
    var factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    return businessNetworkConnection.getAssetRegistry(NS + '.' + type)
        .then(function(registry) {
            return registry.add(resource);
        });
};

/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 * @param {String} NS
 * @param {String} type
 * @param {Resource} resource
 */
module.exports.createParticipant = function(businessNetworkConnection, NS, type, resource) {
    return businessNetworkConnection.getParticipantRegistry(NS + '.' + resource.getIdentifier())
        .then(function(registry) {
            return registry.add(resource);
        });
};

/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 */
module.exports.setup = function(businessNetworkConnection) {
    var factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    var p1 = factory.newResource(NS, 'PrivateOwner', 'dan');
    var p2 = factory.newResource(NS, 'PrivateOwner', 'simon');
    var m1 = factory.newResource(NS_M, 'Manufacturer', 'manufacturer');

    var v = factory.newResource(NS_D, 'Vehicle', '123456789');
    v.owner = factory.newRelationship(NS, 'PrivateOwner', 'dan');
    v.vehicleStatus = 'ACTIVE';
    v.numberPlate = 'NUMBER';
    v.vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
    v.vehicleDetails.make = 'Doge';
    v.vehicleDetails.modelType = 'Much Wow';
    v.vehicleDetails.colour = 'Beige';
    v.vehicleDetails.vin = '123456789';

    return businessNetworkConnection.getParticipantRegistry(NS + '.PrivateOwner')
        .then(function(pr) {
            return pr.addAll([p1, p2]);
        })
        .then(function() {
            return businessNetworkConnection.getParticipantRegistry(NS_M + '.Manufacturer');
        })
        .then(function(pr) {
            return pr.addAll([m1]);
        })
        .then(function() {
            return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
        })
        .then(function(ar) {
            return ar.addAll([v]);
        });
};