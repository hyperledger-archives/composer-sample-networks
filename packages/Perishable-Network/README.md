# Fabric Composer Perishable Goods Demo

Example business network that shows growers, shippers and importers defining contracts for the price
of perishable goods, based on temperature readings received for shipping containers.

The business network defines a parameterizable contract between growers and importers. The contract stipulates
that:

1. On receipts of the shipment the importer pays the grower the unit price x the number of units in the shipment
2. Shipments that arrive late are free
3. Shipments that have breached the low temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory
4. Shipments that have breached the high temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory