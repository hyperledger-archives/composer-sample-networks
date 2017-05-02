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
    var NS_D = 'org.vda';

    var names = ['dan', 'simon', 'jake', 'anastasia', 'matthew', 'mark', 'fenglian', 'sam', 'james', 'nick', 'caroline', 'rachel', 'john', 'rob', 'tom', 'paul', 'ed', 'dave', 'anthony', 'toby', 'ant', 'matt'];
    var vehicles = {
        'Arium': {
            'nova': [
                {
                    'vin': '156478954',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                }
            ],
            'nebula': [
                {
                    'vin': '652345894',
                    'colour': 'blue',
                    'vehicleStatus': 'ACTIVE'
                }
            ]
        }, 
        'manufacturer': {
            'crater': [
                {
                    'vin': '6437956437', 
                    'colour': 'black',
                    'vehicleStatus': 'OFF_THE_ROAD'
                },
                {
                    'vin': '857642213', 
                    'colour': 'red',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '542376495', 
                    'colour': 'silver',
                    'vehicleStatus': 'ACTIVE'
                }
            ],
            'exo': [
                {
                    'vin': '976431649', 
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '564215468', 
                    'colour': 'green',
                    'vehicleStatus': 'OFF_THE_ROAD'
                },
                {
                    'vin': '784512464', 
                    'colour': 'grey',
                    'vehicleStatus': 'ACTIVE'
                }
            ], 
            'banshee': [
                {
                    'vin': '45789612', 
                    'colour': 'silver',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '975467342', 
                    'colour': 'black',
                    'vehicleStatus': 'ACTIVE'
                }
            ]
        },
        'moffat': {
            'colchester': [
                {
                    'vin': '457645764',
                    'colour': 'red',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '312457645',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '65235647',
                    'colour': 'silver',
                    'vehicleStatus': 'OFF_THE_ROAD'
                }
            ], 
            'gorman': [
                {
                    'vin': '85654575',
                    'colour': 'blue',
                    'vehicleStatus': 'ACTIVE'
                }, 
                {
                    'vin': '326548754',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                }
            ]
        }
    };
    
    var manufacturers = [];
    var privateOwners = [];

    for (var name in vehicles) {
        var manufacturer = factory.newResource(NS_M, 'Manufacturer', name);
        manufacturers.push(manufacturer);
    }

   for(var i=0; i<names.length; i++) {
       var name = names[i];
       var privateOwner = factory.newResource(NS, 'PrivateOwner', name);
       privateOwners.push(privateOwner);
   }

    var regulator = factory.newResource(NS, 'Regulator', 'regulator');


    var privateOwnerRegistry;
    var vehicleRegistry;

    return getParticipantRegistry(NS + '.Regulator')
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
        })
        .then(function() {
            return getAssetRegistry(NS_D + '.Vehicle');
        })
        .then(function(vehicleRegistry) {
            var vs = [];
            var carCount = 0;
            for (var mName in vehicles) {
                var manufacturer = vehicles[mName];
                for (var mModel in manufacturer) {
                    var model = manufacturer[mModel];
                    for(var i=0; i<model.length; i++) {
                        var vehicleTemplate = model[i];
                        var vehicle = factory.newResource(NS_D, 'Vehicle', vehicleTemplate.vin);
                        vehicle.owner = factory.newRelationship(NS, 'PrivateOwner', names[carCount]);
                        vehicle.vehicleStatus = vehicleTemplate.vehicleStatus;
                        vehicle.vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
                        vehicle.vehicleDetails.make = mName; 
                        vehicle.vehicleDetails.modelType = mModel; 
                        vehicle.vehicleDetails.colour = vehicleTemplate.colour; 
                        vehicle.vehicleDetails.vin = vehicleTemplate.vin;

                        vs.push(vehicle);
                        carCount++;
                    }
                }
            }
            return vehicleRegistry.addAll(vs);
        });
}