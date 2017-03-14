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
 * A shipment has been received by an importer
 * @param {org.acme.shipping.perishable.ShipmentReceived} shipmentReceived - the ShipmentReceived transaction
 * @transaction
 */
function payOut(shipmentReceived) {

    let contract = shipmentReceived.shipment.contract;
    let shipment = shipmentReceived.shipment;
    let payOut = contract.unitPrice * shipment.unitCount;

    console.log( 'Received at: ' + shipmentReceived.timestamp);
    console.log( 'Contract arrivalDateTime: ' + contract.arrivalDateTime);

    // if the shipment did not arrive on time the payout is zero
    if(shipmentReceived.timestamp > contract.arrivalDateTime) {
        payOut = 0;
        console.log('Late shipment');
    }
    else {
        // find the lowest temperature reading
        if (shipment.temperatureReadings) {
            // sort the temperatureReadings by centigrade
            shipment.temperatureReadings.sort(function(a, b) {
                return (a.centigrade - b.centigrade);
            });
            let lowestReading = shipment.temperatureReadings[0];
            let highestReading = shipment.temperatureReadings[shipment.temperatureReadings.length-1];
            let penalty = 0;
            console.log('Lowest temp reading: ' + lowestReading.centigrade );
            console.log('Highest temp reading: ' + highestReading.centigrade );

            // does the lowest temperature violate the contract?
            if(lowestReading.centigrade < contract.minTemperature) {
                penalty += (contract.minTemperature - lowestReading.centigrade) * contract.minPenaltyFactor;
                console.log('Min temp penalty: ' + penalty);
            }

            // does the highest temperature violate the contract?
            if(highestReading.centigrade > contract.maxTemperature) {
                penalty += (highestReading.centigrade - contract.maxTemperature) * contract.maxPenaltyFactor;
                console.log('Max temp penalty: ' + penalty);
            }

            // apply any penalities
            payOut -= (penalty * shipment.unitCount);

            if(payOut < 0) {
                payOut = 0;
            }
        }
    }

    console.log( 'Payout: ' + payOut);
    contract.grower.accountBalance += payOut;
    contract.importer.accountBalance -= payOut;

    console.log('Grower: ' + contract.grower.$identifier + ' new balance: ' + contract.grower.accountBalance );
    console.log('Importer: ' + contract.importer.$identifier + ' new balance: ' + contract.importer.accountBalance );

    return getParticipantRegistry('org.acme.shipping.perishable.Grower')
        .then(function(growerRegistry) {
            // update the grower's balance
            return growerRegistry.update(contract.grower);
        })
        .then(function() {
            return getParticipantRegistry('org.acme.shipping.perishable.Importer');
        })
        .then(function(importerRegistry) {
            // update the importer's balance
            return importerRegistry.update(contract.importer);
        });
}

/**
 * A temperature reading has been received for a shipment
 * @param {org.acme.shipping.perishable.TemperatureReading} temperatureReading - the TemperatureReading transaction
 * @transaction
 */
function temperatureReading(temperatureReading) {

    let shipment = temperatureReading.shipment;

    console.log( 'Adding temperature ' + temperatureReading.centigrade + ' to shipment ' + shipment.$identifier);

    if(shipment.temperatureReadings) {
        shipment.temperatureReadings.push(temperatureReading);
    }
    else {
        shipment.temperatureReadings = [temperatureReading];
    }

    return getAssetRegistry('org.acme.shipping.perishable.Shipment')
        .then(function(shipmentRegistry) {
            // add the temp reading to the shipment
            return shipmentRegistry.update(shipment);
        });
}