# Pay-First-Then-Order Implementation

## Overview
This implementation enables a payment flow where users can pay BEFORE creating an order, rather than creating an order first and then paying.

## New Endpoints

### 1. Create Payment Intent for Cart
**POST** `/store/payment/create-intent-for-cart`

**Purpose**: Create a Stripe payment intent before order creation

**Authentication**: Required (JWT Bearer token)

**Request Body**:
```json
{
  "items": [
    {
      "product_id": 123,
      "quantity": 2,
      "price": 25.50,
      "options": [
        {
          "option_name": "Size",
          "option_value": "Large",
          "price": 2.50
        }
      ]
    }
  ],
  "delivery_fee": 10.00,
  "coupon_code": "SAVE10",
  "wholesale_discount_percentage": 5
}
```

**Response**:
```json
{
  "success": true,
  "client_secret": "pi_xxxxx_secret_yyyyy",
  "payment_intent_id": "pi_xxxxxxxxxxxxx",
  "amount": 135.50,
  "currency": "AUD",
  "breakdown": {
    "subtotal": 100.00,
    "wholesale_discount": 5.00,
    "coupon_discount": 10.00,
    "after_discount": 85.00,
    "gst": 8.50,
    "delivery_fee": 10.00,
    "total": 103.50
  }
}
```

### 2. Updated Create Order Endpoint
**POST** `/store/orders`

**New Optional Parameter**: `payment_intent_id`

**Request Body**:
```json
{
  "items": [...],
  "delivery_address": "123 Main St",
  "delivery_date": "2026-02-20",
  "delivery_time": "10:00 AM",
  "delivery_fee": 10.00,
  "payment_method": "stripe",
  "payment_intent_id": "pi_xxxxxxxxxxxxx",  // <-- NEW: Optional payment intent ID
  "notes": "Leave at door",
  "coupon_code": "SAVE10",
  "postcode": "3000"
}
```

## Frontend Implementation Flow

### Option 1: Pay First, Then Create Order (NEW)

```javascript
// Step 1: User clicks "Pay Now" on cart
const cartData = {
  items: cartItems,
  delivery_fee: deliveryFee,
  coupon_code: couponCode,
  wholesale_discount_percentage: wholesaleDiscount
};

// Step 2: Create payment intent
const paymentResponse = await fetch('/store/payment/create-intent-for-cart', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(cartData)
});

const { client_secret, payment_intent_id } = await paymentResponse.json();

// Step 3: Process payment with Stripe
const stripe = Stripe(publishableKey);
const { error } = await stripe.confirmCardPayment(client_secret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: customerName,
      email: customerEmail
    }
  }
});

if (error) {
  // Handle payment error
  console.error(error);
  return;
}

// Step 4: Payment succeeded! Now create the order
const orderData = {
  items: cartItems,
  delivery_address: deliveryAddress,
  delivery_date: deliveryDate,
  delivery_time: deliveryTime,
  delivery_fee: deliveryFee,
  payment_method: 'stripe',
  payment_intent_id: payment_intent_id,  // <-- Include payment intent ID
  notes: notes,
  coupon_code: couponCode,
  postcode: postcode
};

const orderResponse = await fetch('/store/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});

const order = await orderResponse.json();
// Order created with status = "paid" (order_status = 2)
```

### Option 2: Create Order First, Then Pay (EXISTING)

```javascript
// Step 1: Create order
const orderData = {
  items: cartItems,
  delivery_address: deliveryAddress,
  // ... other fields
  payment_method: 'stripe'
  // NO payment_intent_id
};

const orderResponse = await fetch('/store/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});

const { order_id } = await orderResponse.json();

// Step 2: Create payment intent for the order
const paymentResponse = await fetch('/store/payment/create-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ order_id })
});

const { client_secret } = await paymentResponse.json();

// Step 3: Process payment
const stripe = Stripe(publishableKey);
await stripe.confirmCardPayment(client_secret, {
  payment_method: {
    card: cardElement
  }
});
```

## Backend Changes

### 1. Stripe Service (`stripe.service.ts`)
- Made `orderId` optional in `StripePaymentIntentRequest` interface
- Updated metadata handling to conditionally include `order_id`

### 2. Payment Service (`store-payment.service.ts`)
- Added `createPaymentIntentForCart()` method
- Calculates order total from cart data
- Creates payment intent without requiring an order_id
- Stores payment history with customer information

### 3. Payment Controller (`store-payment.controller.ts`)
- Added `/create-intent-for-cart` endpoint
- Requires JWT authentication
- Accepts cart data instead of order_id

### 4. Orders Service (`store-orders.service.ts`)
- Updated `createOrder()` to accept `payment_intent_id`
- Added payment verification logic:
  - Checks if payment exists in database
  - Verifies payment status is "succeeded" or "paid"
  - Validates payment amount matches order total
- Sets order status to "paid" (2) if payment verified
- Sets payment_status to "succeeded" if payment verified

### 5. Orders Controller (`store-orders.controller.ts`)
- Added `payment_intent_id` to request body schema
- Updated TypeScript interface to include optional `payment_intent_id`

## Database Changes

**No schema changes required!** The implementation uses existing tables:
- `payment_history`: Stores payment intents (with or without order_id)
- `orders`: Stores orders with payment status

## Security Features

1. **Payment Verification**: Backend verifies payment status before marking order as paid
2. **Amount Validation**: Ensures payment amount matches order total (within 1 cent tolerance)
3. **Authentication**: Cart payment endpoint requires JWT authentication
4. **Payment Status Check**: Only accepts "succeeded" or "paid" payment statuses

## Benefits

1. **Better UX**: Users can pay immediately without waiting for order creation
2. **Reduced Failures**: Payment happens first, reducing abandoned orders
3. **Flexibility**: Supports both payment flows (pay-first or order-first)
4. **Accurate Status**: Orders created with verified payments are immediately marked as "paid"

## Testing

### Test Pay-First Flow:
1. Call `/store/payment/create-intent-for-cart` with cart data
2. Use returned `client_secret` to complete payment via Stripe
3. Call `/store/orders` with `payment_intent_id`
4. Verify order is created with `order_status = 2` and `payment_status = 'succeeded'`

### Test Order-First Flow (Existing):
1. Call `/store/orders` without `payment_intent_id`
2. Call `/store/payment/create-intent` with `order_id`
3. Complete payment via Stripe
4. Verify order status updates via webhook
