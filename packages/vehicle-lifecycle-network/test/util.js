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

const NS = 'org.acme.vehicle.lifecycle';
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.vda';

const cardStore = new MemoryCardStore();
const adminCardName = 'admin';

let adminConnection;

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

module.exports.deployAndConnect = function() {
    let adminConnection;
    let businessNetworkDefinition;
    let businessNetworkConnection;

    return getAdminConnection().then(connection => {
        adminConnection = connection;
        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
    }).then(definition => {
        businessNetworkDefinition = definition;
        return adminConnection.install(businessNetworkDefinition.getName());
    }).then(() => {
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        return adminConnection.start(businessNetworkDefinition, startOptions);
    }).then(adminCards => {
        return adminConnection.importCard(adminCardName, adminCards.get('admin'));
    }).then(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        return businessNetworkConnection.connect(adminCardName);
    }).then(() => {
        return businessNetworkConnection;
    });
};

/**
 * Install required cards and create an admin connection.
 * @returns {Promise} Resolves with a AdminConnection.
 */
function getAdminConnection() {
    if (adminConnection) {
        return Promise.resolve(adminConnection);
    }

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

    const deployerCardName = 'deployer';

    adminConnection = new AdminConnection({ cardStore: cardStore });

    return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
        return adminConnection.connect(deployerCardName);
    }).then(() => {
        return adminConnection;
    });
}
