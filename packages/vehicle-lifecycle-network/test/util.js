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
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

const NS = 'org.acme.vehicle.lifecycle';
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.vda';

const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );
const adminCardName = 'admin';

let adminConnection;

/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 * @param {String} NS
 * @param {String} type
 * @param {Resource} resource
 */
module.exports.createAsset = async (businessNetworkConnection, NS, type, resource) => {
    const registry = await businessNetworkConnection.getAssetRegistry(NS + '.' + type);
    await registry.add(resource);
};

/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 * @param {String} NS
 * @param {String} type
 * @param {Resource} resource
 */
module.exports.createParticipant = async (businessNetworkConnection, NS, type, resource) => {
    const registry = await  businessNetworkConnection.getParticipantRegistry(NS + '.' + resource.getIdentifier());
    await registry.add(resource);
};

/**
 *
 * @param {BusinessNetworkConnection} businessNetworkConnection
 */
module.exports.setup = async (businessNetworkConnection) => {
    const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    const p1 = factory.newResource(NS, 'PrivateOwner', 'dan');
    const p2 = factory.newResource(NS, 'PrivateOwner', 'simon');
    const m1 = factory.newResource(NS_M, 'Manufacturer', 'manufacturer');

    const v = factory.newResource(NS_D, 'Vehicle', '123456789');
    v.owner = factory.newRelationship(NS, 'PrivateOwner', 'dan');
    v.vehicleStatus = 'ACTIVE';
    v.numberPlate = 'NUMBER';
    v.vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
    v.vehicleDetails.make = 'Doge';
    v.vehicleDetails.modelType = 'Much Wow';
    v.vehicleDetails.colour = 'Beige';
    v.vehicleDetails.vin = '123456789';

    const pr = await businessNetworkConnection.getParticipantRegistry(NS + '.PrivateOwner');
    await pr.addAll([p1, p2]);

    const mr = await businessNetworkConnection.getParticipantRegistry(NS_M + '.Manufacturer');
    await mr.addAll([m1]);

    const vr = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
    await vr.addAll([v]);
};

module.exports.deployAndConnect = async () => {
    const adminConnection = await getAdminConnection();
    const businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

    await adminConnection.install(businessNetworkDefinition);
    const startOptions = {
        networkAdmins: [
            {
                userName: 'admin',
                enrollmentSecret: 'adminpw'
            }
        ]
    };
    const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);
    await adminConnection.importCard(adminCardName, adminCards.get('admin'));

    const businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
    await businessNetworkConnection.connect(adminCardName);
    return businessNetworkConnection;
};

/**
 * Install required cards and create an admin connection.
 * @returns {Promise} Resolves with a AdminConnection.
 */
async function getAdminConnection() {
    if (adminConnection) {
        return adminConnection;
    }

    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    };
    const credentials = CertificateUtil.generate({ commonName: 'admin' });

    const deployerMetadata = {
        version: 1,
        userName: 'PeerAdmin',
        roles: [ 'PeerAdmin', 'ChannelAdmin' ]
    };
    const deployerCard = new IdCard(deployerMetadata, connectionProfile);
    deployerCard.setCredentials(credentials);

    const deployerCardName = 'deployer';

    adminConnection = new AdminConnection({ cardStore: cardStore });

    await adminConnection.importCard(deployerCardName, deployerCard);
    await adminConnection.connect(deployerCardName);
    return adminConnection;
}
