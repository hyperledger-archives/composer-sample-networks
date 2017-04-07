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
 * Manufacturing a new vehicle
 * @param {org.acme.vehicle.lifecycle.ManufactureVehicle} manufactureVehicle - the ManufactureVehicle transaction
 * @transaction
 */
function manufactureVehicle(manufactureVehicle) {
    console.log('manufactureVehicle');

    let factory = getFactory();
    let NS = 'org.acme.vehicle.lifecycle';

    // create the vehicle
    let vehicle = factory.newResource(NS, 'Vehicle', manufactureVehicle.vin);
    vehicle.vehicleStatus = 'CREATED';
    vehicle.vehicleDetails = manufactureVehicle.vehicleDetails;
    vehicle.manufacturer = manufactureVehicle.manufacturer;

    return getAssetRegistry('org.acme.vehicle.lifecycle.Vehicle')
        .then(function (vehicleRegistry) {
            return vehicleRegistry.add(vehicle);
        });
}

/**
 * A transfer from one private owner to another
 * @param {org.acme.vehicle.lifecycle.PrivateTransfer} privateTransfer - the PrivateTransfer transaction
 * @transaction
 */
function privateTransfer(privateTransfer) {
    console.log('privateTransfer');

    if (privateTransfer.vehicle.vehicleStatus !== 'AUTHORIZED') {
        throw new Error('Cannot transfer the vehicle to private ownership when in state ' + privateTransfer.vehicle.vehicleStatus);
    }

    privateTransfer.vehicle.privateOwner = privateTransfer.privateOwner;
    privateTransfer.vehicle.companyOwner = null;

    if (!privateTransfer.privateOwner.vehicles) {
        privateTransfer.privateOwner.vehicles = [];
    }
    privateTransfer.privateOwner.vehicles.push(privateTransfer.vehicle);

    return getParticipantRegistry('org.acme.vehicle.lifecycle.PrivateOwner')
        .then(function (privateOwnerRegistry) {
            // update the owner of the vehicle
            return privateOwnerRegistry.update(privateTransfer.privateOwner);
        })
        .then(function () {
            return getAssetRegistry('org.acme.vehicle.lifecycle.Vehicle');
        })
        .then(function (vehicleRegistry) {
            // update the state of the vehicle
            return vehicleRegistry.update(privateTransfer.vehicle);
        });
}

/**
 * A transfer from one company owner to another
 * @param {org.acme.vehicle.lifecycle.CompanyTransfer} companyTransfer - the CompanyTransfer transaction
 * @transaction
 */
function companyTransfer(companyTransfer) {
    console.log('companyTransfer');

    if (companyTransfer.vehicle.vehicleStatus !== 'AUTHORIZED') {
        throw new Error('Cannot transfer the vehicle to company ownership when in state ' + companyTransfer.vehicle.vehicleStatus);
    }

    companyTransfer.vehicle.companyOwner = companyTransfer.companyOwner;
    companyTransfer.vehicle.privateOwner = null;

    if (!companyTransfer.companyOwner.vehicles) {
        companyTransfer.companyOwner.vehicles = [];
    }
    companyTransfer.companyOwner.vehicles.push(companyTransfer.vehicle);

    return getParticipantRegistry('org.acme.vehicle.lifecycle.CompanyOwner')
        .then(function (companyOwnerRegistry) {
            // update the owner of the vehicle
            return companyOwnerRegistry.update(companyTransfer.companyOwner);
        })
        .then(function () {
            return getAssetRegistry('org.acme.vehicle.lifecycle.Vehicle');
        })
        .then(function (vehicleRegistry) {
            // update the state of the vehicle
            return vehicleRegistry.update(companyTransfer.vehicle);
        });
}

/**
 * Authorize a vehicle
 * @param {org.acme.vehicle.lifecycle.Authorise} authorize - the Authorize transaction
 * @transaction
 */
function authorize(authorize) {
    console.log('authorize');

    if (authorize.vehicle.vehicleStatus !== 'CREATED') {
        throw new Error('Cannot authorize the vehicle when in state ' + companyTransfer.vehicle.vehicleStatus);
    }

    authorize.vehicle.vehicleStatus = 'AUTHORIZED';

    return getAssetRegistry('org.acme.vehicle.lifecycle.Vehicle')
        .then(function (vehicleRegistry) {
            // update the state of the vehicle
            return vehicleRegistry.update(authorize.vehicle);
        });
}


/**
 * Scrap a vehicle
 * @param {org.acme.vehicle.lifecycle.ScrapVehicle} scrapVehicle - the ScrapVehicle transaction
 * @transaction
 */
function scrapVehicle(scrapVehicle) {
    console.log('scrapVehicle');

    if (scrapVehicle.vehicle.vehicleStatus !== 'AUTHORIZED') {
        throw new Error('Cannot scrap the vehicle when in state ' + companyTransfer.vehicle.vehicleStatus);
    }

    scrapVehicle.vehicle.vehicleStatus = 'SCRAPPED';

    return getAssetRegistry('org.acme.vehicle.lifecycle.Vehicle')
        .then(function (vehicleRegistry) {
            // update the state of the vehicle
            return vehicleRegistry.update(scrapVehicle.vehicle);
        });
}

/**
 * SetupDemo
 * @param {org.acme.vehicle.lifecycle.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
function setupDemo(setupDemo) {
    console.log('setupDemo');

    let factory = getFactory();
    let NS = 'org.acme.vehicle.lifecycle';

    // create the manufacturer
    let manufacturer = factory.newResource(NS, 'Manufacturer', 'manufacturer@email.com');

    // create the regulator
    let regulator = factory.newResource(NS, 'Regulator', 'regulator@email.com');

    // create the dealership
    let dealership = factory.newResource(NS, 'Dealership', 'dealership@email.com');

    // create the auctionhouse
    let auctionhouse = factory.newResource(NS, 'AuctionHouse', 'auctionhouse@email.com');

    // create the scrapmerchant
    let scrapmerchant = factory.newResource(NS, 'ScrapMerchant', 'scrapmerchant@email.com');

    // create the private owner, dan
    let dan = factory.newResource(NS, 'PrivateOwner', 'dan@email.com');

    // create the private owner, simon
    let simon = factory.newResource(NS, 'PrivateOwner', 'simon@email.com');

    return getParticipantRegistry(NS + '.Manufacturer')
        .then(function (manufacturerRegistry) {
            return manufacturerRegistry.addAll([manufacturer]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Regulator');
        })
        .then(function (regulatorRegistry) {
            return regulatorRegistry.addAll([regulator]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Dealership');
        })
        .then(function (dealershipRegistry) {
            return dealershipRegistry.addAll([dealership]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.AuctionHouse');
        })
        .then(function (auctionhouseRegistry) {
            return auctionhouseRegistry.addAll([auctionhouse]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.ScrapMerchant');
        })
        .then(function (scrapmerchantRegistry) {
            return scrapmerchantRegistry.addAll([scrapmerchant]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.PrivateOwner');
        })
        .then(function (privateOwnerRegistry) {
            return privateOwnerRegistry.addAll([dan, simon]);
        });
}