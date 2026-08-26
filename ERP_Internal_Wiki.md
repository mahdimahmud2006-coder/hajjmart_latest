# ERP System — Internal Wiki & Implementation Tracker

> **Purpose:** Living internal documentation for the ERP system's current business rules, store-scoping behavior, completed work, and outstanding tasks.
>
> **Current context:** Small business with one existing store, designed to support future multi-store expansion.

---

## 1. System Overview

The ERP is a full-stack business management system covering:

- E-commerce
- Social-commerce order management (Facebook Messenger and similar channels)
- POS / physical store sales
- Product and inventory management
- Customer management
- Order management
- Dashboard
- Returns and exchanges
- Promotions
- Store management
- Employee management
- Reporting
- Activity logging
- English and Bengali language support
- Offline browser-based operation for POS and social-commerce workflows

# 2. Core Store-Scoping Business Rule

## Working Location

Store context is controlled through the **Working Location selector in the sidebar**.

### Employees

An employee has a fixed working location/store.

- Their working location is their assigned store.
- Store-scoped pages/data must automatically reflect that store.
- Employees should not be able to operate outside their assigned store unless explicitly permitted by a future business rule.

### Admins

Admins have broader store access.

- Admins can select **All Stores**.
- Admins can select a particular store.
- When a particular store is selected, store-scoped pages reflect that store.
- When **All Stores** is selected, store-scoped pages aggregate/show data across all stores.

### Meaning of "Scoped"

When a page is described as **scoped**, it means:

> The page respects the Working Location selected in the sidebar.

Therefore, the page itself does not necessarily need a separate store selector.

### Meaning of "Not Scoped"

When a page is described as **not scoped**, it means:

> The page shows shared/global information regardless of the selected working location.

---

# 3. Module-by-Module Status

## 3.1 Orders

### Status
Mostly complete, but store-access behavior needs correction.

### Business Rule

- Orders are store-specific.
- Employees should see orders belonging to their working store.
- Admins should be able to use the Working Location selector:
  - Specific store → show that store's orders.
  - All Stores → show orders across all stores.

### Outstanding Fix

- The Orders page is currently incorrectly scoped for admins in the existing implementation.
- Fix the admin behavior so that the Working Location selector properly supports **specific store / All Stores**.

---

## 3.2 Products

### Status
Partially complete.

### Business Rule

The main Products tab is **global / not scoped**.

It should show the complete product catalogue across the business.

However:

- Products unavailable at the currently relevant store must clearly indicate that they are unavailable there.
- Product existence is global.
- Store-level availability/stock is separate from the global product catalogue.

### Admin Requirement

For admin users, product information should make it possible to understand which store has/doesn't have a given product.

### Outstanding Work

- Verify and tighten the distinction between:
  - Global product catalogue
  - Store-level product availability
  - Store-level stock

---

## 3.3 Stock

### Status
Scoped and substantially implemented.

### Business Rule

Stock is store-specific.

- Employees → their working store.
- Admins → selected store or All Stores through Working Location.

---

## 3.4 Stock Entry

### Status
Scoped and substantially implemented.

### Business Rule

Stock entries are store-specific.

- Employees → assigned store.
- Admins → selected store / All Stores.

### Admin Requirement

Admins should be able to determine which store has what stock.

---

## 3.5 Stock Movements

### Status
Needs correction.

### Business Rule

Stock movements are store-specific for normal employees, while admins require cross-store visibility through the Working Location selector.

### Current Problem

The existing implementation is incorrectly restricting/scoping the page for admins as well.

### Required Behavior

- Employee → automatically restricted to working store.
- Admin + specific store → show that store.
- Admin + All Stores → show all stores.

---

## 3.6 Categories

### Status
Done.

### Business Rule

Categories are **global / not scoped**.

All categories should be visible regardless of store.

---

## 3.7 Barcode

### Status
Done.

### Business Rule

Barcode management is **global / not scoped**.

The current implementation correctly does not scope it to a store.

---

## 3.8 Customers

### Status
Needs correction.

### Business Rule

Customer information is **shared across all stores**.

Therefore:

- Customers are global.
- Customer records should not be store-scoped.
- All stores share the same customer information.

### Customer Order History

Although the customer itself is global, each order in the customer's history must identify **which store the purchase came from**.

