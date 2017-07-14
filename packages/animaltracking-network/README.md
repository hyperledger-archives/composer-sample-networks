# Animal Tracking Network

> This is an Animal Tracking Business Network based on UK DEFRA government regulations (https://www.gov.uk/animal-movement-england). Farmers can move animals between farms/fields and the UK government farming regulator has visibility into the locations of all animals and all animal movements between farms.

This business network defines:

**Participants**
`Farmer` `Regulator`

**Assets**
`Animal` `Business` `Field`

**Transactions**
`AnimalMovementDeparture` `AnimalMovementArrival` `SetupDemo`

Each Farmer owns a Business that is identified by a Single Business Identifier (SBI). A Farmer owns a set of Animals. A Business owns a set of Fields. A Field contains a set of Animals owned by the Farmer. Animals can be transferred between Farmers or between Fields.

To test this Business Network Definition in the **Test** tab:

Submit a `SetupDemo` transaction:

```
{
  "$class": "com.biz.SetupDemo"
}
```

This transaction populates the Participant Registries with two `Farmer` participants and a `Regulator` participant. The Asset Registries will have eight `Animal` assets, two `Business` assets and four `Field` assets.

Submit a `AnimalMovementDeparture` transaction:

```
{
  "$class": "com.biz.AnimalMovementDeparture",
  "fromField": "resource:com.biz.Field#FIELD_1",
  "animal": "resource:com.biz.Animal#ANIMAL_1",
  "from": "resource:com.biz.Business#BUSINESS_1",
  "to": "resource:com.biz.Business#BUSINESS_2"
}
```

This transaction moves `ANIMAL_1` from `FIELD_1` at `BUSINESS_1` to `BUSINESS_2`.

Submit a `AnimalMovementArrival` transaction:

```
{
  "$class": "com.biz.AnimalMovementArrival",
  "arrivalField": "resource:com.biz.Field#FIELD_2",
  "animal": "resource:com.biz.Animal#ANIMAL_1",
  "from": "resource:com.biz.Business#BUSINESS_1",
  "to": "resource:com.biz.Business#BUSINESS_2"
}
```

This transaction confirms the receipt of `ANIMAL_1` from `BUSINESS_1` to `FIELD_2` at `BUSINESS_2`.

Congratulations!
