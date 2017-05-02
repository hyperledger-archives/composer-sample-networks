# Hyperledger Composer Perishable Goods Demo

Example business network that shows growers, shippers and importers defining contracts for the price
of perishable goods, based on temperature readings received for shipping containers.

The business network defines a parameterizable contract between growers and importers. The contract stipulates
that:

1. On receipts of the shipment the importer pays the grower the unit price x the number of units in the shipment
2. Shipments that arrive late are free
3. Shipments that have breached the low temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory
4. Shipments that have breached the high temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory

### Running Locally (Unit Test)

`git clone` the repository for the sample, `cd` into its directory and then run `npm install` followed by `npm test`. The unit test will run and should pass.

### Demo inside Hyperledger Composer

Import the sample into Hyperledger Composer using the `Import/Replace` button.

Submit a `SetupDemo` transaction
 
You will see the 3 participants have been created (a grower, an importer and a shipper) along with 2 assets (a shipment `SHIP_001` and a contract `CON_001`).

Inspect the details of `SHIP_001` and `CON_001`.

Submit a `TemperatureReading` for the shipment `SHIP_001`. If the temperature reading falls outside the min/max range of the contract then the price received by the grower will be reduced. You may submit several readings if you wish. Each reading will be aggregated within `SHIP_001`.

Submit a `ShipmentReceived` transaction for the shipment `SHIP_001` to trigger the payout to the grower, based on the parameters of the `CON_001` contract. If the date-time of the `ShipmentReceived` transaction is after the `arrivalDateTime` on `CON_001` then the grower will no receive any payment for the shipment.




