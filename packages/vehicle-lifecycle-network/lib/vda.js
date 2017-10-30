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


/**
 * Transfer a vehicle to another private owner
 * @param {org.vda.PrivateVehicleTransfer} privateVehicleTransfer - the PrivateVehicleTransfer transaction
 * @transaction
 */
function privateVehicleTransfer(privateVehicleTransfer) {
    console.log('privateVehicleTransfer');

    var currentParticipant = getCurrentParticipant();


    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';
    var NS_D = 'org.vda';
    var factory = getFactory();

    var seller = privateVehicleTransfer.seller;
    var buyer = privateVehicleTransfer.buyer;
    var vehicle = privateVehicleTransfer.vehicle;

    //change vehicle owner
    vehicle.owner = buyer;

    //PrivateVehicleTransaction for log
    var vehicleTransferLogEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
    vehicleTransferLogEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicle.getIdentifier());
    vehicleTransferLogEntry.seller = factory.newRelationship(NS, 'PrivateOwner', seller.getIdentifier());
    vehicleTransferLogEntry.buyer = factory.newRelationship(NS, 'PrivateOwner', buyer.getIdentifier());
    vehicleTransferLogEntry.timestamp = privateVehicleTransfer.timestamp;
    if (!vehicle.logEntries) {
        vehicle.logEntries = [];
    }

    vehicle.logEntries.push(vehicleTransferLogEntry);

    return getAssetRegistry(vehicle.getFullyQualifiedType())
        .then(function(ar) {
            return ar.update(vehicle);
        });
}

/**
 * Scrap a vehicle
 * @param {org.vda.ScrapVehicle} scrapVehicle - the ScrapVehicle transaction
 * @transaction
 */
function scrapVehicle(scrapVehicle) {
    console.log('scrapVehicle');

    var NS_D = 'org.vda';
    var assetRegistry;

    return getAssetRegistry(NS_D + '.Vehicle')
        .then(function(ar) {
            assetRegistry = ar;
            return assetRegistry.get(scrapVehicle.vehicle.getIdentifier());
        })
        .then(function(vehicle){
            vehicle.vehicleStatus = 'SCRAPPED';
            return assetRegistry.update(vehicle);
        });
}

/**
 * Scrap a vehicle
 * @param {org.vda.ScrapAllVehiclesByColour} scrapAllVehicles - the ScrapAllVehicles transaction
 * @transaction
 */
function scrapAllVehiclesByColour(scrapAllVehicles) {
    console.log('scrapAllVehiclesByColour');

    var NS_D = 'org.vda';
    var assetRegistry;

    return getAssetRegistry(NS_D + '.Vehicle')
        .then(function (ar){
            assetRegistry = ar;
            return query('selectAllCarsByColour', {'colour':scrapAllVehicles.colour});
        })
        .then(function (vehicles) {
            if (vehicles.length >=1 ) {
                var factory = getFactory();
                var vehiclesToScrap = vehicles.filter(function(vehicle) {
                   return vehicle.vehicleStatus !== 'SCRAPPED';
                });
                for (var x = 0; x < vehiclesToScrap.length; x++) {
                    vehiclesToScrap[x].vehicleStatus = 'SCRAPPED';
                    var scrapVehicleEvent = factory.newEvent(NS_D, 'ScrapVehicleEvent');
                    scrapVehicleEvent.vehicle = vehiclesToScrap[x];
                    emit(scrapVehicleEvent);
                }
                return assetRegistry.updateAll(vehiclesToScrap);
             }
        });
}
