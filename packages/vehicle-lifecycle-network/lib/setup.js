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
 * Setup the demo
 * @param {org.acme.vehicle.lifecycle.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
function setupDemo(setupDemo) {
    console.log('setupDemo');

    var factory = getFactory();
    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';

    // create the participants
    var manufacturers = [];
    var privateOwners = [];

    // var auctionHouse = factory.newResource(NS, 'AuctionHouse', 'auctionhouse');
    // participants.push(auctionHouse);

    // var dealership = factory.newResource(NS, 'Dealership', 'dealership');
    // participants.push(dealership);

    var manufacturer = factory.newResource(NS_M, 'Manufacturer', 'manufacturer');
    manufacturers.push(manufacturer);

    // var scrapMerchant = factory.newResource(NS, 'ScrapMerchant', 'scrapmerchant');
    // participants.push(scrapMerchant);

    var dan = factory.newResource(NS, 'PrivateOwner', 'dan');
    dan.vehicles = [];
    privateOwners.push(dan);

    var simon = factory.newResource(NS, 'PrivateOwner', 'simon');
    privateOwners.push(simon);

    var regulator = factory.newResource(NS, 'Regulator', 'regulator');
    // participants.push(regulator);

    return Promise.resolve()
        .then(function() {
            return getParticipantRegistry(NS + '.Regulator');
        })
        .then(function(regulatorRegistry) {
            return regulatorRegistry.add(regulator);
        })
        .then(function() {
            return getParticipantRegistry(NS_M + '.Manufacturer');
        })
        .then(function(manufacturerRegistry) {
            return manufacturerRegistry.addAll(manufacturers);
        })
        .then(function() {
            return getParticipantRegistry(NS + '.PrivateOwner');
        })
        .then(function(privateOwnerRegistry) {
            return privateOwnerRegistry.addAll(privateOwners);
        });

    // // create the vehicles
    // var vehicles = [];
    // for(var n=0; n < 10; n++) {
    //     var vehicle = factory.newResource(NS, 'Vehicle', 'VEH_' + n);
    //     var vehicleDetails = factory.newConcept(NS, 'VehicleDetails');
    //     vehicleDetails.model = 'Mustang';
    //     vehicleDetails.make = 'Ford';
    //     vehicleDetails.colour = 'Yellow';
    //     vehicleDetails.co2Rating = 10;
    //     vehicle.vehicleDetails = vehicleDetails;
    //     vehicle.vehicleStatus = 'CREATED';
    //     vehicle.manufacturer = factory.newRelationship(NS, 'Manufacturer', manufacturer.$identifier );
    //     vehicle.privateOwner = factory.newRelationship(NS, 'PrivateOwner', dan.$identifier );
    //     dan.vehicles.push(factory.newRelationship(NS, 'Vehicle', vehicle.$identifier ));
    //     vehicles.push(vehicle);
    // // }

    // var promises = [];

    // // save all the participants
    // for(var n=0; n < participants.length; n++) {
    //     var participant = participants[n];
    //     //console.log('Saving ' + participant );
    //     promises.push(
    //         getParticipantRegistry(participant.getFullyQualifiedType())
    //             .then(function (registry) {
    //                 return registry.add(participant);
    //             })
    //             .catch(function(erorr) {
    //                 console.log('Attempted to add ' + participant.getFullyQualifiedType() + ' with ID ' + participant.getIdentifier())
    //             })
    //     );
    // }



    // save all the assets
    // for(var n=0; n < vehicles.length; n++) {
    //     var asset = vehicles[n];
    //     //console.log('Saving ' + asset );
    //     promises.push(
    //         getAssetRegistry(asset.getFullyQualifiedType())
    //             .then(function (registry) {
    //                 return registry.add(asset);
    //             })
    //     );
    // }

    // return Promise.all(promises);
}