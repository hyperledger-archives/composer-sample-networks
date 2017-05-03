# Animal Tracking Network
Defines an Animal Movement business network based on UK DEFRA government regulations https://www.gov.uk/animal-movement-england.

Farmers can move animals between farms/fields and the UK government farming regulator has
visibility into the locations of all animals and all animal movements between farms.

- Each Farmer owns a Business that is identified by a Single Business Identifier (SBI)
- Each Farmer owns a set of Animals
- Each Business owns a set of Fields
- Each Field contains a set of Animals owned by the Farmer
- Animals can be transfered between Farmers or between Fields

## Demo inside Hyperledger Composer
Import the sample into Hyperledger Composer using the `Import/Replace` button.

Submit a `SetupDemo` transaction to bootstrap a scenario to get you started. 

You will see the 2 `Farmer` participants have been created, `FARMER_1` and `FARMER_2` as well as 2 `Field`'s, 2 `Business`'s and 8 `Animal`'s. 

Submit a `AnimalMovementDeparture` when you wish to sent an `Animal` to another `Farmer`, then, as the `Animal`'s new owner,  submit an `AnimalMovementArrival` transaction to confirm revceipt. 

![Definiton Diagram](./network.png)
