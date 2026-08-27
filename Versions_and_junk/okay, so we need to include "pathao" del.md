okay, so we need to include "pathao" delivery services into our system directly.

the idea is simple: we have customer details, order id, address in our system.
for a store: we'll add pathao store id (fillable in store page)
we'll have a new page in more titled: "External accounts connected"
in that page, we'll be able to input the credentials necessary for pathao.
then, in orders page, for website and social orders which are currently in "Shipped" status, we can send one or bulk of it to pathao and get a consignment ID (will be displayed in the orders page). also, to avoid rate limiting errors: the bulk send to pathao modal will send 19 orders per minute and show live progression.

for now, we'll just work on this feature. 
pls analyse on how we can do this in the most minimal way possible.
some assumptions:
all deliveries are normal, parcel
after reading the documentation, you need to decide on what are the information which the hajjmart admin needs to provide in the external accounts page.
pls analyse on how we can make this.

for now, implement a sandbox so you can directly test it.