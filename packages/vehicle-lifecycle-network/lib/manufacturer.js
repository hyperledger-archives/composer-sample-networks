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

    var factory = getFactory();
    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';

    var order = factory.newResource(NS_M, 'Order', placeOrder.transactionID);
    order.vehicleDetails = placeOrder.vehicleDetails;
    order.orderStatus = 'PLACED';
    order.manufacturer = placeOrder.manufacturer;
    order.orderer = factory.newRelationship(NS, 'PrivateOwner', placeOrder.orderer.getIdentifier());

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

    var factory = getFactory();

    // save the new status of the order
    updateOrderStatus.order.orderStatus = updateOrderStatus.orderStatus;

  	// get vehicle registry
  	return getAssetRegistry('org.gov.uk.dvla.Vehicle')
  		.then(function(registry) {
      		if (updateOrderStatus.orderStatus === 'VIN_ASSIGNED') {
            	var vehicle = factory.newResource('org.gov.uk.dvla', 'Vehicle', updateOrderStatus.vin );
                vehicle.vehicleDetails = updateOrderStatus.order.vehicleDetails;
                vehicle.vehicleDetails.vin = updateOrderStatus.vin;
                vehicle.vehicleStatus = 'OFF_THE_ROAD';
                return registry.add(vehicle);
            } else if(updateOrderStatus.orderStatus === 'OWNER_ASSIGNED') {
            	return registry.get(updateOrderStatus.vin)
                    .then(function(vehicle) {
                        vehicle.vehicleStatus = 'ACTIVE';
                        vehicle.owner = factory.newRelationship('org.acme.vehicle.lifecycle', 'PrivateOwner', updateOrderStatus.order.orderer.email);
                        vehicle.numberPlate = updateOrderStatus.numberPlate || '';
                        vehicle.vehicleDetails.numberPlate = updateOrderStatus.numberPlate || '';
                        vehicle.v5c = updateOrderStatus.v5c || '';
                        return registry.update(vehicle);
                    });
            }
    	})
  		.then(function() {
      		// get order registry
    		return getAssetRegistry(updateOrderStatus.order.getFullyQualifiedType());
    	})
  		.then(function(registry) {
      		// update order status
            updateOrderStatus.order.vehicleDetails.vin = updateOrderStatus.vin || '';
      		return registry.update(updateOrderStatus.order);
    	});
}
