# Fabric Composer Perishable Goods Demo

Example business network that shows growers, shippers and importers negociating the price
of perishable goods, based on temperature readings received for shipping containers.

The business network defines a parameterizable contract between growers and importers. The contract stipulates
that:

- on receipts of the shipment the importer pays the grower the unit price x the number of units in the shipment
- shipments that arrive late are free
- shipments that have breached the low temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory
- shipments that have breached the high temperate threshold have a penalty applied proportional to the magnitude of the breach x a penalty factory