This preserves global customer identity while retaining store-level transaction information. In simpler words, all employees and admins can see all the orders of customers accross all stores.

---

## 3.9 Social Commerce

### Status
Partially implemented; needs several fixes.

### Store Scoping

Product availability in Social Commerce is store-scoped.

- Employees → their working store.
- Admins → selected store or All Stores through Working Location.

### Outstanding UI Work

There are some redundant/unnecessary buttons in the Social Commerce page.

- Review the page.
- Identify redundant buttons.
- Remove unnecessary controls.

### Multiple Payment Methods

Social Commerce orders need to support **split payments**.

Example:

- Part cash
- Part bKash

The implementation should support multiple payment methods within the same transaction, similar to the existing POS behavior.

### Required Direction

Reuse/align with the POS page's existing multi-payment logic rather than inventing a separate payment model if possible.

---

## 3.10 POS

### Status
Existing functionality provides the reference implementation for split/multiple payments.

### Relevant Existing Capability

POS already supports multiple payment methods for one transaction.

This behavior should serve as the model for Social Commerce.

---

## 3.11 Offline Operations

### Status
Not completed.

### Requirement

The frontend/browser must eventually support offline operation for:

- POS sales
- Social-commerce sales

### Current Decision

Deployment/infrastructure required to make the offline system operational will be handled later.

Therefore, offline operation should remain an explicit outstanding project item rather than being considered complete.

---

## 3.12 Returns & Exchanges

### Status
Needs final scoping implementation/verification.

### Current Decision

For now, Returns & Exchanges should **not be restricted to a single store for admins**.

The intended general model is:

- Employee → working-store context.
- Admin → Working Location can be a specific store or All Stores.

The exact page behavior should follow the core Working Location rule rather than hard-coding an admin-only restriction.

---

## 3.13 Promotions

### Status
Not started.

### Outstanding Work

The Promotions page has not been worked on yet.

Required:

- Full implementation
- Business logic
- UI
- Store behavior where applicable
- Validation/testing

---

## 3.14 Stores / Store Management

### Status
Mostly complete / looks good.

### Existing Requirement

Stores need their relevant information/configuration to be uploadable and manageable.

### Status Note

The store page currently looks good overall.

Verify that all required store information can be properly uploaded/managed.

---

## 3.15 Employees

### Status
Looks good.

The employee management page is currently in a good state.

Store assignment/working location must remain consistent with the core store-scoping rules.

---

## 3.16 Reporting

### Status
Major work required.

### Store Scoping

Reporting **is store-scoped**.

#### Employee

- Employee reports are automatically limited to their working store.

#### Admin

- Admin can select a specific store.
- Admin can select All Stores.
- Reports update according to the selected Working Location.

### Outstanding Work

Every major part of the Reporting page needs further implementation/review.

This should be treated as a significant unfinished module.

---

## 3.17 Risk Review

### Status
Not started.

No meaningful implementation work has been completed yet.

### Outstanding Work

The Risk Review functionality needs to be designed and implemented.

---

## 3.18 Activity Log

### Status
Done / defined.

### Business Rule

Activity Log is **global / not store-scoped**.

It should always show activity across all stores.

This applies regardless of the Working Location selected in the sidebar.

---

# 4. Global Scoping Matrix

| Module | Employee | Admin | Global / Not Store-Scoped |
|---|---|---|---|
| Orders | Working store | Selected store / All Stores | No |
| Products | Global catalogue + store availability | Global catalogue + store visibility | Yes |
| Stock | Working store | Selected store / All Stores | No |
| Stock Entry | Working store | Selected store / All Stores | No |
| Stock Movements | Working store | Selected store / All Stores | No |
| Categories | Global | Global | Yes |
| Barcode | Global | Global | Yes |
| Customers | Global | Global | Yes |
| Customer Order History | Orders identify originating store | Orders identify originating store | Customer itself is global |
| Social Commerce | Working store | Selected store / All Stores | No |
| POS | Working store | Selected store / All Stores | No |
| Returns & Exchanges | Working store | Selected store / All Stores | No |
| Promotions | TBD | TBD | TBD |
| Stores | Global management context | Global management context | Yes |
| Employees | Global management context | Global management context | Yes |
| Reporting | Working store | Selected store / All Stores | No |
| Risk Review | TBD | TBD | TBD |
| Activity Log | All stores | All stores | Yes |

