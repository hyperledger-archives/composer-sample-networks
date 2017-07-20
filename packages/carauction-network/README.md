# Car Auction Network

> This is an interactive, distributed, car auction demo. List assets for sale (setting a reserve price), and watch as assets that have met their reserve price are automatically transferred to the highest bidder at the end of the auction.

This business network defines:

**Participants:**
`Member` `Auctioneer`

**Assets:**
`Vehicle` `VehicleListing`

**Transactions:**
`Offer` `CloseBidding`

The `makeOffer` function is called when an `Offer` transaction is submitted. The logic simply checks that the listing for the offer is still for sale, and then adds the offer to the listing, and then updates the offers in the `VehicleListing` asset registry.

The `closeBidding` function is called when a `CloseBidding` transaction is submitted for processing. The logic checks that the listing is still for sale, sorts the offers by bid price, and then if the reserve has been met, transfers the ownership of the vehicle associated with the listing to the highest bidder. Money is transferred from the buyer's account to the seller's account, and then all the modified assets are updated in their respective registries.

To test this Business Network Definition in the **Test** tab:

In the `Auctioneer` participant registry, create a new participant.

```
{
  "$class": "org.acme.vehicle.auction.Auctioneer",
  "email": "auction@acme.org",
  "firstName": "Jenny",
  "lastName": "Jones"
}
```

In the `Member` participant registry, create two participants.

```
{
  "$class": "org.acme.vehicle.auction.Member",
  "balance": 5000,
  "email": "memberA@acme.org",
  "firstName": "Amy",
  "lastName": "Williams"
}
```

```
{
  "$class": "org.acme.vehicle.auction.Member",
  "balance": 5000,
  "email": "memberB@acme.org",
  "firstName": "Billy",
  "lastName": "Thompson"
}
```

In the `Vehicle` asset registry, create a new asset of a vehicle owned by `memberA@acme.org`.

```
{
  "$class": "org.acme.vehicle.auction.Vehicle",
  "vin": "vin:1234",
  "owner": "resource:org.acme.vehicle.auction.Member#memberA@acme.org"
}
```

In the `VehicleListing` asset registry, create a vehicle listing for car `vin:1234`.

```
{
  "$class": "org.acme.vehicle.auction.VehicleListing",
  "listingId": "listingId:ABCD",
  "reservePrice": 3500,
  "description": "Arium Nova",
  "state": "FOR_SALE",
  "vehicle": "resource:org.acme.vehicle.auction.Vehicle#vin:1234"
}
```

You've just listed an Arium Nova for auction, with a reserve price of 3500!

As soon as a `VehicleListing` has been created (and is in the `FOR_SALE` state) participants can submit `Offer` transactions to bid on a vehicle listing.

Submit an `Offer` transaction, by submitting a transaction and selecting `Offer` from the dropdown.

```
{
  "$class": "org.acme.vehicle.auction.Offer",
  "bidPrice": 2000,
  "listing": "resource:org.acme.vehicle.auction.VehicleListing#listingId:ABCD",
  "member": "resource:org.acme.vehicle.auction.Member#memberA@acme.org"
}
```

```
{
  "$class": "org.acme.vehicle.auction.Offer",
  "bidPrice": 3500,
  "listing": "resource:org.acme.vehicle.auction.VehicleListing#listingId:ABCD",
  "member": "resource:org.acme.vehicle.auction.Member#memberB@acme.org"
}
```

To end the auction submit a `CloseBidding` transaction for the listing.

```
{
  "$class": "org.acme.vehicle.auction.CloseBidding",
  "listing": "resource:org.acme.vehicle.auction.VehicleListing#listingId:ABCD"
}
```

This simply indicates that the auction for `listingId:ABCD` is now closed, triggering the `closeBidding` function that was described above.

To see the Vehicle was sold you need to click on the `Vehicle` asset registry to check the owner of the car. The reserve price was met by owner `memberB@acme.org` so you should see the owner of the vehicle is now `memberB@acme.org`.

If you check the state of the VehicleListing with `listingId:ABCD` is should be `SOLD`.

If you click on the `Member` asset registry you can check the balance of each User. You should see that the balance of the buyer `memberB@acme.org` has been debited by `3500`, whilst the balance of the seller `memberA@acme.org` has been credited with `3500`.

Congratulations!
