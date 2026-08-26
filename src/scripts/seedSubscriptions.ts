import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subscription from '../modules/subscription/subscription.model';

dotenv.config();

const plans = [
  {
    name: 'PAY AS YOU GO',
    type: 'PAY AS YOU GO',
    price: 3,
    priceLabel: '$3–$30 Credits',
    description: 'No monthly subscription',
    isPopular: false,
    discount: 0,
    apiAccess: false,
    customPricing: false,
    ctaText: 'Buy Credits',
    isAvailable: true,
    features: [
      { name: 'No monthly subscription', included: true },
      { name: 'Smart invoices', included: true },
      { name: 'AI-powered report checks', included: true },
      { name: 'View old reports', included: true },
      { name: 'Download certificates', included: true },
      { name: 'Buy credits anytime', included: true },
    ],
  },
  {
    name: 'IMOSCAN EPOS',
    type: 'IMOSCAN EPOS',
    price: 14.99,
    priceLabel: '£14.99 / month',
    description: 'per location',
    isPopular: true,
    discount: 10,
    apiAccess: true,
    customPricing: false,
    ctaText: 'Choose Plan',
    isAvailable: true,
    features: [
      { name: 'Complete EPOS & checkout', included: true },
      { name: 'Create unlimited invoices', included: true },
      { name: 'AI report checks & certificates', included: true },
      { name: 'Smart inventory — 95% faster than manual entry', included: true },
      { name: 'Repair booking & management', included: true },
      { name: 'Sales, customer & business reports', included: true },
      { name: 'Buy report credits separately', included: true },
      { name: 'Monitor all stores from one page', included: true },
      { name: 'Add unlimited stores & manage them all from one account', included: true },
    ],
  },
];

async function seedSubscriptions() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);

    console.log('Cleaning existing subscriptions...');
    await Subscription.deleteMany({});

    console.log('Seeding pricing plans...');
    const result = await Subscription.insertMany(plans);

    console.log(`Successfully seeded ${result.length} pricing plans:`);
    result.forEach((p) => console.log(` - [${p.type}] ${p.name}: ${p.priceLabel}`));

    await mongoose.disconnect();
    console.log('Database disconnected successfully.');
  } catch (error) {
    console.error('Error seeding subscriptions:', error);
    process.exit(1);
  }
}

seedSubscriptions();