> **Important:** "TBD" means the module still needs a business-rule decision during implementation. It should not be silently assumed to be store-scoped or global.

---

# 5. Important Architectural Principle

The ERP should avoid implementing store filtering independently on every page.

Instead, the **Working Location** should be treated as a central application-level context.

Conceptually:

```text
Current User
    │
    ├── Employee
    │     └── Fixed Working Location
    │
    └── Admin
          ├── All Stores
          └── Specific Store
                    │
                    ▼
            Working Location Context
                    │
                    ▼
        Store-aware pages automatically
        consume the selected context
```

This should reduce inconsistent behavior between modules.

---

# 6. Shared vs Store-Specific Data

A key distinction in the ERP is:

### Global / Shared Entities

These exist independently of a particular store:

- Products
- Categories
- Barcodes
- Customers
- Activity logs
- Store management
- Employee management

### Store-Specific Operational Data

These depend on where the business operation occurred:

- Stock
- Stock entries
- Stock movements
- Orders
- POS sales
- Social-commerce sales
- Returns/exchanges
- Reporting data

### Important Example: Customers

A customer must **not** be duplicated per store.

Instead:

```text
Customer
   │
   ├── Order → Store A
   ├── Order → Store B
   └── Order → Store A
```

The customer remains global, while transactions retain their originating store.

---

# 7. Outstanding Work Checklist

## High Priority

- [ ] Fix Orders admin Working Location behavior.
- [ ] Fix Stock Movements admin Working Location behavior.
- [ ] Review Products page so global catalogue and store availability are clearly separated.
- [ ] Ensure admins can identify store-level product/stock information where required.
- [ ] Implement Social Commerce split/multiple payments using the POS payment behavior as reference.
- [ ] Remove redundant buttons from Social Commerce.
- [ ] Implement Promotions.
- [ ] Complete Reporting.
- [ ] Implement Risk Review.
- [ ] Finalize/verify Returns & Exchanges behavior.
- [ ] Complete offline browser operation for POS and Social Commerce.
- [ ] Audit all store-scoped pages for consistent Working Location behavior.

## Verification / QA

- [ ] Test Employee + Store A.
- [ ] Test Employee + Store B.
- [ ] Test Admin + Store A.
- [ ] Test Admin + Store B.
- [ ] Test Admin + All Stores.
- [ ] Verify global pages remain global regardless of Working Location.
- [ ] Verify store-specific pages react correctly to Working Location changes.
- [ ] Verify no store data leaks into an employee's view from another store.
- [ ] Verify cross-store aggregation works for admins.
- [ ] Verify customer order history retains originating store information.

---

# 8. Current Completion Snapshot

### Completed / Good

- [x] Orders store scoping — basic implementation exists
- [x] Stock store scoping
- [x] Stock Entry store scoping
- [x] Categories global
- [x] Barcode global
- [x] Employee page looks good
- [x] Store page largely looks good
- [x] Activity Log global
- [x] POS multiple-payment capability exists and can be reused as reference

### Partially Complete / Needs Fixes

- [ ] Orders — admin behavior needs correction
- [ ] Products — global catalogue vs store availability needs tightening
- [ ] Stock Movements — admin behavior needs correction
- [ ] Customers — currently scoped but should be global
- [ ] Social Commerce — scoping exists, but UI/payment improvements required
- [ ] Returns & Exchanges — final admin/store behavior needs verification
- [ ] Stores — verify uploadable store information
- [ ] Reporting — major implementation work remaining

### Not Started / Major Work

- [ ] Promotions
- [ ] Risk Review
- [ ] Reporting
- [ ] Offline browser operation

---

# 9. Development Rule of Thumb

When implementing a new ERP page, first classify its data as either:

1. **Global/shared**, or
2. **Store-specific/operational**.

If it is store-specific, the page should consume the central **Working Location** context.

If it is global, it should ignore the Working Location for data visibility.

For admins, **All Stores** should mean cross-store visibility wherever the page is store-aware.

For employees, their Working Location should remain fixed to their assigned store.

This rule should be applied consistently throughout the ERP to prevent the current problem of some pages being accidentally over-scoped or under-scoped.
