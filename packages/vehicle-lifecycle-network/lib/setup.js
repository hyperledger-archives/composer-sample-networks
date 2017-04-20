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

    let factory = getFactory();
    let NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    let NS = 'org.acme.vehicle.lifecycle';

    // create the participants
    let participants = [];
    // let auctionHouse = factory.newResource(NS, 'AuctionHouse', 'auctionhouse');
    // participants.push(auctionHouse);

    // let dealership = factory.newResource(NS, 'Dealership', 'dealership');
    // participants.push(dealership);

    let manufacturer = factory.newResource(NS_M, 'Manufacturer', 'manufacturer');
    participants.push(manufacturer);

    // let scrapMerchant = factory.newResource(NS, 'ScrapMerchant', 'scrapmerchant');
    // participants.push(scrapMerchant);

    let dan = factory.newResource(NS, 'PrivateOwner', 'dan');
    dan.vehicles = [];
    participants.push(dan);

    let simon = factory.newResource(NS, 'PrivateOwner', 'simon');
    participants.push(simon);

    let regulator = factory.newResource(NS, 'Regulator', 'regulator');
    participants.push(regulator);

    // // create the vehicles
    // let vehicles = [];
    // for(let n=0; n < 10; n++) {
    //     let vehicle = factory.newResource(NS, 'Vehicle', 'VEH_' + n);
    //     let vehicleDetails = factory.newConcept(NS, 'VehicleDetails');
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
    // }

    let promises = [];

    // save all the participants
    for(let n=0; n < participants.length; n++) {
        let participant = participants[n];
        //console.log('Saving ' + participant );
        promises.push(
            getParticipantRegistry(participant.getFullyQualifiedType())
                .then(function (registry) {
                    return registry.add(participant);
                })
        );
    }

    // save all the assets
    // for(let n=0; n < vehicles.length; n++) {
    //     let asset = vehicles[n];
    //     //console.log('Saving ' + asset );
    //     promises.push(
    //         getAssetRegistry(asset.getFullyQualifiedType())
    //             .then(function (registry) {
    //                 return registry.add(asset);
    //             })
    //     );
    // }

    return Promise.all(promises);
}