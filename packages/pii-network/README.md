# Personally Identifiable Information  Network

> A business network where members can grant/revoke access to their personal information to other members.

This business network defines:

**Participant**
`Member`

**Transaction**
`AuthorizeAccess` `RevokeAccess`

To test this Business Network Definition in the **Test** tab:

Create two `Member` participants:

```
{
  "$class": "org.acme.pii.Member",
  "email": "memberA@acme.org",
  "firstName": "Billy",
  "lastName": "Thompson"
}
```

```
{
  "$class": "org.acme.pii.Member",
  "email": "memberB@acme.org",
  "firstName": "Jenny",
  "lastName": "Jones"
}
```

Submit a `AuthorizeAccess` transaction:

```
{
  "$class": "org.acme.pii.AuthorizeAccess",
  "memberId": "org.acme.pii.Member#memberA@acme.org"
}
```

This `AuthorizeAccess` allowed `memberA@acme.org` permission to view personal information of other members.

Submit a `RevokeAccess` transaction:

```
{
  "$class": "org.acme.pii.RevokeAccess",
  "memberId": "org.acme.pii.Member#memberB@acme.org"
}
```

This `RevokeAccess` revoked `memberB@acme.org` permission to view personal information of other members.

Congratulations!

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.