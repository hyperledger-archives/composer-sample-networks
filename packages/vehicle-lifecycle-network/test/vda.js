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
const NS_D = 'org.vda';

describe('VDA', () => {
    let businessNetworkConnection;
    let factory;

    beforeEach(async () => {
        businessNetworkConnection = await Util.deployAndConnect();
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
        await Util.setup(businessNetworkConnection);
    });

    describe('#privateVehicleTransfer', () => {
        it('should be able to transfer a vehicle between two private owners', async () => {
            const vehicleToTransfer = '123456789';

            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
            const vehicle = await vehicleRegistry.get(vehicleToTransfer);

            should.not.exist(vehicle.logEntries);
            vehicle.owner.getIdentifier().should.equal('dan');

            const privateVehicleTransfer = factory.newTransaction(NS_D, 'PrivateVehicleTransfer');
            privateVehicleTransfer.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicle.getIdentifier());
            privateVehicleTransfer.seller = vehicle.owner;
            privateVehicleTransfer.buyer = factory.newRelationship(NS, 'PrivateOwner', 'simon');
            await businessNetworkConnection.submitTransaction(privateVehicleTransfer);

            const newVehicle = await vehicleRegistry.get(vehicle.getIdentifier());
            newVehicle.owner.getIdentifier().should.equal('simon');
            should.exist(newVehicle.logEntries);
            newVehicle.logEntries.length.should.equal(1);
            newVehicle.logEntries[0].buyer.getIdentifier().should.equal('simon');
            newVehicle.logEntries[0].seller.getIdentifier().should.equal('dan');
            newVehicle.logEntries[0].vehicle.getIdentifier().should.equal(vehicleToTransfer);
        });
    });

    describe('ScrapVehicle', () => {
        it('should change a vehicles status to SCRAPPED', async () => {
            const vehicleToScrap = '123456789';

            const scrapVehicle = factory.newTransaction(NS_D, 'ScrapVehicle');
            scrapVehicle.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicleToScrap);

            await businessNetworkConnection.submitTransaction(scrapVehicle);

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
            const vehicle = await assetRegistry.get(vehicleToScrap);
            vehicle.vehicleStatus.should.equal('SCRAPPED');
        });
    });

    describe('ScrapAllVehiclesByColour', () => {
        it('should select vehicles by colour and change vehicles status to SCRAPPED', async () => {
            // Vehicle with beige colour and id 123456789 resides in reposritory
            const vehicleId = '123456789';
            const scrapVehicleTransaction = factory.newTransaction(NS_D, 'ScrapAllVehiclesByColour');
            scrapVehicleTransaction.colour = 'Beige';

            await businessNetworkConnection.submitTransaction(scrapVehicleTransaction);

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
            const vehicle = await assetRegistry.get(vehicleId);
            vehicle.vehicleStatus.should.equal('SCRAPPED');
        });
    });

});
