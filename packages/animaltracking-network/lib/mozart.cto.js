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

/*eslint-disable no-unused-vars*/
/*eslint-disable no-undef*/

/**
 *
 * @param {com.biz.AnimalMovementDeparture} movementDeparture
 * @transaction
 */
function onAnimalMovementDeparture(movementDeparture) {
    console.log('onAnimalMovementDeparture');
    if (movementDeparture.animal.movementStatus !== 'IN_FIELD') {
        throw new Error('Animal is already IN_TRANSIT');
    }

     // set the movement status of the animal
    movementDeparture.animal.movementStatus = 'IN_TRANSIT';

     // save the animal
    return getAssetRegistry('com.biz.Animal')
  .then(function(ar) {
      return ar.update(movementDeparture.animal);
  })
  .then(function() {
    // add the animal to the incoming animals of the
    // destination business
      if (movementDeparture.to.incomingAnimals) {
          movementDeparture.to.incomingAnimals.push(movementDeparture.animal);
      } else {
          movementDeparture.to.incomingAnimals = [movementDeparture.animal];
      }

      // save the business
      return getAssetRegistry('com.biz.Business');
  })
  .then(function(br) {
      return br.update(movementDeparture.to);
  });
}

/**
 *
 * @param {com.biz.AnimalMovementArrival} movementArrival
 * @transaction
 */
function onAnimalMovementArrival(movementArrival) {
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
    return getAssetRegistry('com.biz.Animal')
  .then(function(ar) {
      return ar.update(movementArrival.animal);
  })
  .then(function() {
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
      return getAssetRegistry('com.biz.Business');
  })
  .then(function(br) {
      return br.update(movementArrival.to);
  });
}

/**
 *
 * @param {com.biz.SetupDemo} setupDemo
 * @transaction
 */
function setupDemo(setupDemo) {
    var factory = getFactory();
    var NS = 'com.biz';

    var farmers = [
        factory.newResource(NS, 'Farmer', 'FARMER_1'),
        factory.newResource(NS, 'Farmer', 'FARMER_2')
    ];

    var businesses = [
        factory.newResource(NS, 'Business', 'BUSINESS_1'),
        factory.newResource(NS, 'Business', 'BUSINESS_2')
    ];

    var fields = [
        factory.newResource(NS, 'Field','FIELD_1'),
        factory.newResource(NS, 'Field','FIELD_2'),
        factory.newResource(NS, 'Field','FIELD_3'),
        factory.newResource(NS, 'Field','FIELD_4')
    ];

    var animals = [
        factory.newResource(NS, 'Animal', 'ANIMAL_1'),
        factory.newResource(NS, 'Animal', 'ANIMAL_2'),
        factory.newResource(NS, 'Animal', 'ANIMAL_3'),
        factory.newResource(NS, 'Animal', 'ANIMAL_4'),
        factory.newResource(NS, 'Animal', 'ANIMAL_5'),
        factory.newResource(NS, 'Animal', 'ANIMAL_6'),
        factory.newResource(NS, 'Animal', 'ANIMAL_7'),
        factory.newResource(NS, 'Animal', 'ANIMAL_8')
    ];
    return getParticipantRegistry(NS + '.Regulator')
  .then(function(regulatorRegistry) {
      var regulator = factory.newResource(NS, 'Regulator', 'REGULATOR');
      regulator.email = 'REGULATOR';
      regulator.firstName = 'Ronnie';
      regulator.lastName = 'Regulator';
      return regulatorRegistry.addAll([regulator]);
  })
  .then(function() {
      return getParticipantRegistry(NS + '.Farmer');
  })
  .then(function(farmerRegistry) {
      farmers.forEach(function(farmer) {
          var sbi = 'BUSINESS_' + farmer.getIdentifier().split('_')[1];
          farmer.firstName = farmer.getIdentifier();
          farmer.lastName = '';
          farmer.address1 = 'Address1';
          farmer.address2 = 'Address2';
          farmer.county = 'County';
          farmer.postcode = 'PO57C0D3';
          farmer.business = factory.newResource(NS, 'Business', sbi);
      });
      return farmerRegistry.addAll(farmers);
  })
  .then(function() {
      return getAssetRegistry(NS + '.Business');
  })
  .then(function(businessRegistry) {
      businesses.forEach(function(business, index) {
          var cph = 'FIELD_' + (index + 1);
          var farmer = 'FARMER_' + (index + 1);
          business.address1 = 'Address1';
          business.address2 = 'Address2';
          business.county = 'County';
          business.postcode = 'PO57C0D3';
          business.owner = factory.newRelationship(NS, 'Farmer', farmer);
      });

      return businessRegistry.addAll(businesses);
  })
  .then(function() {
      return getAssetRegistry(NS + '.Field');
  })
  .then(function(fieldRegistry) {
      fields.forEach(function(field, index) {
          var business = 'BUSINESS_' + ((index % 2) + 1);
          field.name = 'FIELD_' + (index + 1);
          field.business = factory.newRelationship(NS, 'Business', business);
      });
      return fieldRegistry.addAll(fields);
  })
  .then(function() {
      return getAssetRegistry(NS + '.Animal');
  })
  .then(function(animalRegistry) {
      animals.forEach(function(animal, index) {
          var field = 'FIELD_' + ((index % 2) + 1);
          var farmer = 'FARMER_' + ((index % 2) + 1);
          animal.species = 'SHEEP_GOAT';
          animal.movementStatus = 'IN_FIELD';
          animal.productionType = 'MEAT';
          animal.location = factory.newRelationship(NS, 'Field', field);
          animal.owner = factory.newRelationship(NS, 'Farmer', farmer);
      });
      return animalRegistry.addAll(animals);
  });
}

/*eslint-enable no-unused-vars*/
/*eslint-enable no-undef*/
