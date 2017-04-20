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
 * Place an order for a vehicle
 * @param {org.acme.vehicle.lifecycle.manufacturer.PlaceOrder} placeOrder - the PlaceOrder transaction
 * @transaction
 */
function placeOrder(placeOrder) {
    console.log('placeOrder');

    let factory = getFactory();
    let NS = 'org.acme.vehicle.lifecycle.manufacturer';

    let order = factory.newResource(NS, 'Order', placeOrder.transactionId);
    order.vehicleDetails = placeOrder.vehicleDetails;
    order.orderStatus = 'PLACED';
    order.manufacturer = placeOrder.manufacturer;

    // save the order
    return getAssetRegistry(order.getFullyQualifiedType())
        .then(function (registry) {
            return registry.add(order);
        });
}

/**
 * Update the status of an order
 * @param {org.acme.vehicle.lifecycle.manufacturer.UpdateOrderStatus} updateOrderStatus - the UpdateOrderStatus transaction
 * @transaction
 */
function updateOrderStatus(updateOrderStatus) {
    console.log('updateOrderStatus');

    let factory = getFactory();

    // save the new status of the order
    updateOrderStatus.order.orderStatus = updateOrderStatus.orderStatus;

    let promises = [];

    if(updateOrderStatus.orderStatus === 'VIN_ASSIGNED') {
        updateOrderStatus.order.vehicleDetails.vin = updateOrderStatus.vin;
        // create the vehicle with the DVLA
        promises.push(getAssetRegistry('org.gov.uk.dvla.Vehicle')
        .then(function (registry) {
            let vehicle = factory.newResource('org.gov.uk.dvla', 'Vehicle', updateOrderStatus.vin );
            vehicle.vehicleDetails = updateOrderStatus.order.vehicleDetails;
            return registry.add(vehicle);
        }));
    }
    else if(updateOrderStatus.orderStatus === 'OWNER_ASSIGNED') {
        // update the DVLA vehicle with owner information
        promises.push(getAssetRegistry('org.gov.uk.dvla.Vehicle')
        .then(function (registry) {
            let vehicle = registry.get('org.gov.uk.dvla.Vehicle', updateOrderStatus.order.vehicleDetails.vin );
            vehicle.vehicleStatus = 'ACTIVE';
            vehicle.owner = updateOrderStatus.order.orderer;
            vehicle.numberPlate = updateOrderStatus.numerPlate;
            return registry.update(vehicle);
        }));
    }

    // save the order
    promises.push(getAssetRegistry(updateOrderStatus.order.getFullyQualifiedType())
        .then(function (registry) {
            return registry.update(updateOrderStatus.order);
        }));

    // run all promises
    return Promise.all(promises);
}

