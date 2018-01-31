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

/* global getAssetRegistry getParticipantRegistry getFactory */

/**
 *
 * @param {com.biz.AnimalMovementDeparture} movementDeparture - model instance
 * @transaction
 */
async function onAnimalMovementDeparture(movementDeparture) {  // eslint-disable-line no-unused-vars
    console.log('onAnimalMovementDeparture');
    if (movementDeparture.animal.movementStatus !== 'IN_FIELD') {
        throw new Error('Animal is already IN_TRANSIT');
    }

     // set the movement status of the animal
    movementDeparture.animal.movementStatus = 'IN_TRANSIT';

     // save the animal
    const ar = await getAssetRegistry('com.biz.Animal');
    await ar.update(movementDeparture.animal);

    // add the animal to the incoming animals of the
    // destination business
    if (movementDeparture.to.incomingAnimals) {
        movementDeparture.to.incomingAnimals.push(movementDeparture.animal);
    } else {
        movementDeparture.to.incomingAnimals = [movementDeparture.animal];
    }

    // save the business
    const br = await getAssetRegistry('com.biz.Business');
    await br.update(movementDeparture.to);
}

/**
 *
 * @param {com.biz.AnimalMovementArrival} movementArrival - model instance
 * @transaction
 */
async function onAnimalMovementArrival(movementArrival) {  // eslint-disable-line no-unused-vars
    console.log('onAnimalMovementArrival');

    if (movementArrival.animal.movementStatus !== 'IN_TRANSIT') {
        throw new Error('Animal is not IN_TRANSIT');
    }

     // set the movement status of the animal
    movementArrival.animal.movementStatus = 'IN_FIELD';

     // set the new owner of the animal
     // to the owner of the 'to' business
    movementArrival.animal.owner = movementArrival.to.owner;

     // set the new location of the animal
    movementArrival.animal.location = movementArrival.arrivalField;

     // save the animal
    const ar = await getAssetRegistry('com.biz.Animal');
    await ar.update(movementArrival.animal);

    // remove the animal from the incoming animals
    // of the 'to' business
    if (!movementArrival.to.incomingAnimals) {
        throw new Error('Incoming business should have incomingAnimals on AnimalMovementArrival.');
    }

    movementArrival.to.incomingAnimals = movementArrival.to.incomingAnimals
      .filter(function(animal) {
          return animal.animalId !== movementArrival.animal.animalId;
      });

    // save the business
    const br = await getAssetRegistry('com.biz.Business');
    await br.update(movementArrival.to);
}

/**
 *
 * @param {com.biz.SetupDemo} setupDemo - SetupDemo instance
 * @transaction
 */
async function setupDemo(setupDemo) {  // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const NS = 'com.biz';

    const farmers = [
        factory.newResource(NS, 'Farmer', 'FARMER_1'),
        factory.newResource(NS, 'Farmer', 'FARMER_2')
    ];

    const businesses = [
        factory.newResource(NS, 'Business', 'BUSINESS_1'),
        factory.newResource(NS, 'Business', 'BUSINESS_2')
    ];

    const fields = [
        factory.newResource(NS, 'Field','FIELD_1'),
        factory.newResource(NS, 'Field','FIELD_2'),
        factory.newResource(NS, 'Field','FIELD_3'),
        factory.newResource(NS, 'Field','FIELD_4')
    ];

    const animals = [
        factory.newResource(NS, 'Animal', 'ANIMAL_1'),
        factory.newResource(NS, 'Animal', 'ANIMAL_2'),
        factory.newResource(NS, 'Animal', 'ANIMAL_3'),
        factory.newResource(NS, 'Animal', 'ANIMAL_4'),
        factory.newResource(NS, 'Animal', 'ANIMAL_5'),
        factory.newResource(NS, 'Animal', 'ANIMAL_6'),
        factory.newResource(NS, 'Animal', 'ANIMAL_7'),
        factory.newResource(NS, 'Animal', 'ANIMAL_8')
    ];

    const regulator = factory.newResource(NS, 'Regulator', 'REGULATOR');
    regulator.email = 'REGULATOR';
    regulator.firstName = 'Ronnie';
    regulator.lastName = 'Regulator';
    const regulatorRegistry = await getParticipantRegistry(NS + '.Regulator');
    await regulatorRegistry.addAll([regulator]);

    farmers.forEach(function(farmer) {
        const sbi = 'BUSINESS_' + farmer.getIdentifier().split('_')[1];
        farmer.firstName = farmer.getIdentifier();
        farmer.lastName = '';
        farmer.address1 = 'Address1';
        farmer.address2 = 'Address2';
        farmer.county = 'County';
        farmer.postcode = 'PO57C0D3';
        farmer.business = factory.newResource(NS, 'Business', sbi);
    });
    const farmerRegistry = await getParticipantRegistry(NS + '.Farmer');
    await farmerRegistry.addAll(farmers);

    businesses.forEach(function(business, index) {
        const farmer = 'FARMER_' + (index + 1);
        business.address1 = 'Address1';
        business.address2 = 'Address2';
        business.county = 'County';
        business.postcode = 'PO57C0D3';
        business.owner = factory.newRelationship(NS, 'Farmer', farmer);
    });
    const businessRegistry = await getAssetRegistry(NS + '.Business');
    await businessRegistry.addAll(businesses);

    fields.forEach(function(field, index) {
        const business = 'BUSINESS_' + ((index % 2) + 1);
        field.name = 'FIELD_' + (index + 1);
        field.business = factory.newRelationship(NS, 'Business', business);
    });
    const fieldRegistry = await getAssetRegistry(NS + '.Field');
    await fieldRegistry.addAll(fields);

    animals.forEach(function(animal, index) {
        const field = 'FIELD_' + ((index % 2) + 1);
        const farmer = 'FARMER_' + ((index % 2) + 1);
        animal.species = 'SHEEP_GOAT';
        animal.movementStatus = 'IN_FIELD';
        animal.productionType = 'MEAT';
        animal.location = factory.newRelationship(NS, 'Field', field);
        animal.owner = factory.newRelationship(NS, 'Farmer', farmer);
    });
    const animalRegistry = await getAssetRegistry(NS + '.Animal');
    await animalRegistry.addAll(animals);
}
