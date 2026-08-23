<?php

return [
    'country' => 'Bangladesh',
    'country_code' => 'BD',
    'currency' => 'BDT',
    'currency_symbol' => '৳',
    'timezone' => 'Asia/Dhaka',
    'default_delivery_charge' => (float) env('HAJJMART_DEFAULT_DELIVERY_CHARGE', 80),
    'transaction_approval_threshold' => (float) env('HAJJMART_TRANSACTION_APPROVAL_THRESHOLD', 50000),

    'offline_commerce' => [
        'heartbeat_interval_seconds' => (int) env('HAJJMART_OFFLINE_HEARTBEAT_INTERVAL_SECONDS', 25),
        'healthy_seconds' => (int) env('HAJJMART_OFFLINE_HEALTHY_SECONDS', 60),
        'offline_confirmed_seconds' => (int) env('HAJJMART_OFFLINE_CONFIRMED_SECONDS', 180),
        'offline_snapshot_startup_max_age_hours' => (int) env('HAJJMART_OFFLINE_SNAPSHOT_STARTUP_MAX_AGE_HOURS', 24),
    ],

    'payment_methods' => [
        'cod' => [
            'label' => 'Cash on delivery',
            'description' => 'Pay with cash upon delivery.',
        ],
        'online' => [
            'label' => 'Pay Online (Credit/Debit Card/MobileBanking/NetBanking/bKash)',
            'description' => 'Online payment through SSLCommerz, card, mobile banking, net banking, or bKash.',
        ],
    ],

    'districts' => [
        'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria',
        'Chandpur', 'Chapai Nawabganj', 'Chattogram', 'Chuadanga', 'Comilla', 'Cox\'s Bazar',
        'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj',
        'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati', 'Jhenaidah', 'Joypurhat', 'Khagrachhari',
        'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur',
        'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon',
        'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali',
        'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati',
        'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet',
        'Tangail', 'Thakurgaon',
    ],

    'divisions' => [
        'Barishal', 'Chattogram', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet',
    ],
];
